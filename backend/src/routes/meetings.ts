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

function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const slots: string[] = [];
  for (let t = start; t + durationMin <= end; t += durationMin) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
}

function slotsConflict(
  slotTime: string,
  durationMin: number,
  meetings: { startTime: Date; endTime: Date }[]
): boolean {
  const [sh, sm] = slotTime.split(':').map(Number);
  const slotStart = sh * 60 + sm;
  const slotEnd = slotStart + durationMin;
  return meetings.some((m) => {
    const mS = new Date(m.startTime).getHours() * 60 + new Date(m.startTime).getMinutes();
    const mE = new Date(m.endTime).getHours() * 60 + new Date(m.endTime).getMinutes();
    return slotStart < mE && slotEnd > mS;
  });
}

// ── Meeting Types ─────────────────────────────────────────────────────────────

router.get('/types', h(async (_req, res) => {
  const types = await (prisma as any).meetingType.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(types);
}));

router.post('/types', h(async (req, res) => {
  const { name, duration, description, color } = req.body;
  if (!name || !duration) { res.status(400).json({ message: 'Name and duration are required' }); return; }
  const t = await (prisma as any).meetingType.create({
    data: { name, duration: Number(duration), description: description || null, color: color || '#f59e0b' },
  });
  res.status(201).json(t);
}));

router.put('/types/:id', h(async (req, res) => {
  const { name, duration, description, color, active } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (duration !== undefined) data.duration = Number(duration);
  if (description !== undefined) data.description = description || null;
  if (color !== undefined) data.color = color;
  if (active !== undefined) data.active = active;
  const t = await (prisma as any).meetingType.update({ where: { id: req.params.id }, data });
  res.json(t);
}));

router.delete('/types/:id', h(async (req, res) => {
  await (prisma as any).meetingType.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
}));

// ── Admin Availability ────────────────────────────────────────────────────────

router.get('/availability', h(async (req, res) => {
  const adminId = (req.query.adminId as string) || req.user!.userId;
  const avail = await (prisma as any).adminAvailability.findMany({ where: { adminId }, orderBy: { dayOfWeek: 'asc' } });
  res.json(avail);
}));

router.put('/availability', h(async (req, res) => {
  const adminId = (req.body.adminId as string) || req.user!.userId;
  const { slots } = req.body as {
    adminId?: string;
    slots: { dayOfWeek: number; startTime: string; endTime: string; timezone: string }[];
  };
  await (prisma as any).adminAvailability.deleteMany({ where: { adminId } });
  if (slots?.length) {
    await (prisma as any).adminAvailability.createMany({
      data: slots.map((s) => ({
        adminId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone || 'Africa/Casablanca',
      })),
    });
  }
  const avail = await (prisma as any).adminAvailability.findMany({ where: { adminId }, orderBy: { dayOfWeek: 'asc' } });
  res.json(avail);
}));

// ── Blocked Dates ─────────────────────────────────────────────────────────────

router.get('/blocked-dates', h(async (req, res) => {
  const adminId = (req.query.adminId as string) || req.user!.userId;
  const blocked = await (prisma as any).blockedDate.findMany({ where: { adminId }, orderBy: { blockedDate: 'asc' } });
  res.json(blocked);
}));

router.post('/blocked-dates', h(async (req, res) => {
  const { blockedDate, reason, adminId: targetAdminId } = req.body;
  if (!blockedDate) { res.status(400).json({ message: 'blockedDate is required' }); return; }
  const adminId = targetAdminId || req.user!.userId;
  const b = await (prisma as any).blockedDate.create({
    data: { adminId, blockedDate: toDate(blockedDate), reason: reason || null },
  });
  res.status(201).json(b);
}));

router.delete('/blocked-dates/:id', h(async (req, res) => {
  await (prisma as any).blockedDate.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
}));

// ── Available Slots ───────────────────────────────────────────────────────────

router.get('/available-slots', h(async (req, res) => {
  const { adminId, date, duration } = req.query;
  if (!adminId || !date || !duration) {
    res.status(400).json({ message: 'adminId, date, and duration required' });
    return;
  }
  const durationMin = parseInt(duration as string);
  const targetDate = new Date(date as string);
  const dayOfWeek = targetDate.getDay();
  const startOfDay = new Date(date as string); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(date as string); endOfDay.setHours(23, 59, 59, 999);

  const [avail, blocked, existingMeetings] = await Promise.all([
    (prisma as any).adminAvailability.findUnique({
      where: { adminId_dayOfWeek: { adminId: adminId as string, dayOfWeek } },
    }),
    (prisma as any).blockedDate.findFirst({
      where: { adminId: adminId as string, blockedDate: { gte: startOfDay, lte: endOfDay } },
    }),
    (prisma as any).meeting.findMany({
      where: { adminId: adminId as string, status: { notIn: ['CANCELLED'] }, startTime: { gte: startOfDay, lte: endOfDay } },
      select: { startTime: true, endTime: true },
    }),
  ]);

  if (!avail || blocked) { res.json({ slots: [] }); return; }

  const allSlots = generateSlots(avail.startTime, avail.endTime, durationMin);
  const available = allSlots.filter((s) => !slotsConflict(s, durationMin, existingMeetings));
  res.json({ slots: available });
}));

// ── Meetings CRUD ─────────────────────────────────────────────────────────────

router.get('/', h(async (req, res) => {
  const { status, clientId, adminId, from, to, upcoming } = req.query;
  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (adminId) where.adminId = adminId;
  if (upcoming === 'true') {
    where.startTime = { gte: new Date() };
    where.status = { in: ['SCHEDULED', 'CONFIRMED'] };
  } else {
    if (status) where.status = status;
    if (from || to) {
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter.gte = toDate(from as string);
      if (to) dateFilter.lte = toDate(to as string);
      where.startTime = dateFilter;
    }
  }
  const meetings = await (prisma as any).meeting.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      admin: { select: { id: true, name: true, avatar: true } },
      meetingType: true,
    },
    orderBy: { startTime: 'asc' },
  });
  res.json(meetings);
}));

router.get('/:id', h(async (req, res) => {
  const m = await (prisma as any).meeting.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { id: true, name: true, email: true, phone: true } },
      admin: { select: { id: true, name: true, avatar: true, email: true } },
      meetingType: true,
    },
  });
  if (!m) { res.status(404).json({ message: 'Meeting not found' }); return; }
  res.json(m);
}));

router.post('/', h(async (req, res) => {
  const { clientId, adminId, meetingTypeId, title, description, meetingLink, startTime, endTime, timezone, notes, internalNotes } = req.body;
  if (!title || !startTime || !endTime) { res.status(400).json({ message: 'title, startTime, endTime required' }); return; }
  const m = await (prisma as any).meeting.create({
    data: {
      clientId: clientId || null,
      adminId: adminId || req.user!.userId,
      meetingTypeId: meetingTypeId || null,
      title,
      description: description || null,
      meetingLink: meetingLink || null,
      startTime: toDate(startTime),
      endTime: toDate(endTime),
      timezone: timezone || 'Africa/Casablanca',
      notes: notes || null,
      internalNotes: internalNotes || null,
    },
    include: {
      client: { select: { id: true, name: true } },
      admin: { select: { id: true, name: true, avatar: true } },
      meetingType: true,
    },
  });
  res.status(201).json(m);
}));

router.put('/:id', h(async (req, res) => {
  const fields = ['title', 'description', 'meetingLink', 'status', 'timezone', 'notes', 'internalNotes', 'cancelReason', 'meetingTypeId', 'clientId', 'adminId'];
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in req.body) data[f] = req.body[f] ?? null;
  }
  if ('startTime' in req.body) data.startTime = toDate(req.body.startTime);
  if ('endTime' in req.body) data.endTime = toDate(req.body.endTime);
  const m = await (prisma as any).meeting.update({
    where: { id: req.params.id },
    data,
    include: {
      client: { select: { id: true, name: true } },
      admin: { select: { id: true, name: true, avatar: true } },
      meetingType: true,
    },
  });
  res.json(m);
}));

router.delete('/:id', h(async (req, res) => {
  await (prisma as any).meeting.delete({ where: { id: req.params.id } });
  res.json({ message: 'Meeting deleted' });
}));

export default router;
