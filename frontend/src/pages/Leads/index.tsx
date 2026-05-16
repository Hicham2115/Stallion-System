import { useEffect, useState } from 'react';
import { Plus, Search, LayoutGrid, List, AlertCircle, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { Lead, LeadStage, User } from '@/types';
import { formatCurrency, formatDate, getStatusColor, isOverdue, cn } from '@/lib/utils';
import LeadModal from './LeadModal';
import LeadCard from './LeadCard';

const STAGES: LeadStage[] = ['NEW', 'WARMED', 'CLOSED_WON', 'CLOSED_LOST'];

const STAGE_CONFIG: Record<LeadStage, { label: string; color: string; border: string }> = {
  NEW: { label: 'New', color: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800' },
  WARMED: { label: 'Warmed', color: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800' },
  CLOSED_WON: { label: 'Closed Won', color: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800' },
  CLOSED_LOST: { label: 'Closed Lost', color: 'bg-slate-50 dark:bg-slate-800/30', border: 'border-slate-200 dark:border-slate-700' },
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const [l, u] = await Promise.all([
      api.get<Lead[]>(`/leads?${params}`),
      api.get<{ users: User[] }>('/users?limit=100'),
    ]);
    setLeads(l.data);
    setUsers(u.data.users);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [search]);

  const moveStage = async (leadId: string, newStage: LeadStage) => {
    await api.put(`/leads/${leadId}`, { stage: newStage });
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, stage: newStage } : l));
  };

  const deleteLead = async (leadId: string) => {
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    await api.delete(`/leads/${leadId}`);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  const byStage = (stage: LeadStage) => leads.filter((l) => l.stage === stage);

  const totalPipeline = leads
    .filter((l) => l.stage !== 'CLOSED_LOST')
    .reduce((s, l) => s + (l.expectedValue || 0), 0);

  const staleLeads = leads.filter((l) =>
    l.followUpDate && isOverdue(l.followUpDate) && !['CLOSED_WON', 'CLOSED_LOST'].includes(l.stage)
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {leads.length} leads · Pipeline: {formatCurrency(totalPipeline)}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {staleLeads > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {staleLeads} lead{staleLeads > 1 ? 's' : ''} with overdue follow-up dates
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button onClick={() => setView('board')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', view === 'board' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500')}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', view === 'list' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500')}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : view === 'board' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const stageLeads = byStage(stage);
            const stageValue = stageLeads.reduce((s, l) => s + (l.expectedValue || 0), 0);
            const cfg = STAGE_CONFIG[stage];
            return (
              <div key={stage} className={cn('rounded-xl border-2 flex flex-col', cfg.color, cfg.border)} style={{ minHeight: 400 }}>
                <div className="px-4 py-3 border-b border-current border-opacity-10">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{cfg.label}</span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                  </div>
                  {stageValue > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatCurrency(stageValue)}</div>
                  )}
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  {stageLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onEdit={() => { setEditing(lead); setModalOpen(true); }}
                      onDelete={deleteLead}
                      onMoveStage={moveStage}
                      stages={STAGES}
                    />
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">No leads here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Lead', 'Company', 'Service', 'Value', 'Source', 'Stage', 'Follow-up', 'Assigned', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{lead.name}</div>
                      <div className="text-xs text-slate-400">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.company || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{lead.service?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{lead.expectedValue ? formatCurrency(lead.expectedValue) : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{lead.source?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', getStatusColor(lead.stage))}>{lead.stage.replace(/_/g, ' ')}</span>
                    </td>
                    <td className={cn('px-4 py-3 text-sm', lead.followUpDate && isOverdue(lead.followUpDate) ? 'text-red-500' : 'text-slate-500')}>
                      {lead.followUpDate ? formatDate(lead.followUpDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{lead.assignedTo?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditing(lead); setModalOpen(true); }} className="text-xs text-blue-500 hover:underline">Edit</button>
                        <button onClick={() => deleteLead(lead.id)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete lead">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-400">No leads found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadModal open={modalOpen} onClose={() => setModalOpen(false)} lead={editing} users={users} onSaved={fetchAll} />
    </div>
  );
}
