import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import api from '@/lib/api';
import { MeetingType } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];
const DURATIONS = [15, 30, 45, 60, 90, 120];

type FormState = { name: string; duration: number; description: string; color: string };

export default function MeetingTypesManager() {
  const [types, setTypes] = useState<MeetingType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MeetingType | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', duration: 30, description: '', color: '#f59e0b' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get<MeetingType[]>('/meetings/types').then(r => setTypes(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', duration: 30, description: '', color: '#f59e0b' });
    setShowForm(true);
  };

  const openEdit = (t: MeetingType) => {
    setEditing(t);
    setForm({ name: t.name, duration: t.duration, description: t.description || '', color: t.color });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) await api.put(`/meetings/types/${editing.id}`, form);
      else await api.post('/meetings/types', form);
      await load();
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this meeting type?')) return;
    await api.delete(`/meetings/types/${id}`);
    setTypes(t => t.filter(x => x.id !== id));
  };

  const toggleActive = async (t: MeetingType) => {
    await api.put(`/meetings/types/${t.id}`, { active: !t.active });
    setTypes(prev => prev.map(x => x.id === t.id ? { ...x, active: !x.active } : x));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Meeting Types</h3>
          <p className="text-xs text-slate-500 mt-0.5">Define the types of meetings clients can book</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Type
        </button>
      </div>

      {showForm && (
        <div className="card p-5 border-2 border-amber-500/30">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-900 dark:text-white">{editing ? 'Edit Type' : 'New Meeting Type'}</h4>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Strategy Call" />
            </div>
            <div>
              <label className="label">Duration</label>
              <select className="select" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
          </div>
          <div className="mb-4">
            <label className="label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn('w-7 h-7 rounded-full border-2 transition-all', form.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map(t => (
          <div key={t.id} className={cn('card p-4 border-l-4 transition-all', !t.active && 'opacity-60')} style={{ borderLeftColor: t.color }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{t.name}</h4>
                </div>
                <p className="text-xs text-slate-500">{t.duration} minutes</p>
              </div>
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={t.active} onChange={() => toggleActive(t)} className="sr-only" />
                <div className={cn('w-8 h-4 rounded-full transition-colors relative', t.active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700')}>
                  <div className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all', t.active ? 'left-4.5' : 'left-0.5')} style={{ left: t.active ? '17px' : '2px' }} />
                </div>
              </label>
            </div>
            {t.description && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t.description}</p>}
            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => openEdit(t)} className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => handleDelete(t.id)} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        ))}
        {types.length === 0 && !showForm && (
          <div className="col-span-3 text-center py-10 text-slate-400 text-sm">
            No meeting types yet. Create one to allow clients to book meetings.
          </div>
        )}
      </div>
    </div>
  );
}
