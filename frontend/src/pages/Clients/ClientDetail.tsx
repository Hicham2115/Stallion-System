import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FolderOpen, Edit2, DollarSign, CheckSquare, Users, Plus, Trash2, Receipt } from 'lucide-react';
import api from '@/lib/api';
import { Client, ClientCost, User } from '@/types';
import { formatCurrency, formatDate, getServiceLabel, getStatusColor, cn } from '@/lib/utils';
import ClientModal from './ClientModal';
import DateSelector from '@/components/DateSelector';

type Tab = 'overview' | 'costs' | 'closers';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  // Costs state
  const [costForm, setCostForm] = useState({ name: '', amount: '', date: '' });
  const [costLoading, setCostLoading] = useState(false);

  // Closers state
  const [closers, setClosers] = useState<(User & { assignedAt: string })[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [closersLoading, setClosersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchClient = async () => {
    const { data } = await api.get<Client>(`/clients/${id}`);
    setClient(data);
    setLoading(false);
  };

  useEffect(() => { fetchClient(); }, [id]);

  const fetchClosers = async () => {
    if (!id) return;
    setClosersLoading(true);
    const [closersRes, usersRes] = await Promise.all([
      api.get<(User & { assignedAt: string })[]>(`/clients/${id}/closers`),
      api.get<any>('/users?limit=100'),
    ]);
    setClosers(closersRes.data);
    const users = usersRes.data.users || usersRes.data || [];
    setAllUsers(users);
    setClosersLoading(false);
  };

  useEffect(() => {
    if (tab === 'closers') fetchClosers();
  }, [tab, id]);

  const assignCloser = async () => {
    if (!selectedUserId || !id) return;
    setAssigning(true);
    try {
      await api.post(`/clients/${id}/closers`, { userId: selectedUserId });
      setSelectedUserId('');
      await fetchClosers();
    } catch (err: any) {
      if (err.response?.status !== 409) throw err;
    } finally {
      setAssigning(false);
    }
  };

  const removeCloser = async (userId: string) => {
    if (!id) return;
    await api.delete(`/clients/${id}/closers/${userId}`);
    setClosers(c => c.filter(x => x.id !== userId));
  };

  const addCost = async () => {
    if (!id || !costForm.name.trim() || !costForm.amount || !costForm.date) return;
    setCostLoading(true);
    try {
      const { data } = await api.post<ClientCost>(`/clients/${id}/costs`, {
        name: costForm.name.trim(),
        amount: Number(costForm.amount),
        date: costForm.date,
      });
      setClient(c => c ? { ...c, costs: [data, ...((c as Client & { costs?: ClientCost[] }).costs || [])] } as Client : c);
      setCostForm({ name: '', amount: '', date: '' });
    } finally {
      setCostLoading(false);
    }
  };

  const deleteCost = async (costId: string) => {
    if (!id) return;
    await api.delete(`/clients/${id}/costs/${costId}`);
    setClient(c => c ? { ...c, costs: ((c as Client & { costs?: ClientCost[] }).costs || []).filter(cost => cost.id !== costId) } as Client : c);
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!client) return <div className="text-center py-12 text-slate-400">Client not found</div>;

  const payments = (client as any).payments || [];
  const tasks = (client as any).tasks || [];
  const logs = (client as any).activityLogs || [];
  const costs = ((client as Client & { costs?: ClientCost[] }).costs || []);
  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);

  const assignableUsers = allUsers.filter(u => !closers.some(c => c.id === u.id));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>

      {/* Hero card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
              <span className={cn('badge', getStatusColor(client.status))}>
                {client.status === 'ONE_TIME' ? 'One-Time' : client.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{getServiceLabel(client.service)}</span>
              <span>·</span>
              <span>Since {formatDate(client.startDate)}</span>
              {client.website && (
                <>
                  <span>·</span>
                  <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-amber-500 hover:text-amber-600">
                    <ExternalLink className="w-3.5 h-3.5" /> Website
                  </a>
                </>
              )}
              {client.googleDriveLink && (
                <>
                  <span>·</span>
                  <a href={client.googleDriveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-amber-500 hover:text-amber-600">
                    <FolderOpen className="w-3.5 h-3.5" /> Drive
                  </a>
                </>
              )}
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="btn-secondary shrink-0">
            <Edit2 className="w-4 h-4" /> Edit
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Monthly Fee', value: formatCurrency(client.monthlyFee) },
            { label: 'Billing', value: client.billingFrequency },
            { label: 'Contact', value: client.contactPerson },
            { label: 'Email', value: client.email },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-slate-400 font-medium">{label}</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 truncate">{value}</div>
            </div>
          ))}
        </div>

        {client.notes && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-xs text-slate-400 font-medium mb-1">Notes</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([
          { key: 'overview', label: 'Overview', icon: DollarSign },
          { key: 'costs', label: 'Costs', icon: Receipt },
          { key: 'closers', label: 'Assigned Closers', icon: Users },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Payments */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" /> Payments
                </h2>
                <Link to="/revenue" className="text-xs text-amber-500">View all</Link>
              </div>
              <div className="space-y-2">
                {payments.slice(0, 6).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(p.amount)}</div>
                      <div className="text-xs text-slate-400">{formatDate(p.date)} · {p.invoiceNumber || '—'}</div>
                    </div>
                    <span className={cn('badge text-xs', getStatusColor(p.status))}>{p.status}</span>
                  </div>
                ))}
                {payments.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No payments yet</p>}
              </div>
            </div>

            {/* Tasks */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-blue-500" /> Tasks
                </h2>
                <Link to="/tasks" className="text-xs text-amber-500">View all</Link>
              </div>
              <div className="space-y-2">
                {tasks.slice(0, 5).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{t.title}</div>
                      {t.assignedTo && <div className="text-xs text-slate-400">{t.assignedTo.name}</div>}
                    </div>
                    <span className={cn('badge text-xs', getStatusColor(t.status))}>{t.status.replace('_', ' ')}</span>
                  </div>
                ))}
                {tasks.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No tasks yet</p>}
              </div>
            </div>
          </div>

          {/* Activity Log */}
          {logs.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Activity History</h2>
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{log.details}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{log.user?.name} · {formatDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Costs tab */}
      {tab === 'costs' && (
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-500" /> Client Costs
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add costs for this client from the admin account.
                </p>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Total {formatCurrency(totalCosts, client.preferredCurrency)}
              </div>
            </div>

            <div className="grid sm:grid-cols-[1fr_160px_190px_auto] gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Cost Name</label>
                <input
                  className="input"
                  placeholder="e.g. Ads, Tools, Freelancer"
                  value={costForm.name}
                  onChange={e => setCostForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Amount</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={costForm.amount}
                  onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <DateSelector
                  label="Date"
                  value={costForm.date}
                  onChange={date => setCostForm(f => ({ ...f, date }))}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addCost}
                  disabled={costLoading || !costForm.name.trim() || !costForm.amount || !costForm.date}
                  className="btn-primary w-full sm:w-auto px-4"
                >
                  {costLoading
                    ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Saved Costs ({costs.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {costs.length === 0 ? (
                <div className="px-5 py-10 text-center text-slate-400">
                  <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No costs yet</p>
                </div>
              ) : (
                costs.map(cost => (
                  <div key={cost.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{cost.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(cost.date)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(Number(cost.amount), client.preferredCurrency)}
                      </div>
                      <button
                        onClick={() => deleteCost(cost.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        aria-label="Delete cost"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Closers tab */}
      {tab === 'closers' && (
        <div className="card p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" /> Assigned Closers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These team members will appear in the closer dropdown when creating orders for this client.
            </p>
          </div>

          {/* Assign form */}
          <div className="flex gap-3">
            <select
              className="select flex-1"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
            >
              <option value="">Select team member to assign…</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
            <button
              onClick={assignCloser}
              disabled={assigning || !selectedUserId}
              className="btn-primary flex items-center gap-2 px-4"
            >
              {assigning
                ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Plus className="w-4 h-4" />}
              Assign
            </button>
          </div>

          {/* Closers list */}
          {closersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : closers.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No closers assigned yet</p>
              <p className="text-xs mt-1">Assign team members above to filter the closer dropdown in orders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {closers.map(closer => (
                <div key={closer.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-bold">
                      {closer.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{closer.name}</div>
                      <div className="text-xs text-slate-400">{closer.role} · Assigned {formatDate(closer.assignedAt)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeCloser(closer.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ClientModal
        open={editing}
        onClose={() => setEditing(false)}
        client={client}
        onSaved={fetchClient}
      />
    </div>
  );
}
