import { useEffect, useState } from 'react';
import { RefreshCw, Award, Phone, CheckCircle, Truck, Users, ToggleLeft, ToggleRight, Search } from 'lucide-react';

import api from '@/lib/api';
import { CloserStat } from '@/types';
import { cn, getInitials } from '@/lib/utils';
import { useCrmCurrency } from '@/context/CrmCurrencyContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#92400e', '#6366f1', '#10b981'];

export default function Closers() {
  const { fmt } = useCrmCurrency();
  const [view, setView] = useState<'performance' | 'team'>('performance');
  const [closers, setClosers] = useState<CloserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamSearch, setTeamSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const loadClosers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CloserStat[]>('/crm/closers');
      setClosers(data.sort((a, b) => b.confirmedOrders - a.confirmedOrders));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosers();
  }, []);

  async function toggleCloser(userId: string) {
    setToggling(userId);
    try {
      await api.put(`/users/${userId}/toggle-closer`);
      await loadClosers();
    } finally {
      setToggling(null);
    }
  }

  const teamClosers = closers.filter(c => c.isCloser);
  const chartData = teamClosers.slice(0, 10).map(c => ({
    name: c.name.split(' ')[0],
    confirmed: c.confirmedOrders,
    earnings: c.totalEarnings,
    rate: c.conversionRate,
  }));

  const filteredUsers = closers.filter(c =>
    !teamSearch || c.name.toLowerCase().includes(teamSearch.toLowerCase()) || c.email.toLowerCase().includes(teamSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Closers</h2>
          <p className="text-sm text-slate-500 mt-0.5">{teamClosers.length} designated closers</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setView('performance')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'performance' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
            >
              <Award className="w-3.5 h-3.5" /> Performance
            </button>
            <button
              onClick={() => setView('team')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                view === 'team' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}
            >
              <Users className="w-3.5 h-3.5" /> Manage Team
            </button>
          </div>
          <button onClick={loadClosers} className="btn-secondary p-2.5">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── PERFORMANCE VIEW ── */}
      {view === 'performance' && (
        loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Leaderboard top 3 */}
            {teamClosers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {teamClosers.slice(0, 3).map((c, i) => (
                  <div key={c.id} className={cn(
                    'card p-5 text-center border-2 relative overflow-hidden',
                    i === 0 ? 'border-amber-400' : i === 1 ? 'border-slate-400' : 'border-orange-700/50',
                  )}>
                    <div className={cn(
                      'absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-xl',
                      i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-500' : 'bg-orange-800',
                    )}>
                      #{i + 1}
                    </div>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-lg font-bold mx-auto mb-3">
                      {c.avatar ? <img src={c.avatar} className="w-full h-full rounded-full object-cover" alt={c.name} /> : getInitials(c.name)}
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{c.name}</h3>
                    <p className="text-xs text-slate-500 mb-3">{c.role.replace('_', ' ')}</p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <div className="font-bold text-amber-600 dark:text-amber-400">{c.confirmedOrders}</div>
                        <div className="text-xs text-slate-500">Confirmed</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{c.conversionRate}%</div>
                        <div className="text-xs text-slate-500">Rate</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {fmt(c.totalEarnings)} earned
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Confirmed Orders by Closer</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }} />
                    <Bar dataKey="confirmed" name="Confirmed" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={RANK_COLORS[i] || '#6366f1'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Full table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {['Rank', 'Agent', 'Total Orders', 'Confirmed', 'Delivered', 'Conversion Rate', 'Earnings'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {teamClosers.map((c, i) => (
                      <tr key={c.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/30', i === 0 && 'bg-amber-50/40 dark:bg-amber-900/5')}>
                        <td className="px-4 py-3">
                          <span className={cn('font-bold text-sm', i === 0 ? 'text-amber-500' : 'text-slate-400')}>#{i + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                              {c.avatar ? <img src={c.avatar} className="w-full h-full rounded-full object-cover" alt={c.name} /> : getInitials(c.name)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                              <div className="text-xs text-slate-400">{c.role.replace('_', ' ')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {c.totalOrders}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> {c.confirmedOrders}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-sky-500 font-medium">
                            <Truck className="w-3.5 h-3.5" /> {c.deliveredOrders}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${c.conversionRate}%` }} />
                            </div>
                            <span className={cn('font-semibold text-sm', c.conversionRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500')}>
                              {c.conversionRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                            <Award className="w-3.5 h-3.5" /> {fmt(c.totalEarnings)}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {teamClosers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          No closers designated yet — go to "Manage Team" to assign them.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* ── MANAGE TEAM VIEW ── */}
      {view === 'team' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="input pl-9 w-full"
                  placeholder="Search team members…"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                />
              </div>
              <p className="text-sm text-slate-500">
                Toggle users to designate them as closers. Closers appear in the performance leaderboard and can be assigned to clients.
              </p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map(c => {
                const isToggling = toggling === c.id;
                return (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {c.avatar ? <img src={c.avatar} className="w-full h-full rounded-full object-cover" alt={c.name} /> : getInitials(c.name)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white text-sm">{c.name}</div>
                        <div className="text-xs text-slate-400">{c.email} · {c.role.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.isCloser && (
                        <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">Closer</span>
                      )}
                      <button
                        onClick={() => toggleCloser(c.id)}
                        disabled={isToggling}
                        className={cn(
                          'flex items-center gap-1.5 text-sm font-medium transition-colors',
                          c.isCloser ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
                          isToggling && 'opacity-50 cursor-not-allowed',
                        )}
                        title={c.isCloser ? 'Remove from closer team' : 'Add to closer team'}
                      >
                        {isToggling ? (
                          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : c.isCloser ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <div className="py-10 text-center text-slate-400 text-sm">No users found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
