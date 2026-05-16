import { useEffect, useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { Task, TaskStatus, Priority, User, Client } from '@/types';

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

interface Props {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  users: User[];
  clients: Client[];
  onSaved: () => void;
}

const defaultForm = {
  title: '',
  description: '',
  assignedToId: '',
  clientId: '',
  priority: 'MEDIUM' as Priority,
  dueDate: '',
  status: 'TODO' as TaskStatus,
  tags: '',
};

export default function TaskModal({ open, onClose, task, users, clients, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        assignedToId: task.assignedToId || '',
        clientId: task.clientId || '',
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        status: task.status,
        tags: (task.tags || []).join(', '),
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [task, open]);

  if (!open) return null;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        assignedToId: form.assignedToId || null,
        clientId: form.clientId || null,
        dueDate: form.dueDate || null,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      if (task) {
        await api.put(`/tasks/${task.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !confirm('Delete this task?')) return;
    await api.delete(`/tasks/${task.id}`);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{task ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input className="input" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Task title" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Details..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Assign To</label>
              <select className="select" value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Client</label>
              <select className="select" value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
                <option value="">No client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Due Date</label>
            <input className="input" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="e.g. seo, content, urgent" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          {task ? (
            <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600 font-medium">Delete task</button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={(e) => handleSubmit(e as any)} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
