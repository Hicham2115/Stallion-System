import { useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Store } from 'lucide-react';
import api from '@/lib/api';
import { ShopifyConfig, Client } from '@/types';
import { cn } from '@/lib/utils';

interface SyncResult { message: string; created: number; updated: number; total: number }

export default function ShopifyIntegration() {
  const [configs, setConfigs] = useState<ShopifyConfig[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; result: SyncResult | { message: string } } | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clientId: '', storeName: '', storeUrl: '', accessToken: '',
  });

  useEffect(() => {
    Promise.all([
      api.get<any>('/clients?limit=100'),
      api.get<ShopifyConfig[]>('/crm/shopify'),
    ]).then(([c, s]) => {
      setClients(Array.isArray(c.data) ? c.data : c.data.clients || []);
      setConfigs(s.data);
    }).finally(() => setLoading(false));
  }, []);

  async function addConfig() {
    if (!form.clientId || !form.storeName || !form.storeUrl || !form.accessToken) return;
    setSaving(true);
    try {
      const { data } = await api.post<ShopifyConfig>('/crm/shopify', form);
      setConfigs(c => [data, ...c]);
      setForm({ clientId: '', storeName: '', storeUrl: '', accessToken: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(id: string) {
    if (!window.confirm('Remove this Shopify connection?')) return;
    await api.delete(`/crm/shopify/${id}`);
    setConfigs(c => c.filter(x => x.id !== id));
  }

  async function sync(config: ShopifyConfig) {
    setSyncing(config.id);
    setSyncResult(null);
    try {
      const { data } = await api.post<SyncResult>(`/crm/shopify/${config.id}/sync`);
      setSyncResult({ id: config.id, result: data });
      setConfigs(c => c.map(x => x.id === config.id ? { ...x, lastSyncAt: new Date().toISOString() } : x));
    } catch (err: any) {
      setSyncResult({ id: config.id, result: { message: err.response?.data?.message || 'Sync failed' } });
    } finally {
      setSyncing(null);
    }
  }

  async function toggleActive(config: ShopifyConfig) {
    const { data } = await api.put<ShopifyConfig>(`/crm/shopify/${config.id}`, { active: !config.active });
    setConfigs(c => c.map(x => x.id === config.id ? data : x));
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Shopify Integration</h2>
          <p className="text-sm text-slate-500 mt-0.5">Connect client Shopify stores and sync orders automatically</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Connect Store
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card p-5 border-2 border-amber-400/30">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-500" /> Connect Shopify Store
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client *</label>
              <select className="select mt-1" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Store Display Name *</label>
              <input className="input mt-1" value={form.storeName} onChange={e => setForm(f => ({ ...f, storeName: e.target.value }))} placeholder="My Brand Store" />
            </div>
            <div>
              <label className="label">Shopify Store URL *</label>
              <input className="input mt-1" value={form.storeUrl} onChange={e => setForm(f => ({ ...f, storeUrl: e.target.value }))} placeholder="mystore.myshopify.com" />
              <p className="text-xs text-slate-400 mt-1">Without https:// — just the domain</p>
            </div>
            <div>
              <label className="label">Admin API Access Token *</label>
              <input className="input mt-1" type="password" value={form.accessToken} onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))} placeholder="shpat_…" />
              <p className="text-xs text-slate-400 mt-1">From Shopify Admin → Apps → Develop apps</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl text-xs text-blue-600 dark:text-blue-400">
            <strong>How to get Access Token:</strong> Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app → Configure Admin API scopes (read_orders, read_customers) → Install → Copy Admin API access token
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button onClick={addConfig} disabled={saving || !form.clientId || !form.storeName || !form.storeUrl || !form.accessToken}
              className="btn-primary px-6 py-2 text-sm flex items-center gap-2">
              {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Connecting…' : 'Connect Store'}
            </button>
          </div>
        </div>
      )}

      {/* Connected stores */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : configs.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No stores connected</p>
          <p className="text-xs mt-1">Connect a Shopify store to start syncing orders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const isSync = syncing === config.id;
            const result = syncResult?.id === config.id ? syncResult.result : null;
            return (
              <div key={config.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.active ? 'bg-green-500/10' : 'bg-slate-200 dark:bg-slate-700')}>
                      <Store className={cn('w-6 h-6', config.active ? 'text-green-600' : 'text-slate-400')} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{config.storeName}</h3>
                        <span className={cn('badge text-xs', config.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500')}>
                          {config.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">{config.storeUrl}</div>
                      {config.client && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{config.client.name}</div>}
                      {config.lastSyncAt && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Last sync: {new Date(config.lastSyncAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => sync(config)}
                      disabled={isSync}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
                    >
                      <RefreshCw className={cn('w-3.5 h-3.5', isSync && 'animate-spin')} />
                      {isSync ? 'Syncing…' : 'Sync Now'}
                    </button>
                    <button onClick={() => toggleActive(config)}
                      className="px-3 py-2 text-xs font-medium rounded-lg btn-secondary">
                      {config.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => deleteConfig(config.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sync result */}
                {result && (
                  <div className={cn(
                    'mt-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2',
                    'created' in result
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 text-red-600',
                  )}>
                    {'total' in result
                      ? <><CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> Synced {(result as SyncResult).total} orders · {(result as SyncResult).created} created · {(result as SyncResult).updated} updated</>
                      : <><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {result.message}</>
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Webhook info */}
      <div className="card p-5 border border-dashed border-slate-300 dark:border-slate-600">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Webhook Setup (Optional)</h3>
        <p className="text-sm text-slate-500 mb-3">For real-time order sync, configure Shopify webhooks to point to:</p>
        <code className="block bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-300">
          {window.location.origin.replace(':5173', ':5000')}/api/crm/shopify/webhook
        </code>
        <p className="text-xs text-slate-400 mt-2">Topics: orders/create · orders/updated · orders/cancelled</p>
      </div>
    </div>
  );
}
