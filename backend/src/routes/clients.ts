import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const h = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  const d = new Date(val as string);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${val}`);
  return d;
}

// GET /api/clients
router.get('/', h(async (req: AuthRequest, res: Response) => {
  const { search, status, service, archived } = req.query;
  const clients = await prisma.client.findMany({
    where: {
      archived: archived === 'true',
      ...(status && { status: status as never }),
      ...(service && { service: service as never }),
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { contactPerson: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    },
    include: { _count: { select: { payments: true, tasks: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
}));

// GET /api/clients/:id
router.get('/:id', h(async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      payments: { orderBy: { date: 'desc' }, take: 10 },
      tasks: { include: { assignedTo: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
      activityLogs: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!client) { res.status(404).json({ message: 'Client not found' }); return; }
  res.json(client);
}));

// POST /api/clients
router.post('/', h(async (req: AuthRequest, res: Response) => {
  const { startDate, monthlyFee, ...rest } = req.body;

  if (!rest.name) { res.status(400).json({ message: 'Client name is required' }); return; }
  if (!rest.contactPerson) { res.status(400).json({ message: 'Contact person is required' }); return; }
  if (!rest.email) { res.status(400).json({ message: 'Email is required' }); return; }
  if (!startDate) { res.status(400).json({ message: 'Start date is required' }); return; }

  const client = await prisma.client.create({
    data: {
      ...rest,
      monthlyFee: Number(monthlyFee) || 0,
      startDate: toDate(startDate),
      website: rest.website || null,
      googleDriveLink: rest.googleDriveLink || null,
      notes: rest.notes || null,
      phone: rest.phone || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      clientId: client.id,
      module: 'CLIENTS',
      action: 'CLIENT_ADDED',
      details: `Added client: ${client.name}`,
    },
  });

  res.status(201).json(client);
}));

// PUT /api/clients/:id
router.put('/:id', h(async (req: AuthRequest, res: Response) => {
  const { startDate, monthlyFee, ...rest } = req.body;
  const data: Record<string, unknown> = { ...rest };
  if (startDate) data.startDate = toDate(startDate);
  if (monthlyFee !== undefined) data.monthlyFee = Number(monthlyFee);
  if ('website' in rest) data.website = rest.website || null;
  if ('googleDriveLink' in rest) data.googleDriveLink = rest.googleDriveLink || null;
  if ('notes' in rest) data.notes = rest.notes || null;
  if ('phone' in rest) data.phone = rest.phone || null;

  const client = await prisma.client.update({ where: { id: req.params.id }, data });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      clientId: client.id,
      module: 'CLIENTS',
      action: 'CLIENT_UPDATED',
      details: `Updated client: ${client.name}`,
    },
  });

  res.json(client);
}));

// DELETE /api/clients/:id — archive
router.delete('/:id', h(async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: { archived: true },
  });
  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      clientId: client.id,
      module: 'CLIENTS',
      action: 'CLIENT_ARCHIVED',
      details: `Archived client: ${client.name}`,
    },
  });
  res.json({ message: 'Client archived' });
}));

// POST /api/clients/:id/restore
router.post('/:id/restore', h(async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: { archived: false },
  });
  res.json(client);
}));

// GET /api/clients/:id/closers — list assigned closers
router.get('/:id/closers', h(async (req: AuthRequest, res: Response) => {
  const rows = await prisma.$queryRaw<{ id: string; name: string; email: string; avatar: string | null; role: string; assignedAt: Date }[]>`
    SELECT u.id, u.name, u.email, u.avatar, u.role, cc."assignedAt"
    FROM client_closers cc
    JOIN users u ON u.id = cc."userId"
    WHERE cc."clientId" = ${req.params.id}
    ORDER BY cc."assignedAt" ASC
  `;
  res.json(rows);
}));

// POST /api/clients/:id/closers — assign a closer
router.post('/:id/closers', h(async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ message: 'userId required' }); return; }
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM client_closers WHERE "clientId" = ${req.params.id} AND "userId" = ${userId} LIMIT 1
  `;
  if (existing.length > 0) { res.status(409).json({ message: 'Already assigned' }); return; }
  const newId = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await prisma.$executeRaw`
    INSERT INTO client_closers (id, "clientId", "userId", "assignedAt")
    VALUES (${newId}, ${req.params.id}, ${userId}, NOW())
  `;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, avatar: true, role: true } });
  res.status(201).json(user);
}));

// DELETE /api/clients/:id/closers/:userId — unassign a closer
router.delete('/:id/closers/:userId', h(async (req: AuthRequest, res: Response) => {
  await prisma.$executeRaw`
    DELETE FROM client_closers WHERE "clientId" = ${req.params.id} AND "userId" = ${req.params.userId}
  `;
  res.json({ message: 'Closer removed' });
}));

export default router;
