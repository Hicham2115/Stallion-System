import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  Zap,
  AlertCircle,
  BarChart2,
} from "lucide-react";
import { portalApi } from "@/context/PortalAuthContext";
import { KpiData } from "@/types";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7d", label: "7 Days" },
  { value: "last_30d", label: "30 Days" },
  { value: "last_90d", label: "90 Days" },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-5">
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
          color,
        )}
      >
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1528] border border-slate-700/50 rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <div className="text-slate-400 mb-1.5">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-slate-300">{p.name}:</span>
          <span className="text-white font-semibold">
            {p.dataKey === "spend"
              ? `$${Number(p.value).toLocaleString()}`
              : p.dataKey.toLowerCase().includes("rate")
                ? `${Number(p.value).toFixed(1)}%`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function KPIsPage() {
  const [datePreset, setDatePreset] = useState("last_7d");
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    portalApi
      .get<KpiData>(`/kpis?datePreset=${datePreset}`)
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }, [datePreset]);

  const s = data?.summary;
  const fmt = (n: number) =>
    `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fmtK = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Campaign Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Meta Ads performance metrics
          </p>
        </div>
        <div className="flex items-center bg-[#0d1528] border border-slate-800/60 rounded-xl p-1 gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDatePreset(p.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                datePreset === p.value
                  ? "bg-amber-500 text-white shadow"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mock data banner */}
      {data?.isMock && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <AlertCircle className="w-4.5 h-4.5 text-blue-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-blue-400">
              Sample Data
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Connect your Meta Ads account to see real campaign data. Contact
              your account manager to set this up.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={DollarSign}
              label="Total Spend"
              value={fmt(s?.spend ?? 0)}
              color="bg-red-500/10 text-red-400"
            />
            <KpiCard
              icon={Users}
              label="Total Reach"
              value={fmtK(s?.reach ?? 0)}
              color="bg-blue-500/10 text-blue-400"
            />
            <KpiCard
              icon={Target}
              label="Leads"
              value={`${s?.leads ?? 0}`}
              sub={`$${(s?.costPerLead ?? 0).toFixed(2)} CPL`}
              color="bg-green-500/10 text-green-400"
            />
            <KpiCard
              icon={TrendingUp}
              label="ROAS"
              value={`${(s?.roas ?? 0).toFixed(2)}x`}
              color="bg-amber-500/10 text-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={BarChart2}
              label="Impressions"
              value={fmtK(s?.impressions ?? 0)}
              color="bg-purple-500/10 text-purple-400"
            />
            <KpiCard
              icon={Zap}
              label="CTR"
              value={`${(s?.ctr ?? 0).toFixed(2)}%`}
              color="bg-cyan-500/10 text-cyan-400"
            />
            <KpiCard
              icon={DollarSign}
              label="CPM"
              value={`$${(s?.cpm ?? 0).toFixed(2)}`}
              color="bg-slate-500/10 text-slate-400"
            />
            <KpiCard
              icon={Target}
              label="Purchases"
              value={`${s?.purchases ?? 0}`}
              sub={`${(s?.conversionRate ?? 0).toFixed(1)}% conv.`}
              color="bg-orange-500/10 text-orange-400"
            />
          </div>

          {/* Spend chart */}
          <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-5">
              Daily Ad Spend
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={data?.daily ?? []}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="spend"
                  name="Spend"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#spendGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Purchases conversion chart */}
          <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 className="text-sm font-semibold text-white">Results</h3>
              <div className="text-xs text-slate-400 whitespace-nowrap">
                {s?.purchases ?? 0} · {(s?.conversionRate ?? 0).toFixed(1)}% conv.
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={data?.daily ?? []}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, "auto"]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="conversionRate"
                  name="Conv. %"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
