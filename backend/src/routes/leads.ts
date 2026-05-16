import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

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

// GET /api/leads
router.get('/', h(async (req: AuthRequest, res: Response) => {
  const { stage, assignedToId, search } = req.query;
  const leads = await prisma.lead.findMany({
    where: {
      ...(stage && { stage: stage as never }),
      ...(assignedToId && { assignedToId: assignedToId as string }),
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { company: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      assignedTo: { select: { id: true, name: true, avatar: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(leads);
}));

// GET /api/leads/stats
router.get('/stats', h(async (_req: AuthRequest, res: Response) => {
  const [total, byStage, bySource] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['stage'], _count: { id: true }, _sum: { expectedValue: true } }),
    prisma.lead.groupBy({ by: ['source'], _count: { id: true } }),
  ]);
  res.json({ total, byStage, bySource });
}));

// GET /api/leads/:id
router.get('/:id', h(async (req: AuthRequest, res: Response) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      assignedTo: { select: { id: true, name: true, avatar: true } },
      activities: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!lead) { res.status(404).json({ message: 'Lead not found' }); return; }
  res.json(lead);
}));

// POST /api/leads
router.post('/', h(async (req: AuthRequest, res: Response) => {
  const { followUpDate, expectedValue, ...rest } = req.body;
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      expectedValue: expectedValue ? Number(expectedValue) : null,
      followUpDate: toDateOrNull(followUpDate),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });
  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      module: 'LEADS',
      action: 'LEAD_ADDED',
      details: `New lead: ${lead.name} (${lead.company || 'No company'})`,
    },
  });
  res.status(201).json(lead);
}));

// PUT /api/leads/:id
router.put('/:id', h(async (req: AuthRequest, res: Response) => {
  const { followUpDate, expectedValue, ...rest } = req.body;
  const old = await prisma.lead.findUnique({ where: { id: req.params.id } });
  const data: Record<string, unknown> = { ...rest };
  if ('followUpDate' in req.body) data.followUpDate = toDateOrNull(followUpDate);
  if ('expectedValue' in req.body) data.expectedValue = expectedValue ? Number(expectedValue) : null;

  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data,
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  if (old && old.stage !== lead.stage) {
    await prisma.activityLog.create({
      data: {
        userId: req.user!.userId,
        module: 'LEADS',
        action: 'LEAD_STAGE_CHANGED',
        details: `${lead.name} moved from ${old.stage} → ${lead.stage}`,
      },
    });
  }
  res.json(lead);
}));

// DELETE /api/leads/:id
router.delete('/:id', h(async (req: AuthRequest, res: Response) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  res.json({ message: 'Lead deleted' });
}));

// POST /api/leads/:id/activities
router.post('/:id/activities', h(async (req: AuthRequest, res: Response) => {
  const { note } = req.body;
  const activity = await prisma.leadActivity.create({ data: { leadId: req.params.id, note } });
  res.status(201).json(activity);
}));

export default router;
