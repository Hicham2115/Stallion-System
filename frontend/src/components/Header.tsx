import { useState, useEffect, useRef } from 'react';
import { Menu, Sun, Moon, Bell, LogOut, UserCircle, Check, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getInitials, cn } from '@/lib/utils';
import { Role } from '@/types';
import api from '@/lib/api';

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  TEAM_MEMBER: 'Team Member',
};

const STORAGE_KEY = 'stallion_notif_read_at';

interface ActivityLog {
  id: string;
  module: string;
  action: string;
  details?: string;
  createdAt: string;
  user?: { name: string; avatar?: string };
  client?: { name: string };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const MODULE_COLORS: Record<string, string> = {
  clients: 'text-blue-400 bg-blue-500/10',
  payments: 'text-green-400 bg-green-500/10',
  expenses: 'text-red-400 bg-red-500/10',
  leads: 'text-purple-400 bg-purple-500/10',
  tasks: 'text-amber-400 bg-amber-500/10',
  portal: 'text-cyan-400 bg-cyan-500/10',
  team: 'text-pink-400 bg-pink-500/10',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<ActivityLog[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ActivityLog[]>('/dashboard/notifications');
      setNotifications(data);
      const readAt = localStorage.getItem(STORAGE_KEY);
      const count = readAt
        ? data.filter((n) => new Date(n.createdAt) > new Date(readAt)).length
        : data.length;
      setUnread(count);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const markAllRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    setUnread(0);
  };

  const readAt = localStorage.getItem(STORAGE_KEY);

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden md:block">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Welcome back, <span className="font-semibold text-slate-900 dark:text-white">{user?.name.split(' ')[0]}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          title="Toggle theme"
        >
          {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
        </button>

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 relative transition-colors"
          >
            <Bell className="w-4.5 h-4.5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-amber-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center px-0.5">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-84 bg-white dark:bg-[#0d1528] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-2xl z-[100] overflow-hidden"
              style={{ width: '340px' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Activity Feed</span>
                  {unread > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                      {unread} new
                    </span>
                  )}
                </div>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                {loading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-400 text-sm gap-2">
                    <Bell className="w-6 h-6 opacity-30" />
                    No recent activity
                  </div>
                ) : notifications.map((n) => {
                  const isNew = readAt ? new Date(n.createdAt) > new Date(readAt) : true;
                  const colorClass = MODULE_COLORS[n.module.toLowerCase()] ?? 'text-slate-400 bg-slate-500/10';
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        isNew
                          ? 'bg-amber-50 dark:bg-amber-500/5 hover:bg-amber-100/50 dark:hover:bg-amber-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
                      )}
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold uppercase', colorClass)}>
                        {n.module.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {n.action}
                          </span>
                          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                        </div>
                        {(n.details || n.client?.name) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {n.details || n.client?.name}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          {n.user?.name && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{n.user.name}</span>
                          )}
                          {n.user?.name && <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>}
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/50 text-center">
                  <span className="text-xs text-slate-400">Last 20 activities</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-slate-200 dark:border-slate-700">
          <Link
            to="/profile"
            title="My Profile"
            onClick={() => {
              requestAnimationFrame(() => {
                const main = document.querySelector('main');
                if (main) main.scrollTop = 0;
              });
            }}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-400/40 hover:ring-amber-400 transition-all"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer">
                {getInitials(user?.name || 'U')}
              </div>
            )}
          </Link>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-slate-900 dark:text-white leading-none">{user?.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {user?.role ? ROLE_LABELS[user.role] : 'Team Member'}
            </div>
          </div>
          <Link
            to="/profile"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-0.5"
            title="My Profile"
            onClick={() => {
              requestAnimationFrame(() => {
                const main = document.querySelector('main');
                if (main) main.scrollTop = 0;
              });
            }}
          >
            <UserCircle className="w-4 h-4" />
          </Link>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
