import { useEffect, useState } from 'react';
import { Search, Plus, User, MapPin, Phone, TrendingUp, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { CrmCustomer, Client } from '@/types';
import { cn } from '@/lib/utils';
import { useCrmCurrency } from '@/context/CrmCurrencyContext';

export default function Customers() {
  const { fmt } = useCrmCurrency();
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: '', name: '', phone: '', city: '', address: '', notes: '',
  });

  useEffect(() => {
    api.get<any>('/clients?limit=100').then(r => {
      setClients(Array.isArray(r.data) ? r.data : r.data.clients || []);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (clientFilter) params.set('clientId', clientFilter);
    const { data } = await api.get<CrmCustomer[]>(`/crm/customers?${params}`);
    setCustomers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, clientFilter]);

  async function addCustomer() {
    if (!form.clientId || !form.name) return;
    setSaving(true);
    try {
      const { data } = await api.post<CrmCustomer>('/crm/customers', form);
      setCustomers(c => [data, ...c]);
      setForm({ clientId: '', name: '', phone: '', city: '', address: '', notes: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  const topSpenders = [...customers].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5);
  const topCities = customers.reduce<Record<string, number>>((acc, c) => {
    if (c.city) acc[c.city] = (acc[c.city] || 0) + 1;
    return acc;
  }, {});
  const cityList = Object.entries(topCities).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customer Database</h2>
          <p className="text-sm text-slate-500 mt-0.5">{customers.length} customers</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{customers.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total Customers</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {fmt(customers.reduce((s, c) => s + c.totalSpend, 0))}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Total Customer Spend</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {customers.filter(c => c.orderCount > 1).length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Repeat Customers</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {customers.length > 0 ? fmt(customers.reduce((s, c) => s + c.totalSpend, 0) / customers.length) : '0 MAD'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Avg Lifetime Value</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card p-5 border-2 border-amber-400/30">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">New Customer</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client *</label>
              <select className="select mt-1" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Name *</label>
              <input className="input mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Customer name" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+212…" />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input mt-1" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Casablanca" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input mt-1" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input mt-1" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button onClick={addCustomer} disabled={saving || !form.clientId || !form.name} className="btn-primary px-6 py-2 text-sm flex items-center gap-2">
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Add Customer'}
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top spenders */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" /> Top Spenders
          </h3>
          <div className="space-y-3">
            {topSpenders.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</div>
                    {c.city && <div className="text-xs text-slate-400">{c.city}</div>}
                  </div>
                </div>
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmt(c.totalSpend)}</div>
              </div>
            ))}
            {topSpenders.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No data yet</p>}
          </div>
        </div>

        {/* Top cities */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" /> Top Cities
          </h3>
          <div className="space-y-2">
            {cityList.map(([city, count]) => (
              <div key={city} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">{city}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / customers.length) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-400">{count}</span>
                </div>
              </div>
            ))}
            {cityList.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No data yet</p>}
          </div>
        </div>

        {/* Repeat vs. new */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Customer Segments</h3>
          <div className="space-y-3">
            {[
              { label: 'New Customers', count: customers.filter(c => c.orderCount === 1).length, color: 'bg-blue-500' },
              { label: 'Repeat Customers', count: customers.filter(c => c.orderCount > 1).length, color: 'bg-amber-500' },
              { label: 'VIP (5+ orders)', count: customers.filter(c => c.orderCount >= 5).length, color: 'bg-emerald-500' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-2.5 h-2.5 rounded-full', color)} />
                  <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer table */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9 w-full" placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-full sm:w-48" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={load} className="btn-secondary p-2.5">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {['Customer', 'Contact', 'Location', 'Orders', 'Total Spend', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-20" /></td>
                  ))}</tr>
                ))
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No customers found
                </td></tr>
              ) : customers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {c.city && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.city}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.orderCount || c._count?.orders || 0}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{fmt(c.totalSpend)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-xs', c.orderCount > 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500')}>
                      {c.orderCount > 1 ? 'Repeat' : 'New'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
