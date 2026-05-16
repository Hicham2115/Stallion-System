import { useEffect, useState } from 'react';
import {
  CalendarDays, Clock, ChevronLeft, ChevronRight, Video,
  CheckCircle2, XCircle, RotateCcw, CheckSquare, ArrowLeft,
  CalendarCheck, Loader2,
} from 'lucide-react';
import { portalApi } from '@/context/PortalAuthContext';
import { Meeting, MeetingStatus, MeetingType } from '@/types';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

interface AvailableSlotGroup {
  adminId: string;
  adminName: string;
  slots: string[];
}

const STATUS_CONFIG: Record<MeetingStatus, { label: string; icon: React.ElementType; cls: string }> = {
  SCHEDULED:   { label: 'Scheduled',   icon: Clock,        cls: 'text-blue-400' },
  CONFIRMED:   { label: 'Confirmed',   icon: CheckCircle2, cls: 'text-emerald-400' },
  COMPLETED:   { label: 'Completed',   icon: CheckSquare,  cls: 'text-slate-400' },
  CANCELLED:   { label: 'Cancelled',   icon: XCircle,      cls: 'text-red-400' },
  RESCHEDULED: { label: 'Rescheduled', icon: RotateCcw,   cls: 'text-amber-400' },
};

function StatusBadge({ status }: { status: MeetingStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium', cfg.cls)}>
      <Icon className="w-3.5 h-3.5" /> {cfg.label}
    </span>
  );
}

export default function PortalMeetings() {
  const [activeTab, setActiveTab] = useState<'book' | 'my'>('book');
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [types, setTypes] = useState<MeetingType[]>([]);
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);

  // Step 2
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slotGroups, setSlotGroups] = useState<AvailableSlotGroup[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ adminId: string; slot: string } | null>(null);

  // Step 3
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<Meeting | null>(null);

  // My meetings
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [cancelling, setCancelling] = useState('');

  useEffect(() => {
    portalApi.get<MeetingType[]>('/meeting-types').then(r => setTypes(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'my') loadMyMeetings();
  }, [activeTab]);

  const loadMyMeetings = async () => {
    setLoadingMeetings(true);
    const [up, past] = await Promise.all([
      portalApi.get<Meeting[]>('/meetings').catch(() => ({ data: [] as Meeting[] })),
      portalApi.get<Meeting[]>('/meetings?past=true').catch(() => ({ data: [] as Meeting[] })),
    ]);
    setUpcomingMeetings(up.data);
    setPastMeetings(past.data);
    setLoadingMeetings(false);
  };

  const fetchSlots = async (date: string) => {
    if (!selectedType) return;
    setLoadingSlots(true);
    setSlotGroups([]);
    setSelectedSlot(null);
    try {
      const r = await portalApi.get<AvailableSlotGroup[]>(`/available-slots?date=${date}&duration=${selectedType.duration}`);
      setSlotGroups(r.data);
    } finally { setLoadingSlots(false); }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    fetchSlots(date);
  };

  const handleBook = async () => {
    if (!selectedType || !selectedSlot || !selectedDate) return;
    setBooking(true);
    try {
      const [sh, sm] = selectedSlot.slot.split(':').map(Number);
      const startDt = new Date(`${selectedDate}T00:00:00`);
      startDt.setHours(sh, sm, 0, 0);
      const endDt = new Date(startDt.getTime() + selectedType.duration * 60000);
      const r = await portalApi.post<Meeting>('/meetings', {
        adminId: selectedSlot.adminId,
        meetingTypeId: selectedType.id,
        title: title || selectedType.name,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        notes: notes || null,
        timezone: 'Africa/Casablanca',
      });
      setBooked(r.data);
      setStep(4);
    } catch { /* handled below */ } finally { setBooking(false); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this meeting?')) return;
    setCancelling(id);
    await portalApi.put(`/meetings/${id}/cancel`, { cancelReason: 'Cancelled by client' });
    setCancelling('');
    loadMyMeetings();
  };

  const resetBooking = () => {
    setStep(1); setSelectedType(null); setSelectedDate(''); setSlotGroups([]);
    setSelectedSlot(null); setTitle(''); setNotes(''); setBooked(null);
  };

  // Calendar helpers
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const isPastDay = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(23, 59, 59, 999);
    return d < today;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meetings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Book a meeting with our team</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0d1528] rounded-xl border border-slate-800/50 w-fit">
        {([['book', 'Book a Meeting'], ['my', 'My Meetings']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); if (id === 'book') resetBooking(); }}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-amber-500 text-white shadow'
                : 'text-slate-400 hover:text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── BOOK A MEETING ── */}
      {activeTab === 'book' && (
        <div className="space-y-5">
          {/* Progress */}
          {step < 4 && (
            <div className="flex items-center gap-2">
              {(['Select Type', 'Pick Date & Time', 'Confirm'] as const).map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    step > i + 1 ? 'bg-emerald-500 text-white' :
                    step === i + 1 ? 'bg-amber-500 text-white' :
                    'bg-slate-800 text-slate-500',
                  )}>
                    {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={cn('text-sm font-medium hidden sm:block', step === i + 1 ? 'text-white' : 'text-slate-500')}>{label}</span>
                  {i < 2 && <ChevronRight className="w-4 h-4 text-slate-700" />}
                </div>
              ))}
            </div>
          )}

          {/* Step 1: Choose meeting type */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">What type of meeting?</h2>
              {types.length === 0 && (
                <div className="card p-10 text-center" style={{ background: '#0d1528', border: '1px solid rgba(71,85,105,0.4)' }}>
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400">No meeting types available yet. Contact your agency team.</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {types.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedType(t); setStep(2); }}
                    className="text-left p-5 rounded-2xl border border-slate-800/50 bg-[#0d1528] hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: t.color }} />
                      <div>
                        <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">{t.name}</h3>
                        {t.description && <p className="text-sm text-slate-400 mt-0.5">{t.description}</p>}
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" /> {t.duration} minutes
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pick date & time */}
          {step === 2 && selectedType && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-white">Select Date & Time</h2>
                  <p className="text-xs text-slate-400">{selectedType.name} · {selectedType.duration} min</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calendar */}
                <div className="p-5 rounded-2xl border border-slate-800/50 bg-[#0d1528]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-white">
                      {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">{d}</div>
                    ))}
                    {cells.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} />;
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const past = isPastDay(day);
                      const isSel = dateStr === selectedDate;
                      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                      return (
                        <button
                          key={day}
                          disabled={past}
                          onClick={() => handleDateSelect(dateStr)}
                          className={cn(
                            'aspect-square flex items-center justify-center text-sm rounded-xl transition-all font-medium',
                            past ? 'text-slate-700 cursor-not-allowed' :
                            isSel ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' :
                            isToday ? 'border border-amber-500/50 text-amber-400 hover:bg-amber-500/10' :
                            'text-slate-300 hover:bg-slate-800',
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                <div className="p-5 rounded-2xl border border-slate-800/50 bg-[#0d1528]">
                  <h3 className="font-semibold text-white mb-3">
                    {selectedDate
                      ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                      : 'Select a date first'}
                  </h3>
                  {loadingSlots && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    </div>
                  )}
                  {!loadingSlots && selectedDate && slotGroups.length === 0 && (
                    <p className="text-slate-400 text-sm text-center py-8">No available slots on this day</p>
                  )}
                  {!loadingSlots && slotGroups.map(group => (
                    <div key={group.adminId} className="mb-4">
                      <p className="text-xs text-slate-500 font-medium mb-2">With {group.adminName}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {group.slots.map(slot => {
                          const isSel = selectedSlot?.adminId === group.adminId && selectedSlot?.slot === slot;
                          return (
                            <button
                              key={slot}
                              onClick={() => { setSelectedSlot({ adminId: group.adminId, slot }); setStep(3); }}
                              className={cn(
                                'py-2 px-3 rounded-xl text-sm font-medium border transition-all',
                                isSel
                                  ? 'bg-amber-500 border-amber-500 text-white'
                                  : 'border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5',
                              )}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirm details */}
          {step === 3 && selectedType && selectedSlot && selectedDate && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(2)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-semibold text-white">Confirm Your Meeting</h2>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800/50 bg-[#0d1528] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedType.color }} />
                  <span className="font-semibold text-white">{selectedType.name}</span>
                  <span className="text-xs text-slate-400">· {selectedType.duration} min</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <CalendarDays className="w-4 h-4 text-slate-500" />
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Clock className="w-4 h-4 text-slate-500" />
                  {selectedSlot.slot} – {(() => {
                    const [h, m] = selectedSlot.slot.split(':').map(Number);
                    const end = new Date(); end.setHours(h, m + selectedType.duration, 0, 0);
                    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                  })()}
                  <span className="text-slate-500">with {slotGroups.find(g => g.adminId === selectedSlot.adminId)?.adminName}</span>
                </div>
              </div>

              <div>
                <label className="label text-slate-300">Meeting Title</label>
                <input
                  className="input bg-[#0d1528] border-slate-700 text-white placeholder-slate-500 focus:border-amber-500"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={selectedType.name}
                />
              </div>
              <div>
                <label className="label text-slate-300">Notes / Questions (optional)</label>
                <textarea
                  className="input resize-none bg-[#0d1528] border-slate-700 text-white placeholder-slate-500 focus:border-amber-500"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything you'd like to discuss or prepare for the meeting..."
                />
              </div>

              <button
                onClick={handleBook}
                disabled={booking}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base"
              >
                {booking ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                {booking ? 'Booking...' : 'Confirm Meeting'}
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && booked && (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Meeting Booked!</h2>
              <p className="text-slate-400 mb-6">
                Your {selectedType?.name} has been scheduled for{' '}
                <strong className="text-white">
                  {new Date(booked.startTime).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </strong>
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={resetBooking} className="btn-secondary">Book Another</button>
                <button onClick={() => { setActiveTab('my'); resetBooking(); }} className="btn-primary">View My Meetings</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY MEETINGS ── */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {loadingMeetings ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-base font-semibold text-white mb-3">Upcoming Meetings</h2>
                {upcomingMeetings.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-slate-800/50 bg-[#0d1528]">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-slate-400 text-sm">No upcoming meetings</p>
                    <button onClick={() => setActiveTab('book')} className="btn-primary mt-4 text-sm">Book a Meeting</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingMeetings.map(m => {
                      const start = new Date(m.startTime);
                      const end   = new Date(m.endTime);
                      const color = m.meetingType?.color || '#f59e0b';
                      return (
                        <div key={m.id} className="p-4 rounded-2xl border border-slate-800/50 bg-[#0d1528] flex gap-4">
                          <div className="w-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-white text-sm">{m.title}</h3>
                                {m.meetingType && <p className="text-xs text-slate-500">{m.meetingType.name}</p>}
                              </div>
                              <StatusBadge status={m.status} />
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400 mt-2">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {m.admin && <span>with {m.admin.name}</span>}
                            </div>
                            {m.meetingLink && (
                              <a href={m.meetingLink} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline mt-1.5">
                                <Video className="w-3 h-3" /> Join Meeting
                              </a>
                            )}
                            {m.notes && <p className="text-xs text-slate-400 mt-1.5 italic">"{m.notes}"</p>}
                          </div>
                          {m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleCancel(m.id)}
                              disabled={cancelling === m.id}
                              className="text-xs text-red-500 hover:underline shrink-0 self-start mt-1"
                            >
                              {cancelling === m.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {pastMeetings.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-white mb-3 text-slate-400">Past Meetings</h2>
                  <div className="space-y-2 opacity-70">
                    {pastMeetings.map(m => {
                      const start = new Date(m.startTime);
                      const end   = new Date(m.endTime);
                      const color = m.meetingType?.color || '#94a3b8';
                      return (
                        <div key={m.id} className="p-4 rounded-xl border border-slate-800/30 bg-[#0d1528]/50 flex gap-3">
                          <div className="w-0.5 rounded-full shrink-0 bg-slate-700" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-medium text-slate-300 text-sm">{m.title}</h3>
                              <StatusBadge status={m.status} />
                            </div>
                            <div className="flex flex-wrap gap-x-4 text-xs text-slate-500 mt-1">
                              <span>{start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              <span>{start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              {m.admin && <span>with {m.admin.name}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
