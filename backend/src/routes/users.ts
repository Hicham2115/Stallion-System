import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, requireRole, AuthRequest, ROLE_LEVELS } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function canManage(actorRole: string, targetRole: string): boolean {
  return (ROLE_LEVELS[actorRole] || 0) >= (ROLE_LEVELS[targetRole] || 0);
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  phone: true,
  active: true,
  suspended: true,
  lastLogin: true,
  createdAt: true,
} as const;

// GET /api/users — list with search, filters, pagination
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, role, status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) where.role = role;

  if (status === 'active') {
    where.active = true;
    where.suspended = false;
  } else if (status === 'suspended') {
    where.suspended = true;
  } else if (status === 'inactive') {
    where.active = false;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ users, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// GET /api/users/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      ...USER_SELECT,
      updatedAt: true,
      activityLogs: {
        select: { id: true, module: true, action: true, details: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(user);
});

// POST /api/users — admin+ only
router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password, role, phone, avatar } = req.body;

  if (!name || !email) {
    res.status(400).json({ message: 'Name and email are required' });
    return;
  }

  const targetRole = role || 'TEAM_MEMBER';
  const actorLevel = ROLE_LEVELS[req.user!.role] || 0;
  const targetLevel = ROLE_LEVELS[targetRole] || 0;
  if (targetLevel > actorLevel) {
    res.status(403).json({ message: 'Cannot create user with a higher role than your own' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ message: 'Email already in use' });
    return;
  }

  const hashed = await bcrypt.hash(password || 'Stallion@123', 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: targetRole, phone, avatar },
    select: USER_SELECT,
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      module: 'USERS',
      action: 'USER_CREATED',
      details: `Created user ${name} with role ${targetRole}`,
    },
  });

  res.status(201).json(user);
});

// PUT /api/users/:id — admin+ only
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, phone, avatar } = req.body;

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (!canManage(req.user!.role, target.role)) {
    res.status(403).json({ message: 'Cannot modify a user with equal or higher role' });
    return;
  }

  if (email && email !== target.email) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { name, email, phone, avatar },
    select: USER_SELECT,
  });
  res.json(user);
});

// PUT /api/users/:id/role — change role (admin+)
router.put('/:id/role', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { role } = req.body;
  if (!role) {
    res.status(400).json({ message: 'Role is required' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (!canManage(req.user!.role, target.role)) {
    res.status(403).json({ message: 'Cannot modify a user with equal or higher role' });
    return;
  }

  const actorLevel = ROLE_LEVELS[req.user!.role] || 0;
  const newLevel = ROLE_LEVELS[role] || 0;
  if (newLevel > actorLevel) {
    res.status(403).json({ message: 'Cannot assign a role higher than your own' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: USER_SELECT,
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      module: 'USERS',
      action: 'ROLE_CHANGED',
      details: `Changed ${target.name}'s role from ${target.role} to ${role}`,
    },
  });

  res.json(user);
});

// POST /api/users/:id/suspend — admin+ only
router.post('/:id/suspend', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.userId === req.params.id) {
    res.status(400).json({ message: 'Cannot suspend yourself' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (!canManage(req.user!.role, target.role)) {
    res.status(403).json({ message: 'Cannot suspend a user with equal or higher role' });
    return;
  }

  await prisma.user.update({ where: { id: req.params.id }, data: { suspended: true } });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      module: 'USERS',
      action: 'USER_SUSPENDED',
      details: `Suspended account for ${target.name}`,
    },
  });

  res.json({ message: 'User suspended' });
});

// POST /api/users/:id/activate — admin+ only
router.post('/:id/activate', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (!canManage(req.user!.role, target.role)) {
    res.status(403).json({ message: 'Cannot activate a user with equal or higher role' });
    return;
  }

  await prisma.user.update({
    where: { id: req.params.id },
    data: { suspended: false, active: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      module: 'USERS',
      action: 'USER_ACTIVATED',
      details: `Activated account for ${target.name}`,
    },
  });

  res.json({ message: 'User activated' });
});

// POST /api/users/:id/reset-password — admin+ only
router.post('/:id/reset-password', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { newPassword } = req.body;

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (!canManage(req.user!.role, target.role)) {
    res.status(403).json({ message: 'Cannot reset password for a user with equal or higher role' });
    return;
  }

  const tempPassword = newPassword || 'Stallion@123';
  const hashed = await bcrypt.hash(tempPassword, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      module: 'USERS',
      action: 'PASSWORD_RESET',
      details: `Reset password for ${target.name}`,
    },
  });

  res.json({ message: 'Password reset successfully', tempPassword });
});

// PUT /api/users/:id/toggle-closer — manager+ can toggle isCloser flag
router.put('/:id/toggle-closer', requireRole('MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const rows = await prisma.$queryRaw<{ isCloser: boolean }[]>`
    SELECT "isCloser" FROM users WHERE id = ${req.params.id} LIMIT 1
  `;
  if (rows.length === 0) { res.status(404).json({ message: 'User not found' }); return; }
  const newValue = !rows[0].isCloser;
  await prisma.$executeRaw`UPDATE users SET "isCloser" = ${newValue} WHERE id = ${req.params.id}`;
  const result = await prisma.$queryRaw<{ id: string; name: string; email: string; role: string; avatar: string | null; isCloser: boolean }[]>`
    SELECT id, name, email, role, avatar, "isCloser" FROM users WHERE id = ${req.params.id} LIMIT 1
  `;
  res.json(result[0]);
});

// DELETE /api/users/:id — SUPER_ADMIN only (hard deactivate)
router.delete('/:id', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.userId === req.params.id) {
    res.status(400).json({ message: 'Cannot delete yourself' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ message: 'User deleted' });
});

export default router;
