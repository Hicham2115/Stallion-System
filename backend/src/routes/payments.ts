import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';

const router = Router();
router.use(authenticate);

// Forwards async errors to Express error handler instead of crashing the process
const h = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  const d = new Date(val as string);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${val}`);
  return d;
}

// GET /api/payments
router.get('/', h(async (req: AuthRequest, res: Response) => {
  const { year, month, clientId, status } = req.query;
  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (year || month) {
    const y = parseInt(year as string) || new Date().getFullYear();
    if (month) {
      const m = parseInt(month as string) - 1;
      where.date = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
    } else {
      where.date = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }
  }
  const payments = await prisma.payment.findMany({
    where,
    include: { client: { select: { id: true, name: true, service: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(payments);
}));

// GET /api/payments/summary
router.get('/summary', h(async (req: AuthRequest, res: Response) => {
  const y = parseInt(req.query.year as string) || new Date().getFullYear();
  const payments = await prisma.payment.findMany({
    where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }, status: 'PAID' },
    select: { amount: true, date: true },
  });
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(y, i, 1).toLocaleString('default', { month: 'short' }),
    revenue: 0,
  }));
  payments.forEach((p) => { monthly[new Date(p.date).getMonth()].revenue += p.amount; });
  res.json(monthly);
}));

// GET /api/payments/by-service
router.get('/by-service', h(async (req: AuthRequest, res: Response) => {
  const y = parseInt(req.query.year as string) || new Date().getFullYear();
  const payments = await prisma.payment.findMany({
    where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }, status: 'PAID' },
    include: { client: { select: { service: true } } },
  });
  const byService: Record<string, number> = {};
  payments.forEach((p) => {
    byService[p.client.service] = (byService[p.client.service] || 0) + p.amount;
  });
  res.json(Object.entries(byService).map(([service, amount]) => ({ service, amount })));
}));

// POST /api/payments
router.post('/', h(async (req: AuthRequest, res: Response) => {
  const { date, amount, clientId, method, invoiceNumber, status, notes, pdfUrl } = req.body;

  if (!clientId) { res.status(400).json({ message: 'Client is required' }); return; }
  if (!amount || isNaN(Number(amount))) { res.status(400).json({ message: 'Valid amount is required' }); return; }
  if (!date) { res.status(400).json({ message: 'Date is required' }); return; }

  const payment = await prisma.payment.create({
    data: {
      clientId,
      amount: Number(amount),
      date: toDate(date),
      method: method || 'BANK_TRANSFER',
      invoiceNumber: invoiceNumber || null,
      status: status || 'PENDING',
      notes: notes || null,
      pdfUrl: pdfUrl || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: req.user!.userId,
      clientId: payment.clientId,
      module: 'REVENUE',
      action: 'PAYMENT_RECORDED',
      details: `Payment recorded: ${payment.amount} MAD`,
    },
  });

  res.status(201).json(payment);
}));

// PUT /api/payments/:id
router.put('/:id', h(async (req: AuthRequest, res: Response) => {
  const { date, amount, ...rest } = req.body;
  const data: Record<string, unknown> = { ...rest };
  if (date) data.date = toDate(date);
  if (amount !== undefined) data.amount = Number(amount);
  const payment = await prisma.payment.update({ where: { id: req.params.id }, data });
  res.json(payment);
}));

// DELETE /api/payments/:id
router.delete('/:id', h(async (req: AuthRequest, res: Response) => {
  await prisma.payment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Payment deleted' });
}));

// GET /api/payments/export
router.get('/export', h(async (req: AuthRequest, res: Response) => {
  const y = parseInt(req.query.year as string) || new Date().getFullYear();
  const payments = await prisma.payment.findMany({
    where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
    include: { client: { select: { name: true, service: true } } },
    orderBy: { date: 'desc' },
  });
  const rows = payments.map((p) => ({
    'Client': p.client.name,
    'Service': p.client.service,
    'Amount (MAD)': p.amount,
    'Date': new Date(p.date).toLocaleDateString(),
    'Method': p.method,
    'Invoice #': p.invoiceNumber || '',
    'Status': p.status,
    'Notes': p.notes || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Payments');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=revenue-${y}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}));

export default router;
