import { Calendar, DollarSign, AlertCircle, Trash2 } from 'lucide-react';
import { Lead, LeadStage } from '@/types';
import { formatCurrency, formatDate, getInitials, isOverdue, cn } from '@/lib/utils';

interface Props {
  lead: Lead;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onMoveStage: (id: string, stage: LeadStage) => void;
  stages: LeadStage[];
}

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'New',
  WARMED: 'Warmed',
  CLOSED_WON: 'Won',
  CLOSED_LOST: 'Lost',
};

export default function LeadCard({ lead, onEdit, onDelete, onMoveStage, stages }: Props) {
  const stale = lead.followUpDate && isOverdue(lead.followUpDate) && !['CLOSED_WON', 'CLOSED_LOST'].includes(lead.stage);
  const currentIdx = stages.indexOf(lead.stage);
  const nextStage = currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl p-3.5 border shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        stale ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'
      )}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{lead.name}</div>
          {lead.company && <div className="text-xs text-slate-400 mt-0.5 truncate">{lead.company}</div>}
        </div>
        {stale && <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {lead.service?.replace(/_/g, ' ')} · {lead.source?.replace(/_/g, ' ')}
        </div>

        {lead.expectedValue && (
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-3 h-3" />
            {formatCurrency(lead.expectedValue)}
          </div>
        )}

        {lead.followUpDate && (
          <div className={cn('flex items-center gap-1 text-xs', stale ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}>
            <Calendar className="w-3 h-3" />
            {formatDate(lead.followUpDate)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        {lead.assignedTo ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400">
              {getInitials(lead.assignedTo.name)}
            </div>
            <span className="text-xs text-slate-400 truncate max-w-20">{lead.assignedTo.name.split(' ')[0]}</span>
          </div>
        ) : <div />}

        <div className="flex items-center gap-2">
          {nextStage && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveStage(lead.id, nextStage); }}
              className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 font-medium"
            >
              → {STAGE_LABELS[nextStage]}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete lead"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
