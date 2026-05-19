import { useState, useRef, useEffect } from 'react';
import {
  User, Mail, Phone, Lock, Upload, Eye, EyeOff,
  Check, Camera, Shield, Clock, Calendar,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { cn, formatDate, formatRelativeTime, getInitials } from '@/lib/utils';
import { Role } from '@/types';

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  TEAM_MEMBER: 'Team Member',
};

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TEAM_MEMBER: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

type Tab = 'info' | 'security';
type Toast = { message: string; type: 'success' | 'error' };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('info');
  const [toast, setToast] = useState<Toast | null>(null);

  // Info form
  const [info, setInfo] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    avatar: user?.avatar ?? '',
  });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});

  // Password form
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setInfo({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      avatar: user.avatar ?? '',
    });
  }, [user?.id, user?.name, user?.email, user?.phone, user?.avatar]);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setInfo(f => ({ ...f, avatar: reader.result as string }));
    reader.readAsDataURL(file);
  }

  function validateInfo() {
    const errs: Record<string, string> = {};
    if (!info.name.trim()) errs.name = 'Name is required';
    if (!info.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) errs.email = 'Invalid email';
    setInfoErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!validateInfo()) return;
    setInfoSaving(true);
    try {
      const { data } = await api.put('/auth/profile', {
        name: info.name.trim(),
        phone: info.phone.trim() || undefined,
        avatar: info.avatar || undefined,
      });
      updateUser({ ...user!, ...data });
      showToast('Profile updated successfully');
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setInfoSaving(false);
    }
  }

  function validatePwd() {
    const errs: Record<string, string> = {};
    if (!pwd.current) errs.current = 'Current password is required';
    if (!pwd.next) errs.next = 'New password is required';
    else if (pwd.next.length < 8) errs.next = 'Minimum 8 characters';
    if (pwd.next !== pwd.confirm) errs.confirm = 'Passwords do not match';
    setPwdErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePwd()) return;
    setPwdSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: pwd.current,
        newPassword: pwd.next,
      });
      setPwd({ current: '', next: '', confirm: '' });
      showToast('Password changed successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Failed to change password', 'error');
    } finally {
      setPwdSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 w-full">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2',
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your personal information and security settings</p>
      </div>

      {/* Profile card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-3xl font-bold overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ring-4 ring-amber-400/20"
              onClick={() => fileRef.current?.click()}
            >
              {info.avatar
                ? <img src={info.avatar} alt={user.name} className="w-full h-full object-cover" />
                : getInitials(user.name)
              }
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-500 hover:bg-amber-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
          </div>

          {/* Info */}
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user.name}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{user.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className={cn('badge text-xs', ROLE_COLORS[user.role])}>
                <Shield className="w-3 h-3 mr-1" />
                {ROLE_LABELS[user.role]}
              </span>
              <span className="badge text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <Check className="w-3 h-3 mr-1" />
                Active
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500 justify-center sm:justify-start">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Joined {formatDate(user.createdAt)}
              </span>
              {user.lastLogin && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last login {formatRelativeTime(user.lastLogin)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {([['info', 'Personal Info'], ['security', 'Security']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Personal Info Tab */}
      {tab === 'info' && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Personal Information</h3>
          <form onSubmit={saveInfo} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Full Name *</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className={cn('input pl-9', infoErrors.name && 'border-red-400')}
                    value={info.name}
                    onChange={e => { setInfo(f => ({ ...f, name: e.target.value })); setInfoErrors(e2 => ({ ...e2, name: '' })); }}
                    placeholder="Your full name"
                  />
                </div>
                {infoErrors.name && <p className="text-xs text-red-500 mt-1">{infoErrors.name}</p>}
              </div>
              <div>
                <label className="label">Email Address *</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    className={cn('input pl-9', infoErrors.email && 'border-red-400')}
                    value={info.email}
                    disabled
                    title="Email cannot be changed here"
                    placeholder="your@email.com"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Contact an admin to change your email</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Phone Number <span className="text-slate-400">(optional)</span></label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    className="input pl-9"
                    value={info.phone}
                    onChange={e => setInfo(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+212 600 000 000"
                  />
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <div className="relative mt-1">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    className="input pl-9 appearance-none cursor-not-allowed opacity-80"
                    value={user.role}
                    disabled
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Avatar preview if changed */}
            {info.avatar && info.avatar !== user.avatar && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
                <img src={info.avatar} alt="New avatar" className="w-10 h-10 rounded-lg object-cover" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">New photo selected</p>
                  <button
                    type="button"
                    onClick={() => setInfo(f => ({ ...f, avatar: user.avatar ?? '' }))}
                    className="text-xs text-amber-600 dark:text-amber-500 underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={infoSaving}
                className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
              >
                {infoSaving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                  : <><Upload className="w-3.5 h-3.5" />Save Changes</>
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Change Password</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Choose a strong password with at least 8 characters</p>
          <form onSubmit={savePassword} className="space-y-5">
            {(
              [
                { key: 'current', label: 'Current Password', placeholder: 'Enter your current password' },
                { key: 'next', label: 'New Password', placeholder: 'Min. 8 characters' },
                { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat your new password' },
              ] as { key: 'current' | 'next' | 'confirm'; label: string; placeholder: string }[]
            ).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="label">{label} *</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPwd[key] ? 'text' : 'password'}
                    className={cn('input pl-9 pr-10', pwdErrors[key] && 'border-red-400')}
                    value={pwd[key]}
                    onChange={e => { setPwd(p => ({ ...p, [key]: e.target.value })); setPwdErrors(e2 => ({ ...e2, [key]: '' })); }}
                    placeholder={placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwdErrors[key] && <p className="text-xs text-red-500 mt-1">{pwdErrors[key]}</p>}
              </div>
            ))}

            {/* Password strength hints */}
            {pwd.next && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { ok: pwd.next.length >= 8, label: 'At least 8 characters' },
                  { ok: /[A-Z]/.test(pwd.next), label: 'Uppercase letter' },
                  { ok: /[0-9]/.test(pwd.next), label: 'Number' },
                  { ok: /[^A-Za-z0-9]/.test(pwd.next), label: 'Special character' },
                ].map(({ ok, label }) => (
                  <div key={label} className={cn('flex items-center gap-1.5', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', ok ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')} />
                    {label}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={pwdSaving}
                className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
              >
                {pwdSaving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Changing…</>
                  : <><Lock className="w-3.5 h-3.5" />Change Password</>
                }
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
