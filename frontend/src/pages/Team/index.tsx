import { useState, useEffect, useCallback } from 'react';
import {
  Search, UserPlus, MoreVertical, Edit, KeyRound, ShieldOff,
  ShieldCheck, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  Users, UserCheck, UserX, Shield,
} from 'lucide-react';
import api from '@/lib/api';
import { User, Role, UsersResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { cn, getInitials, formatDate, formatRelativeTime } from '@/lib/utils';
import UserModal from './UserModal';

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  TEAM_MEMBER: 'Team Member',
};

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TEAM_MEMBER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

type Toast = { id: number; message: string; type: 'success' | 'error' };
type ConfirmAction = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
};

export default function TeamManagement() {
  const { user: me, isSuperAdmin, roleLevel } = useAuth();

  const [data, setData] = useState<UsersResponse>({ users: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalUser, setModalUser] = useState<User | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function toast(message: string, type: 'success' | 'error' = 'success') {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      const { data: res } = await api.get<UsersResponse>(`/users?${params}`);
      setData(res);
    } catch {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => setOpenMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  function canManage(target: User) {
    if (me?.id === target.id) return false;
    const targetLevel = { SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, TEAM_MEMBER: 1 }[target.role] ?? 0;
    return roleLevel >= targetLevel;
  }

  async function handleSaveUser(payload: Partial<User> & { password?: string }) {
    try {
      if (modalUser) {
        await api.put(`/users/${modalUser.id}`, payload);
        toast('User updated successfully');
      } else {
        await api.post('/users', payload);
        toast('User created successfully');
      }
      setModalUser(undefined);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg || 'Failed to save user', 'error');
      throw err;
    }
  }

  async function handleSuspend(user: User) {
    setConfirm({
      title: 'Suspend Account',
      message: `${user.name}'s account will be suspended. They won't be able to log in until reactivated.`,
      confirmLabel: 'Suspend',
      danger: true,
      onConfirm: async () => {
        await api.post(`/users/${user.id}/suspend`);
        toast(`${user.name} has been suspended`);
        fetchUsers();
      },
    });
  }

  async function handleActivate(user: User) {
    await api.post(`/users/${user.id}/activate`);
    toast(`${user.name} has been activated`);
    fetchUsers();
  }

  async function handleDelete(user: User) {
    setConfirm({
      title: 'Delete User',
      message: `Permanently delete ${user.name}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await api.delete(`/users/${user.id}`);
        toast(`${user.name} has been deleted`);
        fetchUsers();
      },
    });
  }

  async function handleResetPassword() {
    if (!resetModal) return;
    try {
      const { data: res } = await api.post<{ message: string; tempPassword: string }>(
        `/users/${resetModal.id}/reset-password`,
        { newPassword: newPwd || undefined },
      );
      toast(`Password reset. Temp: ${res.tempPassword}`);
      setResetModal(null);
      setNewPwd('');
    } catch {
      toast('Failed to reset password', 'error');
    }
  }

  const stats = {
    total: data.total,
    active: data.users.filter(u => u.active && !u.suspended).length,
    suspended: data.users.filter(u => u.suspended).length,
    admins: data.users.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
  };

  function userStatus(u: User) {
    if (!u.active) return { label: 'Inactive', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
    if (u.suspended) return { label: 'Suspended', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
    return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-in slide-in-from-bottom-2 duration-300',
            t.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white',
          )}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage team members, roles, and access permissions
          </p>
        </div>
        <button
          onClick={() => setModalUser(null)}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Users', value: data.total, color: 'text-blue-500' },
          { icon: UserCheck, label: 'Active', value: stats.active, color: 'text-emerald-500' },
          { icon: UserX, label: 'Suspended', value: stats.suspended, color: 'text-red-500' },
          { icon: Shield, label: 'Admins', value: stats.admins, color: 'text-amber-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800', color)}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select min-w-[140px]"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="TEAM_MEMBER">Team Member</option>
        </select>
        <select
          className="select min-w-[140px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        <button onClick={fetchUsers} className="btn-secondary p-2.5" title="Refresh">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden lg:table-cell">Last Login</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No users found</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                data.users.map(u => {
                  const status = userStatus(u);
                  const isMe = u.id === me?.id;
                  const manageable = canManage(u);
                  return (
                    <tr key={u.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors', isMe && 'bg-amber-50/40 dark:bg-amber-900/10')}>
                      {/* User cell */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : getInitials(u.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                              {isMe && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">You</span>}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                            {u.phone && <div className="text-xs text-slate-400 dark:text-slate-500">{u.phone}</div>}
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs', ROLE_COLORS[u.role])}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs', status.cls)}>{status.label}</span>
                      </td>
                      {/* Joined */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        {formatDate(u.createdAt)}
                      </td>
                      {/* Last login */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        {u.lastLogin ? formatRelativeTime(u.lastLogin) : <span className="text-slate-300 dark:text-slate-600">Never</span>}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        {manageable && (
                          <div className="relative flex justify-end" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openMenu === u.id && (
                              <div className="absolute right-0 top-8 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                                <button
                                  onClick={() => { setModalUser(u); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <Edit className="w-4 h-4 text-slate-400" /> Edit User
                                </button>
                                <button
                                  onClick={() => { setResetModal(u); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <KeyRound className="w-4 h-4 text-slate-400" /> Reset Password
                                </button>
                                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                                {u.suspended ? (
                                  <button
                                    onClick={() => { handleActivate(u); setOpenMenu(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                  >
                                    <ShieldCheck className="w-4 h-4" /> Activate Account
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { handleSuspend(u); setOpenMenu(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                  >
                                    <ShieldOff className="w-4 h-4" /> Suspend Account
                                  </button>
                                )}
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => { handleDelete(u); setOpenMenu(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete User
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, data.total)} of {data.total} users
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 dark:text-slate-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {[...Array(data.pages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                    page === i + 1
                      ? 'bg-amber-500 text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 dark:text-slate-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit User Modal */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onClose={() => setModalUser(undefined)}
          onSave={handleSaveUser}
        />
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetModal(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Reset Password</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Set a new password for <span className="font-medium text-slate-700 dark:text-slate-300">{resetModal.name}</span>
              </p>
            </div>
            <div>
              <label className="label">New Password <span className="text-slate-400">(optional)</span></label>
              <input
                type="text"
                className="input mt-1 w-full"
                placeholder="Leave blank for Stallion@123"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Default: <span className="font-mono text-amber-600 dark:text-amber-400">Stallion@123</span></p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setResetModal(null); setNewPwd(''); }} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
              <button onClick={handleResetPassword} className="btn-primary flex-1 py-2 text-sm">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mx-auto',
              confirm.danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
            )}>
              {confirm.danger
                ? <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                : <ShieldOff className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              }
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{confirm.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{confirm.message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="btn-secondary flex-1 py-2 text-sm" disabled={confirmLoading}>Cancel</button>
              <button
                onClick={async () => {
                  setConfirmLoading(true);
                  try { await confirm.onConfirm(); setConfirm(null); }
                  catch { toast('Action failed', 'error'); }
                  finally { setConfirmLoading(false); }
                }}
                disabled={confirmLoading}
                className={cn('flex-1 py-2 text-sm rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60',
                  confirm.danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary',
                )}
              >
                {confirmLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
