import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save, Clock, User } from 'lucide-react';
import api from '@/lib/api';
import { AdminAvailability, BlockedDate } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMEZONES = ['Africa/Casablanca', 'Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai'];

type DaySlot = { enabled: boolean; startTime: string; endTime: string };

const DEFAULT_SLOTS: DaySlot[] = DAYS.map(() => ({ enabled: false, startTime: '09:00', endTime: '17:00' }));

export default function AvailabilitySettings() {
  const { user } = useAuth();

  const [admins, setAdmins] = useState<{ id: string; name: string; role: string }[]>([]);
  // Initialize immediately from the logged-in user so Save works before /users loads
  const [selectedAdminId, setSelectedAdminId] = useState(() => user?.id || '');

  const [timezone, setTimezone] = useState('Africa/Casablanca');
  const [slots, setSlots] = useState<DaySlot[]>(DEFAULT_SLOTS.map(s => ({ ...s })));
  const [blocked, setBlocked] = useState<BlockedDate[]>([]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Keep selectedAdminId in sync if user loads after mount
  useEffect(() => {
    if (user?.id && !selectedAdminId) setSelectedAdminId(user.id);
  }, [user?.id]);

  // Load admins list (non-blocking — Save works without it)
  useEffect(() => {
    api.get<{ id: string; name: string; role: string }[]>('/users').then(r => {
      const staffUsers = r.data.filter(u => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(u.role));
      setAdmins(staffUsers);
      // Only override if nothing is selected yet
      if (!selectedAdminId) {
        const me = staffUsers.find(u => u.id === user?.id);
        setSelectedAdminId(me?.id || staffUsers[0]?.id || user?.id || '');
      }
    }).catch(() => {
      // If /users fails, still fall back to current user — Save still works
      if (user?.id) setSelectedAdminId(uid => uid || user.id);
    });
  }, []);

  const loadAvailability = useCallback(async (adminId: string) => {
    if (!adminId) return;
    try {
      const [availRes, blockedRes] = await Promise.all([
        api.get<AdminAvailability[]>(`/meetings/availability?adminId=${adminId}`),
        api.get<BlockedDate[]>(`/meetings/blocked-dates?adminId=${adminId}`),
      ]);

      const fresh: DaySlot[] = DEFAULT_SLOTS.map(s => ({ ...s }));
      let tz = 'Africa/Casablanca';
      availRes.data.forEach(a => {
        fresh[a.dayOfWeek] = { enabled: true, startTime: a.startTime, endTime: a.endTime };
        tz = a.timezone;
      });
      setSlots(fresh);
      setTimezone(tz);
      setBlocked(blockedRes.data);
    } catch {
      setError('Failed to load availability');
    }
  }, []);

  useEffect(() => {
    if (selectedAdminId) loadAvailability(selectedAdminId);
  }, [selectedAdminId, loadAvailability]);

  const handleSave = async () => {
    const adminId = selectedAdminId || user?.id;
    if (!adminId) { setError('No admin selected'); return; }
    setSaving(true);
    setError('');
    try {
      const enabledSlots = slots
        .map((s, i) => s.enabled ? { dayOfWeek: i, startTime: s.startTime, endTime: s.endTime, timezone } : null)
        .filter(Boolean) as { dayOfWeek: number; startTime: string; endTime: string; timezone: string }[];
      await api.put('/meetings/availability', { adminId, slots: enabledSlots });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addBlockedDate = async () => {
    const adminId = selectedAdminId || user?.id;
    if (!newBlockDate || !adminId) return;
    try {
      const r = await api.post<BlockedDate>('/meetings/blocked-dates', {
        adminId: adminId,
        blockedDate: newBlockDate,
        reason: newBlockReason || null,
      });
      setBlocked(b => [...b, r.data]);
      setNewBlockDate('');
      setNewBlockReason('');
    } catch {
      setError('Failed to add blocked date');
    }
  };

  const removeBlockedDate = async (id: string) => {
    try {
      await api.delete(`/meetings/blocked-dates/${id}`);
      setBlocked(b => b.filter(x => x.id !== id));
    } catch {
      setError('Failed to remove blocked date');
    }
  };

  const selectedAdmin = admins.find(a => a.id === selectedAdminId);

  return (
    <div className="space-y-6">
      {/* Admin selector */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <User className="w-4.5 h-4.5 text-amber-500" />
          </div>
          <div className="flex-1">
            <label className="label mb-1">Managing availability for</label>
            <select
              className="select w-full sm:w-80"
              value={selectedAdminId}
              onChange={e => setSelectedAdminId(e.target.value)}
            >
              {admins.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.id === user?.id ? ' (You)' : ''} — {a.role.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Weekly schedule */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Weekly Availability</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedAdmin ? `Set available hours for ${selectedAdmin.name}` : 'Set available hours'}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'btn-primary flex items-center gap-2 transition-all',
              saved && '!bg-emerald-600 hover:!bg-emerald-700',
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>

        <div className="mb-4">
          <label className="label">Timezone</label>
          <select className="select w-72" value={timezone} onChange={e => setTimezone(e.target.value)}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-xl border transition-all',
                slots[i].enabled
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30',
              )}
            >
              <label className="flex items-center gap-3 w-36 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={slots[i].enabled}
                  onChange={e => {
                    const s = [...slots];
                    s[i] = { ...s[i], enabled: e.target.checked };
                    setSlots(s);
                  }}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className={cn('text-sm font-medium', slots[i].enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>
                  {day}
                </span>
              </label>

              {slots[i].enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="time"
                    className="input w-28 text-sm"
                    value={slots[i].startTime}
                    onChange={e => { const s = [...slots]; s[i] = { ...s[i], startTime: e.target.value }; setSlots(s); }}
                  />
                  <span className="text-slate-400 text-sm">→</span>
                  <input
                    type="time"
                    className="input w-28 text-sm"
                    value={slots[i].endTime}
                    onChange={e => { const s = [...slots]; s[i] = { ...s[i], endTime: e.target.value }; setSlots(s); }}
                  />
                </div>
              ) : (
                <span className="text-sm text-slate-400">Unavailable</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Blocked dates */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Blocked Dates</h3>
        <p className="text-xs text-slate-500 mb-4">
          {selectedAdmin ? `Days when ${selectedAdmin.name} is unavailable` : 'Days with no availability'}
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="date"
            className="input flex-1 min-w-36"
            value={newBlockDate}
            onChange={e => setNewBlockDate(e.target.value)}
          />
          <input
            className="input flex-1 min-w-48"
            placeholder="Reason (e.g. Vacation, Holiday)"
            value={newBlockReason}
            onChange={e => setNewBlockReason(e.target.value)}
          />
          <button onClick={addBlockedDate} disabled={!newBlockDate || !selectedAdminId} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Block Date
          </button>
        </div>

        <div className="space-y-2">
          {blocked.map(b => (
            <div key={b.id} className="flex items-center justify-between px-4 py-2.5 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg">
              <div>
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {new Date(b.blockedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {b.reason && <span className="text-xs text-red-500 dark:text-red-400/70 ml-2">· {b.reason}</span>}
              </div>
              <button onClick={() => removeBlockedDate(b.id)} className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {blocked.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No blocked dates</p>
          )}
        </div>
      </div>
    </div>
  );
}
