import { Calendar, AlertTriangle } from 'lucide-react';
import { Task, TaskStatus } from '@/types';
import { formatDate, getPriorityColor, getInitials, isOverdue, cn } from '@/lib/utils';

interface Props {
  task: Task;
  onEdit: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  statuses: TaskStatus[];
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Done',
};

export default function TaskCard({ task, onEdit, onStatusChange, statuses }: Props) {
  const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'COMPLETED';
  const currentIdx = statuses.indexOf(task.status);
  const nextStatus = currentIdx < statuses.length - 1 ? statuses[currentIdx + 1] : null;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900 rounded-xl p-3.5 border shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        overdue ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-700'
      )}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('badge text-xs shrink-0', getPriorityColor(task.priority))}>{task.priority}</span>
        {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
      </div>

      <div className="mt-2">
        <div className="font-semibold text-sm text-slate-900 dark:text-white leading-snug">{task.title}</div>
        {task.description && (
          <div className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {task.tags?.map((tag) => (
          <span key={tag} className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {task.assignedTo && (
            <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400">
              {getInitials(task.assignedTo.name)}
            </div>
          )}
          {task.dueDate && (
            <div className={cn('flex items-center gap-0.5 text-xs', overdue ? 'text-red-500' : 'text-slate-400')}>
              <Calendar className="w-3 h-3" />
              {formatDate(task.dueDate)}
            </div>
          )}
        </div>

        {nextStatus && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, nextStatus); }}
            className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 font-medium"
          >
            → {STATUS_LABELS[nextStatus]}
          </button>
        )}
      </div>

      {task.client && (
        <div className="mt-2 text-xs text-slate-400 truncate">📁 {task.client.name}</div>
      )}
    </div>
  );
}
