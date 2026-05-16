import { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Upload, User } from 'lucide-react';
import { User as UserType, Role } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Full system access, manages all users' },
  { value: 'ADMIN', label: 'Admin', desc: 'Manages team members and agency data' },
  { value: 'MANAGER', label: 'Manager', desc: 'Views team, limited editing rights' },
  { value: 'TEAM_MEMBER', label: 'Team Member', desc: 'Access to own profile and tasks' },
];

interface Props {
  user: UserType | null;
  onClose: () => void;
  onSave: (data: Partial<UserType> & { password?: string }) => Promise<void>;
}

export default function UserModal({ user, onClose, onSave }: Props) {
  const { roleLevel } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!user;

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    role: (user?.role ?? 'TEAM_MEMBER') as Role,
    password: '',
    confirmPassword: '',
    avatar: user?.avatar ?? '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const ROLE_LEVEL: Record<Role, number> = {
    SUPER_ADMIN: 4, ADMIN: 3, MANAGER: 2, TEAM_MEMBER: 1,
  };

  const availableRoles = ROLES.filter(r => ROLE_LEVEL[r.value] <= roleLevel);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrors(err => ({ ...err, avatar: 'Image must be under 2MB' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('avatar', reader.result as string);
    reader.readAsDataURL(file);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!isEdit) {
      if (!form.password) errs.password = 'Password is required';
      else if (form.password.length < 8) errs.password = 'Minimum 8 characters';
      if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    } else if (form.password) {
      if (form.password.length < 8) errs.password = 'Minimum 8 characters';
      if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Partial<UserType> & { password?: string } = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        avatar: form.avatar || undefined,
      };
      if (form.password) payload.password = form.password;
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {isEdit ? 'Edit User' : 'Create New User'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEdit ? 'Update profile and settings' : 'Add a new team member to your agency'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ring-2 ring-amber-400/30"
              onClick={() => fileRef.current?.click()}
            >
              {form.avatar ? (
                <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                form.name ? form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : <User className="w-8 h-8" />
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload photo
              </button>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG · Max 2MB</p>
              {errors.avatar && <p className="text-xs text-red-500 mt-0.5">{errors.avatar}</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
          </div>

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input
                className={cn('input mt-1', errors.name && 'border-red-400 focus:ring-red-400')}
                placeholder="Ahmed Al-Rashid"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className={cn('input mt-1', errors.email && 'border-red-400 focus:ring-red-400')}
                placeholder="ahmed@stallion.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="label">Phone Number <span className="text-slate-400">(optional)</span></label>
            <input
              type="tel"
              className="input mt-1"
              placeholder="+212 600 000 000"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </div>

          {/* Role */}
          <div>
            <label className="label">Role *</label>
            <div className="mt-1 space-y-2">
              {availableRoles.map(r => (
                <label
                  key={r.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                    form.role === r.value
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={form.role === r.value}
                    onChange={() => set('role', r.value)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                {isEdit ? 'New Password' : 'Password *'}
                {isEdit && <span className="text-slate-400 ml-1">(leave blank to keep)</span>}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={cn('input pr-10', errors.password && 'border-red-400 focus:ring-red-400')}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="label">Confirm Password {!isEdit && '*'}</label>
              <div className="relative mt-1">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className={cn('input pr-10', errors.confirmPassword && 'border-red-400 focus:ring-red-400')}
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
          </div>

          {!isEdit && (
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
              Default password if left blank: <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">Stallion@123</span>
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
