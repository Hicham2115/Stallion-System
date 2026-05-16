import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { convert, Currency } from '../lib/currency';

const router = Router();
router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  const currency = (req.query.currency as Currency) || 'MAD';
  const fx = (amount: number) => convert(amount, 'MAD', currency);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalActiveClients,
    pendingTasks,
    openLeads,
    monthlyRevenue,
    lastMonthRevenue,
    yearlyRevenue,
    monthlyExpenses,
    overduePayments,
    recentActivity,
  ] = await Promise.all([
    prisma.client.count({ where: { status: 'ACTIVE', archived: false } }),
    prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } } }),
    prisma.lead.count({ where: { stage: { in: ['NEW', 'WARMED'] } } }),
    prisma.payment.aggregate({
      where: { date: { gte: startOfMonth }, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { date: { gte: startOfLastMonth, lte: endOfLastMonth }, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { date: { gte: startOfYear }, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: 'OVERDUE' } }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        client: { select: { id: true, name: true } },
      },
    }),
  ]);

  const mr = monthlyRevenue._sum.amount || 0;
  const lmr = lastMonthRevenue._sum.amount || 0;
  const me = monthlyExpenses._sum.amount || 0;
  const revenueGrowth = lmr > 0 ? ((mr - lmr) / lmr) * 100 : 0;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    closedWon,
    totalLeads,
    mrrAggregate,
    cancelledClients,
    pausedClients,
    adSpendAggregate,
    pendingInvoicesCount,
    pendingInvoicesAmount,
    completedTasksRecent,
    totalTasksRecent,
  ] = await Promise.all([
    prisma.lead.count({ where: { stage: 'CLOSED_WON' } }),
    prisma.lead.count(),
    // MRR from active client contracts
    prisma.client.aggregate({
      where: { status: 'ACTIVE', archived: false },
      _sum: { monthlyFee: true },
    }),
    prisma.client.count({ where: { status: 'CANCELLED', archived: false } }),
    prisma.client.count({ where: { status: 'PAUSED', archived: false } }),
    // Ad spend this month (for ROAS)
    prisma.expense.aggregate({
      where: { date: { gte: startOfMonth }, category: 'ADS_SPEND' },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: { in: ['PENDING', 'OVERDUE'] } } }),
    prisma.payment.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { amount: true },
    }),
    // Tasks completed in last 30 days
    prisma.task.count({ where: { status: 'COMPLETED', updatedAt: { gte: thirtyDaysAgo } } }),
    prisma.task.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  const conversionRate = totalLeads > 0 ? (closedWon / totalLeads) * 100 : 0;
  const mrr = mrrAggregate._sum.monthlyFee || 0;
  const totalClientsBase = totalActiveClients + cancelledClients + pausedClients;
  const retentionRate = totalClientsBase > 0 ? (totalActiveClients / totalClientsBase) * 100 : 100;
  const adSpend = adSpendAggregate._sum.amount || 0;
  const roas = adSpend > 0 ? mr / adSpend : null;
  const teamProductivity = totalTasksRecent > 0 ? (completedTasksRecent / totalTasksRecent) * 100 : 0;
  const profitMargin = mr > 0 ? ((mr - me) / mr) * 100 : 0;

  res.json({
    activeClients: totalActiveClients,
    pendingTasks,
    openLeads,
    overduePayments,
    monthlyRevenue: fx(mr),
    yearlyRevenue: fx(yearlyRevenue._sum.amount || 0),
    monthlyExpenses: fx(me),
    monthlyProfit: fx(mr - me),
    revenueGrowth,
    conversionRate,
    recentActivity,
    mrr: fx(mrr),
    retentionRate,
    roas,
    cashflowForecast: fx(mrr),
    pendingInvoicesCount,
    pendingInvoicesAmount: fx(pendingInvoicesAmount._sum.amount || 0),
    teamProductivity,
    profitMargin,
    currency,
  });
});

// GET /api/dashboard/revenue-chart
router.get('/revenue-chart', async (req: AuthRequest, res: Response): Promise<void> => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const currency = (req.query.currency as Currency) || 'MAD';
  const fx = (amount: number) => convert(amount, 'MAD', currency);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }, status: 'PAID' },
      select: { amount: true, date: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { amount: true, date: true },
    }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
    revenue: 0,
    expenses: 0,
    profit: 0,
  }));

  payments.forEach((p) => {
    months[new Date(p.date).getMonth()].revenue += p.amount;
  });
  expenses.forEach((e) => {
    months[new Date(e.date).getMonth()].expenses += e.amount;
  });
  months.forEach((m) => {
    m.revenue = fx(m.revenue);
    m.expenses = fx(m.expenses);
    m.profit = m.revenue - m.expenses;
  });

  res.json(months);
});

// GET /api/dashboard/top-clients
router.get('/top-clients', async (_req: AuthRequest, res: Response): Promise<void> => {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const payments = await prisma.payment.groupBy({
    by: ['clientId'],
    where: { date: { gte: startOfYear }, status: 'PAID' },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 5,
  });

  const clients = await Promise.all(
    payments.map(async (p) => {
      const client = await prisma.client.findUnique({
        where: { id: p.clientId },
        select: { id: true, name: true, service: true, status: true },
      });
      return { ...client, revenue: p._sum.amount };
    })
  );

  res.json(clients);
});

// GET /api/dashboard/notifications — recent activity log entries for the notification bell
router.get('/notifications', async (_req: AuthRequest, res: Response): Promise<void> => {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { name: true, avatar: true } },
      client: { select: { name: true } },
    },
  });
  res.json(logs);
});

export default router;
