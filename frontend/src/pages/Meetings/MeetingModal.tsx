import { useEffect, useState, FormEvent } from 'react';
import { X, Link, Video } from 'lucide-react';
import api from '@/lib/api';
import { Meeting, MeetingType, MeetingStatus } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  onSaved: () => void;
}

const STATUSES: { value: MeetingStatus; label: string; color: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-slate-100 text-slate-700' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  { value: 'RESCHEDULED', label: 'Rescheduled', color: 'bg-amber-100 text-amber-700' },
];

const TIMEZONES = ['Africa/Casablanca', 'Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai'];

export default function MeetingModal({ open, onClose, meeting, onSaved }: Props) {
  const [form, setForm] = useState({
    title: '', description: '', clientId: '', adminId: '', meetingTypeId: '',
    meetingLink: '', startDate: '', startTime: '', durationMin: 30,
    timezone: 'Africa/Casablanca', status: 'SCHEDULED' as MeetingStatus,
    notes: '', internalNotes: '', cancelReason: '',
  });
  const [types, setTypes] = useState<MeetingType[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<MeetingType[]>('/meetings/types').then(r => setTypes(r.data)).catch(() => {});
    api.get<{ id: string; name: string }[]>('/clients?archived=false').then(r => setClients(r.data)).catch(() => {});
    api.get<{ id: string; name: string; role: string }[]>('/users').then(r =>
      setAdmins(r.data.filter(u => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(u.role)))
    ).catch(() => {});
  }, []);

  useEffect(() => {
    if (meeting) {
      const start = new Date(meeting.startTime);
      const end = new Date(meeting.endTime);
      const dur = Math.round((end.getTime() - start.getTime()) / 60000);
      setForm({
        title: meeting.title,
        description: meeting.description || '',
        clientId: meeting.clientId || '',
        adminId: meeting.adminId,
        meetingTypeId: meeting.meetingTypeId || '',
        meetingLink: meeting.meetingLink || '',
        startDate: start.toISOString().split('T')[0],
        startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
        durationMin: dur,
        timezone: meeting.timezone,
        status: meeting.status,
        notes: meeting.notes || '',
        internalNotes: meeting.internalNotes || '',
        cancelReason: meeting.cancelReason || '',
      });
    } else {
      const now = new Date();
      setForm({
        title: '', description: '', clientId: '', adminId: '', meetingTypeId: '',
        meetingLink: '', startDate: now.toISOString().split('T')[0],
        startTime: '10:00', durationMin: 30,
        timezone: 'Africa/Casablanca', status: 'SCHEDULED',
        notes: '', internalNotes: '', cancelReason: '',
      });
    }
    setError('');
  }, [meeting, open]);

  if (!open) return null;

  const set = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const [sh, sm] = form.startTime.split(':').map(Number);
      const startDt = new Date(`${form.startDate}T00:00:00`);
      startDt.setHours(sh, sm, 0, 0);
      const endDt = new Date(startDt.getTime() + form.durationMin * 60000);
      const payload = {
        title: form.title, description: form.description || null,
        clientId: form.clientId || null, adminId: form.adminId,
        meetingTypeId: form.meetingTypeId || null,
        meetingLink: form.meetingLink || null,
        startTime: startDt.toISOString(), endTime: endDt.toISOString(),
        timezone: form.timezone, status: form.status,
        notes: form.notes || null, internalNotes: form.internalNotes || null,
        cancelReason: form.cancelReason || null,
      };
      if (meeting) await api.put(`/meetings/${meeting.id}`, payload);
      else await api.post('/meetings', payload);
      onSaved(); onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Something went wrong');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {meeting ? 'Edit Meeting' : 'Schedule Meeting'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Meeting Title *</label>
            <input className="input" required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Strategy Call" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Meeting Type</label>
              <select className="select" value={form.meetingTypeId} onChange={e => {
                set('meetingTypeId', e.target.value);
                const t = types.find(x => x.id === e.target.value);
                if (t) set('durationMin', t.duration);
              }}>
                <option value="">— No type —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.duration}m)</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value as MeetingStatus)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client</label>
              <select className="select" value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                <option value="">— No client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Assigned To *</label>
              <select className="select" required value={form.adminId} onChange={e => set('adminId', e.target.value)}>
                <option value="">— Select admin —</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" required value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Start Time *</label>
              <input className="input" type="time" required value={form.startTime} onChange={e => set('startTime', e.target.value)} />
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <select className="select" value={form.durationMin} onChange={e => set('durationMin', Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Timezone</label>
              <select className="select" value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Meeting Link</label>
              <div className="relative">
                <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="input pl-9" value={form.meetingLink} onChange={e => set('meetingLink', e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Meeting agenda or description..." />
          </div>

          <div>
            <label className="label">Notes (shared with client)</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes visible to client..." />
          </div>

          <div>
            <label className="label">Internal Notes</label>
            <textarea className="input resize-none" rows={2} value={form.internalNotes} onChange={e => set('internalNotes', e.target.value)} placeholder="Internal team notes..." />
          </div>

          {form.status === 'CANCELLED' && (
            <div>
              <label className="label">Cancellation Reason</label>
              <input className="input" value={form.cancelReason} onChange={e => set('cancelReason', e.target.value)} placeholder="Reason for cancellation..." />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : meeting ? 'Save Changes' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
