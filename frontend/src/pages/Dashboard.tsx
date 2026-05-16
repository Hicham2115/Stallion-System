import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, DollarSign, CheckSquare, Target, TrendingUp, TrendingDown,
  ArrowRight, AlertTriangle, Activity, Repeat, ShieldCheck, Zap,
  BarChart3, Clock, Gauge, Receipt,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '@/lib/api';
import { DashboardStats, MonthlyChartData, Currency } from '@/types';
import { formatCurrency, formatRelativeTime, getInitials, getServiceLabel, cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';

interface TopClient { id: string; name: string; service: string; status: string; revenue: number }

function KpiCard({
  label, value, sub, icon: Icon, color, iconBg, trend, trendLabel, link,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color: string; iconBg: string; trend?: number; trendLabel?: string; link?: string;
}) {
  const inner = (
    <div className="stat-card group">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 leading-tight break-words">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 leading-tight">{sub}</p>}
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs mt-1', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendLabel || `${Math.abs(trend).toFixed(1)}%`}
          </div>
        )}
      </div>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function ProgressBar({ value, color = 'bg-amber-500' }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

const CURRENCIES: Currency[] = ['MAD', 'USD', 'EUR'];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<MonthlyChartData[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();
  const { currency, setCurrency } = useCurrency();

  const fc = (amount: number) => formatCurrency(amount, currency);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<DashboardStats>(`/dashboard/stats?currency=${currency}`),
      api.get<MonthlyChartData[]>(`/dashboard/revenue-chart?year=${year}&currency=${currency}`),
      api.get<TopClient[]>('/dashboard/top-clients'),
    ]).then(([s, c, t]) => {
      setStats(s.data);
      setChart(c.data);
      setTopClients(t.data);
    }).finally(() => setLoading(false));
  }, [year, currency]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!stats) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CEO Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Currency toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {CURRENCIES.map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                  currency === c
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                )}
              >{c}</button>
            ))}
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Annual Run Rate</p>
            <p className="text-xl font-bold text-amber-500">{fc(stats.mrr * 12)}</p>
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {stats.overduePayments > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-red-700 dark:text-red-400 font-medium">
            {stats.overduePayments} overdue payment{stats.overduePayments > 1 ? 's' : ''} — {fc(stats.pendingInvoicesAmount)} at risk
          </span>
          <Link to="/revenue" className="ml-auto text-red-600 dark:text-red-400 underline text-xs hover:no-underline">View</Link>
        </div>
      )}

      {/* Row 1: Core KPIs */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Core Metrics</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Monthly Revenue"
            value={fc(stats.monthlyRevenue)}
            icon={DollarSign}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            color="text-emerald-600"
            trend={stats.revenueGrowth}
            link="/revenue"
          />
          <KpiCard
            label="Active Clients"
            value={String(stats.activeClients)}
            sub={`${stats.openLeads} open leads`}
            icon={Users}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            color="text-blue-600"
            link="/clients"
          />
          <KpiCard
            label="Pending Tasks"
            value={String(stats.pendingTasks)}
            sub="across all projects"
            icon={CheckSquare}
            iconBg="bg-amber-100 dark:bg-amber-900/30"
            color="text-amber-600"
            link="/tasks"
          />
          <KpiCard
            label="Open Leads"
            value={String(stats.openLeads)}
            sub={`${stats.conversionRate.toFixed(0)}% conversion rate`}
            icon={Target}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            color="text-purple-600"
            link="/leads"
          />
        </div>
      </div>

      {/* Row 2: CEO Decision KPIs */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Business Health</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="MRR (Contract Value)"
            value={fc(stats.mrr)}
            sub="from active client contracts"
            icon={Repeat}
            iconBg="bg-teal-100 dark:bg-teal-900/30"
            color="text-teal-600"
          />
          <KpiCard
            label="Client Retention"
            value={`${stats.retentionRate.toFixed(0)}%`}
            sub={`${stats.activeClients} active of ${stats.activeClients + Math.round(stats.activeClients * (100 - stats.retentionRate) / Math.max(stats.retentionRate, 1))} total`}
            icon={ShieldCheck}
            iconBg={stats.retentionRate >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}
            color={stats.retentionRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}
          />
          <KpiCard
            label="Pending Invoices"
            value={fc(stats.pendingInvoicesAmount)}
            sub={`${stats.pendingInvoicesCount} invoice${stats.pendingInvoicesCount !== 1 ? 's' : ''} outstanding`}
            icon={Receipt}
            iconBg={stats.pendingInvoicesCount > 0 ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-slate-100 dark:bg-slate-800'}
            color={stats.pendingInvoicesCount > 0 ? 'text-orange-600' : 'text-slate-400'}
            link="/revenue"
          />
          <KpiCard
            label="Team Productivity"
            value={`${stats.teamProductivity.toFixed(0)}%`}
            sub="tasks completed (30 days)"
            icon={Zap}
            iconBg={stats.teamProductivity >= 70 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}
            color={stats.teamProductivity >= 70 ? 'text-emerald-600' : 'text-amber-600'}
            link="/tasks"
          />
        </div>
      </div>

      {/* P&L + Financial Ratios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Yearly Revenue</span>
          <span className="text-xl font-bold text-emerald-600">{fc(stats.yearlyRevenue)}</span>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monthly Expenses</span>
          <span className="text-xl font-bold text-red-500">{fc(stats.monthlyExpenses)}</span>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monthly Profit</span>
          <span className={cn('text-xl font-bold', stats.monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {fc(stats.monthlyProfit)}
          </span>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Profit Margin</span>
          <span className={cn('text-xl font-bold', stats.profitMargin >= 30 ? 'text-emerald-600' : stats.profitMargin >= 0 ? 'text-amber-600' : 'text-red-500')}>
            {stats.monthlyRevenue > 0 ? `${stats.profitMargin.toFixed(1)}%` : '—'}
          </span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue/Expenses chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">{year} Revenue vs Expenses</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f1f5f9' }}
                formatter={(v: number) => fc(v)}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fill="url(#rev)" name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#exp)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Decision metrics panel */}
        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-500" />
            Performance Indicators
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500 dark:text-slate-400">Lead Conversion</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats.conversionRate.toFixed(0)}%</span>
              </div>
              <ProgressBar value={stats.conversionRate} color="bg-purple-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500 dark:text-slate-400">Client Retention</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats.retentionRate.toFixed(0)}%</span>
              </div>
              <ProgressBar value={stats.retentionRate} color={stats.retentionRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500 dark:text-slate-400">Profit Margin</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats.profitMargin.toFixed(0)}%</span>
              </div>
              <ProgressBar value={stats.profitMargin} color={stats.profitMargin >= 30 ? 'bg-emerald-500' : 'bg-amber-500'} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-500 dark:text-slate-400">Team Productivity</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats.teamProductivity.toFixed(0)}%</span>
              </div>
              <ProgressBar value={stats.teamProductivity} color={stats.teamProductivity >= 70 ? 'bg-emerald-500' : 'bg-amber-500'} />
            </div>

            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex justify-between py-1">
                <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <BarChart3 className="w-3.5 h-3.5" />
                  ROAS (Ad Spend)
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {stats.roas !== null ? `${stats.roas.toFixed(1)}x` : 'No ad spend'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  Cashflow Forecast
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {fc(stats.cashflowForecast)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-sm text-slate-500 dark:text-slate-400">Avg Client Value</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {stats.activeClients > 0 ? fc(stats.mrr / stats.activeClients) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top clients */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Top Clients by Revenue</h2>
            <Link to="/clients" className="text-xs text-amber-500 hover:text-amber-600 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {topClients.map((client, i) => (
              <Link key={client.id} to={`/clients/${client.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{client.name}</div>
                  <div className="text-xs text-slate-400">{getServiceLabel(client.service)}</div>
                </div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                  {fc(client.revenue || 0)}
                </div>
              </Link>
            ))}
            {topClients.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No revenue data yet</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              Recent Activity
            </h2>
          </div>
          <div className="space-y-3">
            {stats.recentActivity.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  {getInitials(log.user?.name || 'S')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{log.details}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
            {stats.recentActivity.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
