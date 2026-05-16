import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Layers } from 'lucide-react';
import api from '@/lib/api';
import { CompanyService } from '@/types';
import { cn } from '@/lib/utils';

export default function ServicesSettings() {
  const [services, setServices] = useState<CompanyService[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyService | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CompanyService | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const fetch = async () => {
    setLoading(true);
    const { data } = await api.get<CompanyService[]>('/services');
    setServices(data);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (s: CompanyService) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '' });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, { name: form.name, description: form.description });
      } else {
        await api.post('/services', { name: form.name, description: form.description });
      }
      setModalOpen(false);
      fetch();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: CompanyService) => {
    await api.put(`/services/${s.id}`, { active: !s.active });
    fetch();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await api.delete(`/services/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetch();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Cannot delete this service');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage the services your agency offers to clients</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Layers className="w-10 h-10 mb-3 opacity-40" />
              <p className="font-medium">No services yet</p>
              <p className="text-sm mt-1">Add a service to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Service Name', 'Slug / Key', 'Description', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {services.map((s) => (
                  <tr key={s.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/30', !s.active && 'opacity-50')}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{s.slug}</code>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-48 truncate">{s.description || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(s)}
                        className={cn('flex items-center gap-1.5 text-xs font-medium transition-colors', s.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}
                      >
                        {s.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {s.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setDeleteTarget(s); setDeleteError(''); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editing ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Service Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Email Marketing"
                  autoFocus
                />
                {!editing && form.name && (
                  <p className="text-xs text-slate-400 mt-1">
                    Slug: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">
                      {form.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')}
                    </code>
                  </p>
                )}
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional short description..."
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Delete Service</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Delete <span className="font-medium text-slate-700 dark:text-slate-300">"{deleteTarget.name}"</span>? This cannot be undone.
                </p>
              </div>
            </div>
            {deleteError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
