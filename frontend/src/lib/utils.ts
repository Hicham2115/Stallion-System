import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ClientStatus, LeadStage, Priority, TaskStatus, PaymentStatus, ExpenseCategory } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'MAD'): string {
  const locale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'de-DE' : 'fr-MA';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function getServiceLabel(service: string): string {
  const map: Record<string, string> = {
    SOCIAL_MEDIA_MANAGEMENT: 'Social Media',
    SEO: 'SEO',
    PPC_ADS: 'PPC Ads',
    CONTENT_CREATION: 'Content Creation',
    WEB_DESIGN: 'Web Design',
    BRANDING: 'Branding',
    FULL_SERVICE: 'Full Service',
  };
  return map[service] || service.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStatusColor(status: ClientStatus | PaymentStatus | LeadStage | TaskStatus): string {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PENDING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ONE_TIME: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    WARMED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    CLOSED_WON: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CLOSED_LOST: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    TODO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    REVIEW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

export function getPriorityColor(priority: Priority): string {
  const map: Record<Priority, string> = {
    LOW: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    URGENT: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[priority];
}

export function getCategoryLabel(cat: ExpenseCategory): string {
  const map: Record<ExpenseCategory, string> = {
    RENT: 'Rent',
    SALARIES: 'Salaries',
    SOFTWARE_SUBSCRIPTIONS: 'Software',
    INSURANCE: 'Insurance',
    ADS_SPEND: 'Ads Spend',
    FREELANCERS: 'Freelancers',
    EQUIPMENT: 'Equipment',
    TRAVEL: 'Travel',
    MISC: 'Misc',
  };
  return map[cat] || cat;
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function isOverdue(date: string | Date): boolean {
  return new Date(date) < new Date();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
