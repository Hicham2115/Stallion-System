import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';

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

// GET /api/expenses
router.get('/', h(async (req: AuthRequest, res: Response) => {
  const { year, month, type, category, paymentStatus } = req.query;
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (category) where.category = category;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (year || month) {
    const y = parseInt(year as string) || new Date().getFullYear();
    if (month) {
      const m = parseInt(month as string) - 1;
      where.date = { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) };
    } else {
      where.date = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
    }
  }
  const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
  res.json(expenses);
}));

// GET /api/expenses/summary
router.get('/summary', h(async (req: AuthRequest, res: Response) => {
  const y = parseInt(req.query.year as string) || new Date().getFullYear();
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
    select: { amount: true, date: true, type: true },
  });
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(y, i, 1).toLocaleString('default', { month: 'short' }),
    fixed: 0, variable: 0, total: 0,
  }));
  expenses.forEach((e) => {
    const m = new Date(e.date).getMonth();
    if (e.type === 'FIXED') monthly[m].fixed += e.amount;
    else monthly[m].variable += e.amount;
    monthly[m].total += e.amount;
  });
  res.json(monthly);
}));

// POST /api/expenses
router.post('/', h(async (req: AuthRequest, res: Response) => {
  const { date, amount, method, notes, paymentStatus, ...rest } = req.body;
  if (!date) { res.status(400).json({ message: 'Date is required' }); return; }
  const expense = await prisma.expense.create({
    data: {
      ...rest,
      amount: Number(amount),
      date: toDate(date),
      method: method || null,
      notes: notes || null,
      paymentStatus: paymentStatus || 'PENDING',
    },
  });
  res.status(201).json(expense);
}));

// PUT /api/expenses/:id
router.put('/:id', h(async (req: AuthRequest, res: Response) => {
  const { date, amount, method, notes, paymentStatus, ...rest } = req.body;
  const data: Record<string, unknown> = { ...rest };
  if (date) data.date = toDate(date);
  if (amount !== undefined) data.amount = Number(amount);
  if ('method' in req.body) data.method = method || null;
  if ('notes' in req.body) data.notes = notes || null;
  if (paymentStatus) data.paymentStatus = paymentStatus;
  const expense = await prisma.expense.update({ where: { id: req.params.id }, data });
  res.json(expense);
}));

// DELETE /api/expenses/:id
router.delete('/:id', h(async (req: AuthRequest, res: Response) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.json({ message: 'Expense deleted' });
}));

// GET /api/expenses/export
router.get('/export', h(async (req: AuthRequest, res: Response) => {
  const y = parseInt(req.query.year as string) || new Date().getFullYear();
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
    orderBy: { date: 'desc' },
  });
  const rows = expenses.map((e) => ({
    'Expense Name': e.name, 'Category': e.category, 'Type': e.type,
    'Amount (MAD)': e.amount.toFixed(2), 'Date': new Date(e.date).toLocaleDateString(),
    'Method': e.method || '', 'Recurring': e.recurring ? 'Yes' : 'No',
    'Payment Status': e.paymentStatus, 'Notes': e.notes || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Expenses');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=expenses-${y}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}));

export default router;
