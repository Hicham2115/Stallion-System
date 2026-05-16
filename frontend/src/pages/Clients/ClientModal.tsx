import { useEffect, useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { Client, CompanyService, ClientStatus, BillingFrequency } from '@/types';

const STATUSES: { value: ClientStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ONE_TIME', label: 'One-Time' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const BILLING: BillingFrequency[] = ['MONTHLY', 'QUARTERLY', 'ANNUALLY'];

interface Props {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  onSaved: () => void;
}

const defaultForm = {
  name: '', service: '', monthlyFee: '',
  billingFrequency: 'MONTHLY' as BillingFrequency, status: 'ACTIVE' as ClientStatus,
  startDate: new Date().toISOString().split('T')[0], website: '', googleDriveLink: '',
  notes: '', contactPerson: '', email: '', phone: '',
};

export default function ClientModal({ open, onClose, client, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<CompanyService[]>('/services').then((r) => {
      setServices(r.data.filter((s) => s.active));
    });
  }, []);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        service: client.service,
        monthlyFee: String(client.monthlyFee),
        billingFrequency: client.billingFrequency,
        status: client.status,
        startDate: client.startDate.split('T')[0],
        website: client.website || '',
        googleDriveLink: client.googleDriveLink || '',
        notes: client.notes || '',
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone || '',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [client, open]);

  useEffect(() => {
    if (!client && services.length > 0 && !form.service) {
      setForm((f) => ({ ...f, service: services[0].slug }));
    }
  }, [services, client]);

  if (!open) return null;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        monthlyFee: parseFloat(form.monthlyFee),
        startDate: new Date(form.startDate).toISOString(),
      };
      if (client) {
        await api.put(`/clients/${client.id}`, payload);
      } else {
        await api.post('/clients', payload);
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {client ? 'Edit Client' : 'Add New Client'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Client Name *</label>
              <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Company or client name" />
            </div>
            <div>
              <label className="label">Service *</label>
              <select className="select" required value={form.service} onChange={(e) => set('service', e.target.value)}>
                <option value="">Select service...</option>
                {services.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value as ClientStatus)}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Monthly Fee (MAD) *</label>
              <input className="input" type="number" required min="0" step="0.01" value={form.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Billing Frequency</label>
              <select className="select" value={form.billingFrequency} onChange={(e) => set('billingFrequency', e.target.value as BillingFrequency)}>
                {BILLING.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Start Date *</label>
              <input className="input" type="date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" type="url" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="label">Contact Person *</label>
              <input className="input" required value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@company.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+966..." />
            </div>
            <div className="col-span-2">
              <label className="label">Google Drive Link</label>
              <input className="input" value={form.googleDriveLink} onChange={(e) => set('googleDriveLink', e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input min-h-20 resize-none" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes..." rows={3} />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={(e) => handleSubmit(e as any)}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : client ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
