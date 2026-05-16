import { useEffect, useState } from 'react';
import { Plus, Download, CheckCircle, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '@/lib/api';
import { Expense, ExpensePaymentStatus } from '@/types';
import { formatCurrency, formatDate, getCategoryLabel, cn } from '@/lib/utils';
import ExpenseModal from './ExpenseModal';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const params = new URLSearchParams({ year: String(year) });
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('paymentStatus', statusFilter);
    const [e, s] = await Promise.all([
      api.get<Expense[]>(`/expenses?${params}`),
      api.get<any[]>(`/expenses/summary?year=${year}`),
    ]);
    setExpenses(e.data);
    setSummary(s.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [year, typeFilter, statusFilter]);

  const totalPaid   = expenses.filter((e) => e.paymentStatus === 'PAID').reduce((s, e) => s + e.amount, 0);
  const totalPending = expenses.filter((e) => e.paymentStatus === 'PENDING').reduce((s, e) => s + e.amount, 0);
  const totalFixed   = expenses.filter((e) => e.type === 'FIXED').reduce((s, e) => s + e.amount, 0);
  const totalVariable = expenses.filter((e) => e.type === 'VARIABLE').reduce((s, e) => s + e.amount, 0);
  const total = totalFixed + totalVariable;

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${id}`);
    fetchAll();
  };

  const handleExport = async () => {
    const res = await api.get(`/expenses/export?year=${year}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Year {year}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Expense</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Expenses</p>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{formatCurrency(total)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Fixed Costs</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">{formatCurrency(totalFixed)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Paid</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
        </div>
      </div>

      {/* Chart + Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Monthly Breakdown</h2>
            <select className="select w-24 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={summary} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="fixed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="variable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="fixed" stroke="#3b82f6" strokeWidth={2} fill="url(#fixed)" name="Fixed" />
              <Area type="monotone" dataKey="variable" stroke="#8b5cf6" strokeWidth={2} fill="url(#variable)" name="Variable" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">By Category</h2>
          <div className="space-y-2">
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-300">{getCategoryLabel(cat as any)}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                      style={{ width: `${total > 0 ? (amount / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(byCategory).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Expense Records</h2>
          <div className="flex gap-2">
            <select className="select w-36 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="FIXED">Fixed</option>
              <option value="VARIABLE">Variable</option>
            </select>
            <select className="select w-36 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Name', 'Category', 'Type', 'Amount', 'Date', 'Status', 'Recurring', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{exp.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{getCategoryLabel(exp.category)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', exp.type === 'FIXED'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400')}>
                        {exp.type === 'FIXED' ? 'Fixed' : 'Variable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(exp.date)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          const next: ExpensePaymentStatus = exp.paymentStatus === 'PAID' ? 'PENDING' : 'PAID';
                          await api.put(`/expenses/${exp.id}`, { paymentStatus: next });
                          fetchAll();
                        }}
                        className={cn(
                          'badge cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1',
                          exp.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                        title="Click to toggle status"
                      >
                        {exp.paymentStatus === 'PAID'
                          ? <><CheckCircle className="w-3 h-3" /> Paid</>
                          : <><Clock className="w-3 h-3" /> Pending</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', exp.recurring
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>
                        {exp.recurring ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(exp); setModalOpen(true); }} className="text-xs text-blue-500 hover:underline">Edit</button>
                        <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">No expenses found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} expense={editing} onSaved={fetchAll} />
    </div>
  );
}
