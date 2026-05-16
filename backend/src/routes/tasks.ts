import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, ROLE_LEVELS } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const h = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function isManagerOrAbove(role: string) {
  return (ROLE_LEVELS[role] || 0) >= ROLE_LEVELS['MANAGER'];
}

// GET /api/tasks
router.get('/', h(async (req: AuthRequest, res: Response) => {
  const { status, priority, assignedToId, clientId, search } = req.query;
  const elevated = isManagerOrAbove(req.user!.role);

  const tasks = await prisma.task.findMany({
    where: {
      ...(!elevated && { assignedToId: req.user!.userId }),
      ...(status && { status: status as never }),
      ...(priority && { priority: priority as never }),
      ...(assignedToId && elevated && { assignedToId: assignedToId as string }),
      ...(clientId && { clientId: clientId as string }),
      ...(search && {
        OR: [
          { title: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      assignedTo: { select: { id: true, name: true, avatar: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  });
  res.json(tasks);
}));

// GET /api/tasks/workload
router.get('/workload', h(async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, avatar: true },
  });
  const workload = await Promise.all(
    users.map(async (user) => {
      const counts = await prisma.task.groupBy({
        by: ['status'],
        where: { assignedToId: user.id },
        _count: { id: true },
      });
      return { user, counts };
    })
  );
  res.json(workload);
}));

// GET /api/tasks/:id
router.get('/:id', h(async (req: AuthRequest, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignedTo: { select: { id: true, name: true, avatar: true } },
      client: { select: { id: true, name: true } },
    },
  });
  if (!task) { res.status(404).json({ message: 'Task not found' }); return; }
  res.json(task);
}));

// POST /api/tasks
router.post('/', h(async (req: AuthRequest, res: Response) => {
  const { dueDate, ...rest } = req.body;
  const task = await prisma.task.create({
    data: { ...rest, dueDate: toDateOrNull(dueDate) },
    include: {
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });
  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      clientId: task.clientId,
      module: 'TASKS',
      action: 'TASK_CREATED',
      details: `Task created: ${task.title}`,
    },
  });
  res.status(201).json(task);
}));

// PUT /api/tasks/:id
router.put('/:id', h(async (req: AuthRequest, res: Response) => {
  const { dueDate, ...rest } = req.body;
  const data: Record<string, unknown> = { ...rest };
  if ('dueDate' in req.body) data.dueDate = toDateOrNull(dueDate);

  const old = await prisma.task.findUnique({ where: { id: req.params.id } });
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  });

  if (old && old.status !== task.status) {
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        clientId: task.clientId,
        module: 'TASKS',
        action: task.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
        details: `${task.title}: ${old.status} → ${task.status}`,
      },
    });
  }
  res.json(task);
}));

// DELETE /api/tasks/:id
router.delete('/:id', h(async (req: AuthRequest, res: Response) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.json({ message: 'Task deleted' });
}));

export default router;
