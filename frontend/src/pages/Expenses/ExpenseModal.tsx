import { useEffect, useState, FormEvent } from 'react';
import { X, CheckCircle, Clock } from 'lucide-react';
import api from '@/lib/api';
import { Expense, ExpenseCategory, ExpenseType, ExpensePaymentStatus, PaymentMethod } from '@/types';
import { getCategoryLabel, cn } from '@/lib/utils';

const CATEGORIES: ExpenseCategory[] = ['RENT', 'SALARIES', 'SOFTWARE_SUBSCRIPTIONS', 'INSURANCE', 'ADS_SPEND', 'FREELANCERS', 'EQUIPMENT', 'TRAVEL', 'MISC'];
const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'CHECK', 'PAYPAL', 'OTHER'];

interface Props {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  onSaved: () => void;
}

const defaultForm = {
  name: '',
  category: 'MISC' as ExpenseCategory,
  type: 'VARIABLE' as ExpenseType,
  amount: '',
  date: new Date().toISOString().split('T')[0],
  method: 'BANK_TRANSFER' as PaymentMethod,
  notes: '',
  recurring: false,
  paymentStatus: 'PENDING' as ExpensePaymentStatus,
};

export default function ExpenseModal({ open, onClose, expense, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expense) {
      setForm({
        name: expense.name,
        category: expense.category,
        type: expense.type,
        amount: String(expense.amount),
        date: expense.date.split('T')[0],
        method: expense.method || 'BANK_TRANSFER',
        notes: expense.notes || '',
        recurring: expense.recurring,
        paymentStatus: expense.paymentStatus || 'PENDING',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [expense, open]);

  if (!open) return null;

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (expense) {
        await api.put(`/expenses/${expense.id}`, payload);
      } else {
        await api.post('/expenses', payload);
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{expense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Expense Name *</label>
            <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Adobe Creative Cloud" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select className="select" value={form.category} onChange={(e) => set('category', e.target.value as ExpenseCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="select" value={form.type} onChange={(e) => set('type', e.target.value as ExpenseType)}>
                <option value="FIXED">Fixed</option>
                <option value="VARIABLE">Variable</option>
              </select>
            </div>
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
          <div>
            <label className="label">Payment Method</label>
            <select className="select" value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
              {METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Payment status toggle */}
          <div>
            <label className="label">Payment Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => set('paymentStatus', 'PENDING')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-all',
                  form.paymentStatus === 'PENDING'
                    ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-900/20 dark:border-amber-500 dark:text-amber-400'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                )}
              >
                <Clock className="w-4 h-4" />
                Pending
              </button>
              <button
                type="button"
                onClick={() => set('paymentStatus', 'PAID')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-all',
                  form.paymentStatus === 'PAID'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-400'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'
                )}
              >
                <CheckCircle className="w-4 h-4" />
                Paid
              </button>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.recurring} onChange={(e) => set('recurring', e.target.checked)} className="w-4 h-4 accent-amber-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Recurring expense</span>
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : expense ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
