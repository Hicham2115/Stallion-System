import { useEffect, useState, FormEvent } from 'react';
import { X, Plus } from 'lucide-react';
import api from '@/lib/api';
import { Lead, LeadStage, LeadSource, CompanyService, User } from '@/types';
import { formatDate } from '@/lib/utils';

const SOURCES: LeadSource[] = ['REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'COLD_OUTREACH', 'EVENT'];
const STAGES: LeadStage[] = ['NEW', 'WARMED', 'CLOSED_WON', 'CLOSED_LOST'];

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  users: User[];
  onSaved: () => void;
}

const defaultForm = {
  name: '', company: '', email: '', phone: '',
  service: '', expectedValue: '',
  source: 'REFERRAL' as LeadSource, stage: 'NEW' as LeadStage,
  assignedToId: '', notes: '', followUpDate: '',
};

export default function LeadModal({ open, onClose, lead, users, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [activities, setActivities] = useState<{ id: string; note: string; createdAt: string }[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'details' | 'activity'>('details');

  useEffect(() => {
    api.get<CompanyService[]>('/services').then((r) => {
      setServices(r.data.filter((s) => s.active));
    });
  }, []);

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name,
        company: lead.company || '',
        email: lead.email,
        phone: lead.phone || '',
        service: lead.service,
        expectedValue: lead.expectedValue ? String(lead.expectedValue) : '',
        source: lead.source,
        stage: lead.stage,
        assignedToId: lead.assignedToId || '',
        notes: lead.notes || '',
        followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
      });
      fetchActivities();
    } else {
      setForm(defaultForm);
      setActivities([]);
    }
    setError('');
    setTab('details');
  }, [lead, open]);

  useEffect(() => {
    if (!lead && services.length > 0 && !form.service) {
      setForm((f) => ({ ...f, service: services[0].slug }));
    }
  }, [services, lead]);

  const fetchActivities = async () => {
    if (!lead) return;
    const { data } = await api.get<Lead>(`/leads/${lead.id}`);
    setActivities((data.activities || []) as any);
  };

  if (!open) return null;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        expectedValue: form.expectedValue ? parseFloat(form.expectedValue) : null,
        assignedToId: form.assignedToId || null,
        followUpDate: form.followUpDate || null,
      };
      if (lead) {
        await api.put(`/leads/${lead.id}`, payload);
      } else {
        await api.post('/leads', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!lead || !newNote.trim()) return;
    await api.post(`/leads/${lead.id}/activities`, { note: newNote });
    setNewNote('');
    fetchActivities();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{lead ? `${lead.name}` : 'Add Lead'}</h2>
            {lead && <p className="text-xs text-slate-400">{lead.company}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        {lead && (
          <div className="flex gap-1 px-6 pt-3">
            {(['details', 'activity'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700'}`}
              >{t}</button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'details' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Lead Name *</label>
                  <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <label className="label">Company</label>
                  <input className="input" value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Company name" />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input className="input" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@company.com" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+966..." />
                </div>
                <div>
                  <label className="label">Service *</label>
                  <select className="select" required value={form.service} onChange={(e) => set('service', e.target.value)}>
                    <option value="">Select service...</option>
                    {services.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Expected Value (MAD)</label>
                  <input className="input" type="number" min="0" value={form.expectedValue} onChange={(e) => set('expectedValue', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="label">Source</label>
                  <select className="select" value={form.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
                    {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Stage</label>
                  <select className="select" value={form.stage} onChange={(e) => set('stage', e.target.value as LeadStage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Assigned To</label>
                  <select className="select" value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Follow-up Date</label>
                  <input className="input" type="date" value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notes about this lead..." />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : lead ? 'Save Changes' : 'Add Lead'}</button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note or activity..."
                  onKeyDown={(e) => e.key === 'Enter' && addNote()}
                />
                <button onClick={addNote} className="btn-primary shrink-0"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{a.note}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No activity yet</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
