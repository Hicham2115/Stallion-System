import { useEffect, useState, useCallback } from 'react';
import {
  Plus, CalendarDays, List, Settings2, Layers3,
  Video, ChevronLeft, ChevronRight, Clock, CheckCircle2,
  XCircle, RotateCcw, CheckSquare, ExternalLink, Pencil, Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import { Meeting, MeetingStatus } from '@/types';
import { cn } from '@/lib/utils';
import MeetingModal from './MeetingModal';
import AvailabilitySettings from './AvailabilitySettings';
import MeetingTypesManager from './MeetingTypesManager';

type Tab = 'upcoming' | 'all' | 'calendar' | 'availability' | 'types';

const STATUS_CONFIG: Record<MeetingStatus, { label: string; icon: React.ElementType; cls: string }> = {
  SCHEDULED:   { label: 'Scheduled',   icon: Clock,        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  CONFIRMED:   { label: 'Confirmed',   icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  COMPLETED:   { label: 'Completed',   icon: CheckSquare,  cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  CANCELLED:   { label: 'Cancelled',   icon: XCircle,      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  RESCHEDULED: { label: 'Rescheduled', icon: RotateCcw,   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

function StatusBadge({ status }: { status: MeetingStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('badge flex items-center gap-1', cfg.cls)}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function MeetingCard({ meeting, onEdit, onDelete, onStatusChange }: {
  meeting: Meeting;
  onEdit: (m: Meeting) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: MeetingStatus) => void;
}) {
  const start = new Date(meeting.startTime);
  const end   = new Date(meeting.endTime);
  const color = meeting.meetingType?.color || '#f59e0b';

  return (
    <div className="card p-4 hover:shadow-md transition-all border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{meeting.title}</h3>
            <StatusBadge status={meeting.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {meeting.client && <span>· {meeting.client.name}</span>}
            {meeting.admin && <span>· {meeting.admin.name}</span>}
            {meeting.meetingType && <span>· {meeting.meetingType.name}</span>}
          </div>
          {meeting.meetingLink && (
            <a href={meeting.meetingLink} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1">
              <Video className="w-3 h-3" /> Join Meeting <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={meeting.status}
            onChange={e => onStatusChange(meeting.id, e.target.value as MeetingStatus)}
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none"
          >
            {Object.entries(STATUS_CONFIG).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
          </select>
          <button onClick={() => onEdit(meeting)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-500">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(meeting.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ meetings }: { meetings: Meeting[] }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const meetingsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return meetings.filter(m => m.startTime.startsWith(dateStr));
  };

  const selectedMeetings = selected ? meetingsOnDay(parseInt(selected)) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setViewDate(new Date())} className="px-3 py-1 text-xs font-medium bg-amber-500/10 text-amber-600 rounded-lg hover:bg-amber-500/20">
              Today
            </button>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const dayMeetings = meetingsOnDay(day);
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSel = String(day) === selected;
            return (
              <button
                key={day}
                onClick={() => setSelected(isSel ? null : String(day))}
                className={cn(
                  'relative min-h-16 p-1.5 rounded-xl border text-left transition-all hover:border-amber-400',
                  isToday ? 'border-amber-500 bg-amber-500/5' : 'border-slate-100 dark:border-slate-800',
                  isSel && 'border-amber-500 bg-amber-500/10',
                )}
              >
                <span className={cn(
                  'text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full',
                  isToday ? 'bg-amber-500 text-white' : 'text-slate-700 dark:text-slate-300',
                )}>
                  {day}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayMeetings.slice(0, 2).map(m => (
                    <div
                      key={m.id}
                      className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white"
                      style={{ backgroundColor: m.meetingType?.color || '#f59e0b' }}
                    >
                      {new Date(m.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {m.title}
                    </div>
                  ))}
                  {dayMeetings.length > 2 && (
                    <div className="text-[10px] text-slate-400 px-1">+{dayMeetings.length - 2} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
          {selected
            ? `${new Date(year, month, parseInt(selected)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
            : 'Select a day'}
        </h3>
        {selectedMeetings.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No meetings</p>
        )}
        <div className="space-y-3">
          {selectedMeetings.map(m => {
            const start = new Date(m.startTime);
            const end   = new Date(m.endTime);
            const color = m.meetingType?.color || '#f59e0b';
            return (
              <div key={m.id} className="flex gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{m.title}</p>
                  <p className="text-xs text-slate-500">
                    {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {m.client && <p className="text-xs text-slate-400">{m.client.name}</p>}
                  <StatusBadge status={m.status} />
                  {m.meetingLink && (
                    <a href={m.meetingLink} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1">
                      <Video className="w-3 h-3" /> Join
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Meetings() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === 'upcoming') params.set('upcoming', 'true');
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get<Meeting[]>(`/meetings?${params}`);
      setMeetings(r.data);
    } finally { setLoading(false); }
  }, [tab, statusFilter]);

  useEffect(() => {
    if (tab === 'upcoming' || tab === 'all' || tab === 'calendar') fetchMeetings();
  }, [tab, fetchMeetings]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this meeting?')) return;
    await api.delete(`/meetings/${id}`);
    setMeetings(m => m.filter(x => x.id !== id));
  };

  const handleStatusChange = async (id: string, status: MeetingStatus) => {
    await api.put(`/meetings/${id}`, { status });
    setMeetings(m => m.map(x => x.id === id ? { ...x, status } : x));
  };

  const stats = {
    scheduled: meetings.filter(m => m.status === 'SCHEDULED').length,
    confirmed:  meetings.filter(m => m.status === 'CONFIRMED').length,
    completed:  meetings.filter(m => m.status === 'COMPLETED').length,
    cancelled:  meetings.filter(m => m.status === 'CANCELLED').length,
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'upcoming',     label: 'Upcoming',     icon: Clock },
    { id: 'all',          label: 'All Meetings',  icon: List },
    { id: 'calendar',     label: 'Calendar',      icon: CalendarDays },
    { id: 'availability', label: 'Availability',  icon: Settings2 },
    { id: 'types',        label: 'Meeting Types', icon: Layers3 },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Schedule and manage all meetings</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Schedule Meeting
        </button>
      </div>

      {/* Stats (only for meeting list tabs) */}
      {(tab === 'upcoming' || tab === 'all') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Scheduled', count: stats.scheduled, color: 'text-blue-600' },
            { label: 'Confirmed', count: stats.confirmed,  color: 'text-emerald-600' },
            { label: 'Completed', count: stats.completed,  color: 'text-slate-600' },
            { label: 'Cancelled', count: stats.cancelled,  color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              tab === id
                ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'availability' && <AvailabilitySettings />}
      {tab === 'types' && <MeetingTypesManager />}

      {tab === 'calendar' && (
        <CalendarView meetings={meetings} />
      )}

      {(tab === 'upcoming' || tab === 'all') && (
        <div className="space-y-3">
          {tab === 'all' && (
            <div className="flex gap-2">
              <select className="select w-44 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
              </select>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No meetings found</p>
              <p className="text-sm mt-1">
                {tab === 'upcoming' ? 'No upcoming meetings scheduled.' : 'No meetings match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map(m => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  onEdit={(m) => { setEditing(m); setModalOpen(true); }}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <MeetingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        meeting={editing}
        onSaved={fetchMeetings}
      />
    </div>
  );
}
