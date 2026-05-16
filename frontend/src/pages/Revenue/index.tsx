import { useEffect, useState } from 'react';
import { Plus, Download, Trash2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from 'recharts';
import api from '@/lib/api';
import { Payment, Client } from '@/types';
import { formatCurrency, formatDate, getStatusColor, cn } from '@/lib/utils';
import { useCurrency } from '@/context/CurrencyContext';
import PaymentModal from './PaymentModal';

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

export default function Revenue() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [byService, setByService] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const { currency, setCurrency, convert } = useCurrency();
  const fc = (amount: number) => formatCurrency(convert(amount), currency);

  const fetchAll = async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (statusFilter) params.set('status', statusFilter);
    const [p, m, s, c] = await Promise.all([
      api.get<Payment[]>(`/payments?${params}`),
      api.get<any[]>(`/payments/summary?year=${year}`),
      api.get<any[]>(`/payments/by-service?year=${year}`),
      api.get<Client[]>('/clients?archived=false'),
    ]);
    setPayments(p.data);
    setMonthlyData(m.data);
    setByService(s.data);
    setClients(c.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [year, statusFilter]);

  const totalRevenue = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const pendingAmount = payments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);
  const overdueAmount = payments.filter((p) => p.status === 'OVERDUE').reduce((s, p) => s + p.amount, 0);

  const handleExport = async () => {
    const res = await api.get(`/payments/export?year=${year}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markOverdue = async (id: string) => {
    await api.put(`/payments/${id}`, { status: 'OVERDUE' });
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payment record? This cannot be undone.')) return;
    await api.delete(`/payments/${id}`);
    fetchAll();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Financial year {year}</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {(['MAD', 'USD', 'EUR'] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className={cn('px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                  currency === c ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Received', value: totalRevenue, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Pending', value: pendingAmount, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Overdue', value: overdueAmount, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('card p-5', bg)}>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{fc(value)}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Monthly Revenue</h2>
            <select className="select w-28 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => fc(v)}
              />
              <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">By Service Type</h2>
          {byService.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={byService} dataKey="amount" nameKey="service" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {byService.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <PieTooltip formatter={(v: number) => fc(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {byService.map((s, i) => (
                  <div key={s.service} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600 dark:text-slate-300">{s.service.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">{fc(s.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Payments table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Payment Records</h2>
          <select className="select w-36 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Client', 'Amount', 'Date', 'Method', 'Invoice #', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment) => (
                  <tr key={payment.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/30', payment.status === 'OVERDUE' && 'bg-red-50/50 dark:bg-red-900/10')}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{payment.client?.name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{fc(payment.amount)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(payment.date)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{payment.method?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{payment.invoiceNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', getStatusColor(payment.status))}>{payment.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditing(payment); setModalOpen(true); }} className="text-xs text-blue-500 hover:underline">Edit</button>
                        {payment.status === 'PENDING' && (
                          <button onClick={() => markOverdue(payment.id)} className="text-xs text-red-500 hover:underline">Mark Overdue</button>
                        )}
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                          title="Delete payment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">No payments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        payment={editing}
        clients={clients}
        onSaved={fetchAll}
      />
    </div>
  );
}
