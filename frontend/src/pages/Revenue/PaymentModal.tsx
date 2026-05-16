import { useEffect, useState, FormEvent, useRef } from 'react';
import { X, Upload, FileText, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Payment, Client, PaymentMethod, PaymentStatus } from '@/types';

const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'CHECK', 'PAYPAL', 'OTHER'];
const STATUSES: PaymentStatus[] = ['PAID', 'PENDING', 'OVERDUE'];

interface Props {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  clients: Client[];
  onSaved: () => void;
}

const defaultForm = {
  clientId: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  method: 'BANK_TRANSFER' as PaymentMethod,
  invoiceNumber: '',
  status: 'PENDING' as PaymentStatus,
  notes: '',
  pdfUrl: '',
};

export default function PaymentModal({ open, onClose, payment, clients, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (payment) {
      setForm({
        clientId: payment.clientId,
        amount: String(payment.amount),
        date: payment.date.split('T')[0],
        method: payment.method,
        invoiceNumber: payment.invoiceNumber || '',
        status: payment.status,
        notes: payment.notes || '',
        pdfUrl: payment.pdfUrl || '',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [payment, open]);

  function handlePdfFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('PDF must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, pdfUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }

  if (!open) return null;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        date: new Date(form.date).toISOString(),
        pdfUrl: form.pdfUrl || null,
      };
      if (payment) {
        await api.put(`/payments/${payment.id}`, payload);
      } else {
        await api.post('/payments', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {payment ? 'Edit Payment' : 'Record Payment'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Client *</label>
            <select className="select" required value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (MAD) *</label>
              <input className="input" type="number" required min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Method</label>
              <select className="select" value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
                {METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value as PaymentStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Invoice Number</label>
            <input className="input" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} placeholder="INV-2025-001" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes..." />
          </div>

          {/* PDF Invoice Upload */}
          <div>
            <label className="label">Invoice PDF <span className="text-slate-400 font-normal">(optional · max 10MB)</span></label>
            {form.pdfUrl ? (
              <div className="flex items-center gap-3 mt-1 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl">
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400 flex-1 truncate">PDF uploaded</span>
                <button type="button" onClick={() => { setForm(f => ({ ...f, pdfUrl: '' })); if (fileRef.current) fileRef.current.value = ''; }} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-1 flex items-center gap-2 px-4 py-2.5 w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
              >
                <Upload className="w-4 h-4" /> Click to upload PDF invoice
              </button>
            )}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfFile} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : payment ? 'Save Changes' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
