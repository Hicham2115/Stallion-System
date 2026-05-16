import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const h = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// GET /api/services — all services (any authenticated user, for dropdowns)
router.get('/', h(async (_req: AuthRequest, res: Response) => {
  const services = await prisma.companyService.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  res.json(services);
}));

// POST /api/services — create (admin only)
router.post('/', requireAdmin, h(async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ message: 'Service name is required' });
    return;
  }
  const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const existing = await prisma.companyService.findUnique({ where: { slug } });
  if (existing) {
    res.status(409).json({ message: 'A service with a similar name already exists' });
    return;
  }
  const maxOrder = await prisma.companyService.aggregate({ _max: { order: true } });
  const service = await prisma.companyService.create({
    data: {
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });
  res.status(201).json(service);
}));

// PUT /api/services/:id — update name/description/active/order (admin only)
router.put('/:id', requireAdmin, h(async (req: AuthRequest, res: Response) => {
  const { name, description, active } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (active !== undefined) data.active = Boolean(active);
  const service = await prisma.companyService.update({
    where: { id: req.params.id },
    data,
  });
  res.json(service);
}));

// DELETE /api/services/:id — delete (admin only, blocked if clients use it)
router.delete('/:id', requireAdmin, h(async (req: AuthRequest, res: Response) => {
  const service = await prisma.companyService.findUnique({ where: { id: req.params.id } });
  if (!service) { res.status(404).json({ message: 'Service not found' }); return; }

  const clientCount = await prisma.client.count({ where: { service: service.slug } });
  if (clientCount > 0) {
    res.status(409).json({ message: `Cannot delete: ${clientCount} client(s) use this service` });
    return;
  }
  const leadCount = await prisma.lead.count({ where: { service: service.slug } });
  if (leadCount > 0) {
    res.status(409).json({ message: `Cannot delete: ${leadCount} lead(s) reference this service` });
    return;
  }

  await prisma.companyService.delete({ where: { id: req.params.id } });
  res.json({ message: 'Service deleted' });
}));

export default router;
