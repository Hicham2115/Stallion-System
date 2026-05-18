import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value?: string) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface DateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  dark?: boolean;
}

export default function DateSelector({ value, onChange, label = 'Date', dark = false }: DateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => fromIsoDate(value));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (value) setViewDate(fromIsoDate(value));
  }, [value]);

  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const firstMondayIndex = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstMondayIndex }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [viewDate]);

  const selected = value ? fromIsoDate(value) : null;
  const todayIso = toIsoDate(new Date());

  return (
    <div ref={rootRef} className="relative">
      <label className={cn(
        'block text-xs font-medium mb-1',
        dark ? 'text-slate-400 uppercase tracking-wider' : 'text-slate-400',
      )}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'w-full h-10 flex items-center justify-between gap-2 rounded-xl border px-3 text-sm transition-all',
          dark
            ? 'bg-slate-800/60 border-slate-700/60 text-white hover:border-amber-500/50'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:border-amber-400',
        )}
      >
        <span className={cn(!value && 'text-slate-500')}>
          {value ? formatDate(value) : 'Pick date'}
        </span>
        <CalendarDays className="w-4 h-4 text-amber-500" />
      </button>

      {open && (
        <div className={cn(
          'absolute z-30 mt-2 w-72 rounded-2xl border p-3 shadow-2xl',
          dark
            ? 'bg-[#0d1528] border-slate-700/70'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700',
        )}>
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className={cn('text-sm font-semibold', dark ? 'text-white' : 'text-slate-900 dark:text-white')}>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((day, i) => (
              <div key={`${day}-${i}`} className="h-7 flex items-center justify-center text-[11px] font-semibold text-slate-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="h-8" />;
              const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const iso = toIsoDate(cellDate);
              const isSelected = selected && iso === toIsoDate(selected);
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    'h-8 rounded-lg text-xs font-semibold transition-all',
                    isSelected
                      ? 'bg-amber-500 text-white shadow'
                      : dark
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-600',
                    isToday && !isSelected && 'ring-1 ring-amber-500/40',
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { toIsoDate };
