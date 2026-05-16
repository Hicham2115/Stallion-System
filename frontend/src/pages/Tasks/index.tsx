import { useEffect, useState } from 'react';
import { Plus, Search, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { Task, TaskStatus, User, Client } from '@/types';
import { formatDate, getPriorityColor, getStatusColor, isOverdue, cn } from '@/lib/utils';
import TaskModal from './TaskModal';
import TaskCard from './TaskCard';
import { useAuth } from '@/context/AuthContext';

const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; border: string }> = {
  TODO: { label: 'To Do', color: 'bg-slate-50 dark:bg-slate-800/30', border: 'border-slate-200 dark:border-slate-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800' },
  REVIEW: { label: 'Review', color: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800' },
};

export default function Tasks() {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (assigneeFilter) params.set('assignedToId', assigneeFilter);
    const [t, u, c] = await Promise.all([
      api.get<Task[]>(`/tasks?${params}`),
      api.get<{ users: User[] }>('/users?limit=100'),
      api.get<Client[]>('/clients?archived=false'),
    ]);
    setTasks(t.data);
    setUsers(u.data.users);
    setClients(c.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [search, statusFilter, priorityFilter, assigneeFilter]);

  const updateStatus = async (taskId: string, newStatus: TaskStatus) => {
    await api.put(`/tasks/${taskId}`, { status: newStatus });
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
  const overdueTasks = tasks.filter((t) => t.dueDate && isOverdue(t.dueDate) && t.status !== 'COMPLETED').length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{tasks.length} total tasks</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {overdueTasks > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {overdueTasks} overdue task{overdueTasks > 1 ? 's' : ''}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select w-auto min-w-28" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className="select w-auto min-w-28" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All Priorities</option>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {isAdmin && (
          <select className="select w-auto min-w-32" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">All Members</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map((status) => {
            const statusTasks = byStatus(status);
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className={cn('rounded-xl border-2 flex flex-col', cfg.color, cfg.border)} style={{ minHeight: 360 }}>
                <div className="px-4 py-3 border-b border-current border-opacity-10 flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white text-sm">{cfg.label}</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full">{statusTasks.length}</span>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  {statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => { setEditing(task); setModalOpen(true); }}
                      onStatusChange={updateStatus}
                      statuses={STATUSES}
                    />
                  ))}
                  {statusTasks.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">No tasks here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Task', 'Client', 'Assigned To', 'Priority', 'Due Date', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => {
                  const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'COMPLETED';
                  return (
                    <tr key={task.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/30', overdue && 'bg-red-50/50 dark:bg-red-900/10')}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{task.title}</div>
                        {task.description && <div className="text-xs text-slate-400 truncate max-w-48">{task.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{task.client?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{task.assignedTo?.name || 'Unassigned'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge', getPriorityColor(task.priority))}>{task.priority}</span>
                      </td>
                      <td className={cn('px-4 py-3 text-sm', overdue ? 'text-red-500 font-medium' : 'text-slate-500')}>
                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge', getStatusColor(task.status))}>{task.status.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setEditing(task); setModalOpen(true); }} className="text-xs text-blue-500 hover:underline">Edit</button>
                      </td>
                    </tr>
                  );
                })}
                {tasks.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">No tasks found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TaskModal open={modalOpen} onClose={() => setModalOpen(false)} task={editing} users={users} clients={clients} onSaved={fetchAll} />
    </div>
  );
}
