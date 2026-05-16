import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, CheckCircle, DollarSign, Award } from 'lucide-react';
import api from '@/lib/api';
import { CommissionRule, CloserCommissionRecord, Client, User } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { useCrmCurrency } from '@/context/CrmCurrencyContext';

export default function Commissions() {
  const { fmt } = useCrmCurrency();
  const [tab, setTab] = useState<'rules' | 'records'>('rules');
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [records, setRecords] = useState<CloserCommissionRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<CommissionRule | null>(null);

  const [form, setForm] = useState({
    clientId: '', closerId: '', name: '', type: 'FIXED_PER_ORDER',
    fixedAmount: '', percentage: '', description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>('/clients?limit=100'),
      api.get<any>('/users?limit=100'),
    ]).then(([c, u]) => {
      setClients(Array.isArray(c.data) ? c.data : c.data.clients || []);
      setUsers(u.data.users || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<CommissionRule[]>('/crm/commission-rules'),
      api.get<CloserCommissionRecord[]>('/crm/commissions'),
    ]).then(([r, rec]) => {
      setRules(r.data); setRecords(rec.data);
    }).finally(() => setLoading(false));
  }, []);

  async function saveRule() {
    setSaving(true);
    try {
      const payload = {
        ...form, closerId: form.closerId || null,
        fixedAmount: form.fixedAmount ? Number(form.fixedAmount) : null,
        percentage: form.percentage ? Number(form.percentage) : null,
      };
      if (editRule) {
        const { data } = await api.put<CommissionRule>(`/crm/commission-rules/${editRule.id}`, payload);
        setRules(r => r.map(x => x.id === data.id ? data : x));
      } else {
        const { data } = await api.post<CommissionRule>('/crm/commission-rules', payload);
        setRules(r => [data, ...r]);
      }
      setShowForm(false); setEditRule(null);
      setForm({ clientId: '', closerId: '', name: '', type: 'FIXED_PER_ORDER', fixedAmount: '', percentage: '', description: '' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(id: string) {
    if (!window.confirm('Delete this commission rule?')) return;
    await api.delete(`/crm/commission-rules/${id}`);
    setRules(r => r.filter(x => x.id !== id));
  }

  async function payCommission(id: string) {
    const { data } = await api.put<CloserCommissionRecord>(`/crm/commissions/${id}/pay`);
    setRecords(r => r.map(x => x.id === id ? data : x));
  }

  function openEdit(rule: CommissionRule) {
    setEditRule(rule);
    setForm({
      clientId: rule.clientId, closerId: rule.closerId || '',
      name: rule.name, type: rule.type,
      fixedAmount: rule.fixedAmount ? String(rule.fixedAmount) : '',
      percentage: rule.percentage ? String(rule.percentage) : '',
      description: rule.description || '',
    });
    setShowForm(true);
  }

  const pendingTotal = records.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0);
  const paidTotal = records.filter(r => r.paid).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Commission Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Rules and payout tracking</p>
        </div>
        {tab === 'rules' && (
          <button onClick={() => { setShowForm(true); setEditRule(null); setForm({ clientId: '', closerId: '', name: '', type: 'FIXED_PER_ORDER', fixedAmount: '', percentage: '', description: '' }); }}
            className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: rules.length.toString(), icon: Award, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Pending Payout', value: fmt(pendingTotal), icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Total Paid', value: fmt(paidTotal), icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {(['rules', 'records'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              tab === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {t === 'rules' ? 'Commission Rules' : 'Payout Records'}
          </button>
        ))}
      </div>

      {/* Commission Rules */}
      {tab === 'rules' && (
        <>
          {showForm && (
            <div className="card p-5 border-2 border-amber-400/30">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                {editRule ? 'Edit Rule' : 'New Commission Rule'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Rule Name *</label>
                  <input className="input mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard Fixed" />
                </div>
                <div>
                  <label className="label">Client *</label>
                  <select className="select mt-1" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                    <option value="">All Clients</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Closer (optional)</label>
                  <select className="select mt-1" value={form.closerId} onChange={e => setForm(f => ({ ...f, closerId: e.target.value }))}>
                    <option value="">All Closers</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Commission Type</label>
                  <select className="select mt-1" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="FIXED_PER_ORDER">Fixed per Order</option>
                    <option value="PERCENTAGE">Percentage of Sale</option>
                  </select>
                </div>
                {form.type === 'FIXED_PER_ORDER' ? (
                  <div>
                    <label className="label">Fixed Amount (MAD)</label>
                    <input className="input mt-1" type="number" step="0.01" value={form.fixedAmount} onChange={e => setForm(f => ({ ...f, fixedAmount: e.target.value }))} placeholder="20" />
                  </div>
                ) : (
                  <div>
                    <label className="label">Percentage (%)</label>
                    <input className="input mt-1" type="number" step="0.1" max="100" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} placeholder="5" />
                  </div>
                )}
                <div>
                  <label className="label">Description</label>
                  <input className="input mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowForm(false); setEditRule(null); }} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button onClick={saveRule} disabled={saving || !form.name} className="btn-primary px-6 py-2 text-sm flex items-center gap-2">
                  {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Saving…' : 'Save Rule'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', rule.active ? 'bg-amber-500/10' : 'bg-slate-200 dark:bg-slate-700')}>
                    <Award className={cn('w-5 h-5', rule.active ? 'text-amber-500' : 'text-slate-400')} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{rule.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {rule.type === 'FIXED_PER_ORDER'
                        ? `${rule.fixedAmount} MAD per confirmed order`
                        : `${rule.percentage}% of order amount`}
                      {rule.client && ` · ${rule.client.name}`}
                      {rule.closer && ` · ${rule.closer.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('badge text-xs', rule.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500')}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {rules.length === 0 && !loading && (
              <div className="card p-12 text-center text-slate-400">
                <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No commission rules yet</p>
                <p className="text-xs mt-1">Create rules to automatically calculate closer commissions</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Payout Records */}
      {tab === 'records' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['Closer', 'Order', 'Amount', 'Date', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.closer?.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <div>{r.order?.customerName}</div>
                      <div className="text-xs">{r.order?.productName}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      {r.paid ? (
                        <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">Paid</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!r.paid && (
                        <button onClick={() => payCommission(r.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && !loading && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">No commission records yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
