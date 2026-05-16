import { useEffect, useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { CrmOrder, Client, User, OrderStatus, OrderPaymentStatus, OrderSource } from '@/types';
import { cn } from '@/lib/utils';

function useAssignedClosers(clientId: string, allUsers: User[]) {
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!clientId) { setAssignedIds(new Set()); return; }
    api.get<User[]>(`/clients/${clientId}/closers`)
      .then(({ data }) => setAssignedIds(new Set(data.map(u => u.id))))
      .catch(() => setAssignedIds(new Set()));
  }, [clientId]);

  const filtered = assignedIds.size > 0 ? allUsers.filter(u => assignedIds.has(u.id)) : allUsers;
  return { filtered, hasAssigned: assignedIds.size > 0 };
}

const STATUSES: OrderStatus[] = ['NEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'NO_ANSWER', 'CANCELLED', 'REFUSED', 'SHIPPED', 'DELIVERED', 'RETURNED'];
const PAYMENT_STATUSES: OrderPaymentStatus[] = ['COD_PENDING', 'PAID', 'REFUNDED'];
const SOURCES: OrderSource[] = ['FACEBOOK_ADS', 'TIKTOK_ADS', 'GOOGLE_ADS', 'ORGANIC', 'WHATSAPP', 'INSTAGRAM', 'OTHER'];

interface Props {
  order: CrmOrder | null;
  clients: Client[];
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}

const defaultForm = {
  clientId: '', closerId: '', customerName: '', customerPhone: '', customerCity: '',
  productName: '', quantity: '1', orderAmount: '', productCost: '0', shippingCost: '0',
  adCost: '0', status: 'NEW' as OrderStatus, paymentStatus: 'COD_PENDING' as OrderPaymentStatus,
  source: 'OTHER' as OrderSource, notes: '', closerNotes: '',
};

export default function OrderModal({ order, clients, users, onClose, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { filtered: availableClosers, hasAssigned } = useAssignedClosers(form.clientId, users);

  useEffect(() => {
    if (order) {
      setForm({
        clientId: order.clientId, closerId: order.closerId || '',
        customerName: order.customerName, customerPhone: order.customerPhone || '',
        customerCity: order.customerCity || '', productName: order.productName,
        quantity: String(order.quantity), orderAmount: String(order.orderAmount),
        productCost: String(order.productCost), shippingCost: String(order.shippingCost),
        adCost: String(order.adCost), status: order.status, paymentStatus: order.paymentStatus,
        source: order.source, notes: order.notes || '', closerNotes: order.closerNotes || '',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [order]);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.customerName || !form.productName || !form.orderAmount) {
      setError('Client, customer name, product, and amount are required'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        closerId: form.closerId || null,
        quantity: Number(form.quantity),
        orderAmount: Number(form.orderAmount),
        productCost: Number(form.productCost),
        shippingCost: Number(form.shippingCost),
        adCost: Number(form.adCost),
      };
      if (order) {
        await api.put(`/crm/orders/${order.id}`, payload);
      } else {
        await api.post('/crm/orders', payload);
      }
      onSaved(); onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  }

  const netProfit = (Number(form.orderAmount) || 0) - (Number(form.productCost) || 0) -
    (Number(form.shippingCost) || 0) - (Number(form.adCost) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {order ? 'Edit Order' : 'New Order'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Client & Closer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client *</label>
              <select className="select mt-1" value={form.clientId} onChange={e => set('clientId', e.target.value)} required>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">
                Closer / Agent
                {hasAssigned && <span className="ml-1 text-[10px] text-amber-500 font-normal">(assigned only)</span>}
              </label>
              <select className="select mt-1" value={form.closerId} onChange={e => set('closerId', e.target.value)}>
                <option value="">Unassigned</option>
                {availableClosers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input className="input mt-1" value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Mohamed Alami" required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input mt-1" value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} placeholder="+212 6…" />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input mt-1" value={form.customerCity} onChange={e => set('customerCity', e.target.value)} placeholder="Casablanca" />
            </div>
          </div>

          {/* Product */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product Name *</label>
              <input className="input mt-1" value={form.productName} onChange={e => set('productName', e.target.value)} placeholder="Product name" required />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className="input mt-1" type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Order Amount *</label>
              <input className="input mt-1" type="number" step="0.01" value={form.orderAmount} onChange={e => set('orderAmount', e.target.value)} placeholder="0" required />
            </div>
            <div>
              <label className="label">Product Cost</label>
              <input className="input mt-1" type="number" step="0.01" value={form.productCost} onChange={e => set('productCost', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Shipping Cost</label>
              <input className="input mt-1" type="number" step="0.01" value={form.shippingCost} onChange={e => set('shippingCost', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="label">Ad Cost</label>
              <input className="input mt-1" type="number" step="0.01" value={form.adCost} onChange={e => set('adCost', e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Net profit preview */}
          <div className={cn('px-4 py-3 rounded-xl text-sm font-semibold', netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/10 text-red-600')}>
            Estimated Net Profit: {netProfit.toFixed(2)} MAD
            <span className="text-xs font-normal ml-2 opacity-70">(before commission)</span>
          </div>

          {/* Status & Source */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Order Status</label>
              <select className="select mt-1" value={form.status} onChange={e => set('status', e.target.value as OrderStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select className="select mt-1" value={form.paymentStatus} onChange={e => set('paymentStatus', e.target.value as OrderPaymentStatus)}>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <select className="select mt-1" value={form.source} onChange={e => set('source', e.target.value as OrderSource)}>
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Notes</label>
              <textarea className="input mt-1 resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes…" />
            </div>
            <div>
              <label className="label">Closer Notes</label>
              <textarea className="input mt-1 resize-none" rows={2} value={form.closerNotes} onChange={e => set('closerNotes', e.target.value)} placeholder="Agent notes…" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
          <button onClick={handleSubmit as any} disabled={saving} className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : order ? 'Save Changes' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
