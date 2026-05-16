import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, CheckCircle, XCircle, ChevronRight, Globe } from 'lucide-react';
import api from '@/lib/api';
import { PortalAdminClient } from '@/types';
import { cn } from '@/lib/utils';

export default function PortalClientsPage() {
  const [clients, setClients] = useState<PortalAdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<PortalAdminClient[]>('/portal-admin')
      .then(({ data }) => setClients(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()),
  );

  const withPortal = clients.filter((c) => c.portalUser).length;
  const without = clients.length - withPortal;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Client Portal Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage portal access and content for all clients</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Clients', value: clients.length, icon: Users, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
          { label: 'Portal Active', value: withPortal, icon: CheckCircle, color: 'text-green-400 bg-green-500/10 border-green-500/20' },
          { label: 'No Portal', value: without, icon: XCircle, color: 'text-slate-500 bg-slate-600/10 border-slate-600/20' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-4">
            <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center mb-3', color)}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search clients..."
        className="w-full max-w-sm bg-[#0d1528] border border-slate-800/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
      />

      {/* Client list */}
      <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <p className="text-sm">No clients found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filtered.map((client) => (
              <Link
                key={client.id}
                to={`/portal-admin/${client.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-800/20 transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-sm font-bold text-amber-400">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{client.name}</div>
                    <div className="text-xs text-slate-500 truncate">{client.service} · {client.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {client.portalUser ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-green-400" />
                          <span className="text-xs font-semibold text-green-400">Portal Active</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{client.portalUser.email}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs text-slate-500">No Portal</span>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
