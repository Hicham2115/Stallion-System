import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShoppingCart,
  CheckCircle,
  XCircle,
  DollarSign,
  Award,
  Package,
  Truck,
  BarChart3,
} from "lucide-react";
import api from "@/lib/api";
import { Client } from "@/types";
import { cn } from "@/lib/utils";
import { useCrmCurrency } from "@/context/CrmCurrencyContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AnalyticsData {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalNetProfit: number;
    totalAdSpend: number;
    totalProductCost: number;
    totalShipping: number;
    confirmed: number;
    shipped?: number;
    delivered: number;
    cancelled: number;
    returned: number;
    avgOrderValue: number;
    conversionRate: number;
    totalCommissions: number;
  };
  monthly: { month: string; revenue: number; profit: number; orders: number }[];
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  topCities: { city: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "#6366f1",
  PENDING_CONFIRMATION: "#f59e0b",
  CONFIRMED: "#10b981",
  NO_ANSWER: "#94a3b8",
  CANCELLED: "#ef4444",
  REFUSED: "#f97316",
  SHIPPED: "#3b82f6",
  DELIVERED: "#22c55e",
  RETURNED: "#e11d48",
};

const SOURCE_COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#6366f1",
  "#ec4899",
  "#f97316",
  "#94a3b8",
];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthOptions() {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - index, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: `${fmt.format(date)} ${date.getFullYear()}`,
      from: toIsoDate(start),
      to: toIsoDate(end),
    };
  });
}

interface Props {
  onNavigate?: (tab: string) => void;
  analyticsMode?: boolean;
}

export default function CrmDashboard({ onNavigate, analyticsMode }: Props) {
  const { fmt } = useCrmCurrency();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ users: Client[] } | Client[]>("/clients?limit=100").then((r) => {
      const list = Array.isArray(r.data)
        ? r.data
        : (r.data as any).clients || [];
      setClients(list);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedClient) params.set("clientId", selectedClient);
    if (selectedMonth) {
      const month = monthOptions().find((m) => m.key === selectedMonth);
      if (month) {
        params.set("datePreset", "custom");
        params.set("from", month.from);
        params.set("to", month.to);
      }
    }
    api
      .get<AnalyticsData>(`/crm/analytics?${params.toString()}`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [selectedClient, selectedMonth]);

  const s = data?.summary;

  const mergedCancelled = s ? s.cancelled + s.returned : 0;

  const mergedByStatus = (() => {
    const list = data?.byStatus || [];
    const out: { status: string; count: number }[] = [];
    const indexByStatus: Record<string, number> = {};
    for (const entry of list) {
      const status = entry.status === "RETURNED" ? "CANCELLED" : entry.status;
      const existingIndex = indexByStatus[status];
      if (existingIndex === undefined) {
        indexByStatus[status] = out.length;
        out.push({ status, count: entry.count });
      } else {
        out[existingIndex].count += entry.count;
      }
    }
    return out;
  })();

  const shippedCount =
    s?.shipped ??
    (data?.byStatus || []).reduce((sum, entry) => {
      if (entry.status === "SHIPPED" || entry.status === "DELIVERED") {
        return sum + entry.count;
      }
      return sum;
    }, 0);

  const kpis = s
    ? [
        {
          label: "Total Revenue",
          value: fmt(s.totalRevenue),
          icon: DollarSign,
          color: "text-amber-500",
          bg: "bg-amber-500/10",
        },
        {
          label: "Net Profit",
          value: fmt(s.totalNetProfit),
          icon: TrendingUp,
          color: s.totalNetProfit >= 0 ? "text-emerald-500" : "text-red-500",
          bg: s.totalNetProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
        },
        {
          label: "Total Orders",
          value: s.totalOrders.toString(),
          icon: ShoppingCart,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
        },
        {
          label: "Confirmed",
          value: s.confirmed.toString(),
          icon: CheckCircle,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        },
        {
          label: "Shipped",
          value: shippedCount.toString(),
          icon: Truck,
          color: "text-sky-500",
          bg: "bg-sky-500/10",
        },
        {
          label: "Cancelled",
          value: mergedCancelled.toString(),
          icon: XCircle,
          color: "text-red-500",
          bg: "bg-red-500/10",
        },
        {
          label: "Conversion Rate",
          value: `${s.conversionRate}%`,
          icon: BarChart3,
          color: "text-purple-500",
          bg: "bg-purple-500/10",
        },
        {
          label: "Avg Order Value",
          value: fmt(s.avgOrderValue),
          icon: Package,
          color: "text-orange-500",
          bg: "bg-orange-500/10",
        },
        {
          label: "Ad Spend",
          value: fmt(s.totalAdSpend),
          icon: TrendingUp,
          color: "text-pink-500",
          bg: "bg-pink-500/10",
        },
        {
          label: "Commissions",
          value: fmt(s.totalCommissions),
          icon: Award,
          color: "text-indigo-500",
          bg: "bg-indigo-500/10",
        },
        {
          label: "Costs",
          value: fmt(s.totalProductCost),
          icon: Package,
          color: "text-slate-400",
          bg: "bg-slate-500/10",
        },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {analyticsMode ? "Profit Analytics" : "CRM Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {analyticsMode
              ? "Deep financial insights and trends"
              : "Business performance overview"}
          </p>
        </div>
        <div className="w-full xl:w-auto grid sm:grid-cols-2 gap-3">
          <select
            className="select w-full sm:w-56"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="select w-full sm:w-44"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">All Months</option>
            {monthOptions().map((month) => (
              <option key={month.key} value={month.key}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card p-4 flex flex-col gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    bg,
                  )}
                >
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {value}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Profit Breakdown */}
          {s && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                Profit Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  {
                    label: "Revenue",
                    value: s.totalRevenue,
                    color: "bg-amber-500",
                  },
                  {
                    label: "− Product Cost",
                    value: -s.totalProductCost,
                    color: "bg-red-400",
                  },
                  {
                    label: "− Shipping",
                    value: -s.totalShipping,
                    color: "bg-red-400",
                  },
                  {
                    label: "− Ad Spend",
                    value: -s.totalAdSpend,
                    color: "bg-red-400",
                  },
                  {
                    label: "= Net Profit",
                    value: s.totalNetProfit,
                    color:
                      s.totalNetProfit >= 0 ? "bg-emerald-500" : "bg-red-600",
                  },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <div
                      className={cn(
                        "text-white rounded-xl py-3 px-2 font-bold text-sm",
                        item.color,
                      )}
                    >
                      {fmt(Math.abs(item.value))}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts row */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Revenue & Profit trend */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                Revenue & Profit Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.monthly || []}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="#6b7280"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{
                      background: "#1e293b",
                      border: "none",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#f59e0b"
                    fill="url(#revGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="#10b981"
                    fill="url(#profGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Orders by status */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                Orders by Status
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={mergedByStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {mergedByStatus.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[entry.status] || "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "none",
                      borderRadius: 8,
                    }}
                  />
                  <Legend formatter={(v) => v.replace(/_/g, " ")} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Orders per month */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                Monthly Orders
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.monthly || []}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="#6b7280"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "none",
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    dataKey="orders"
                    name="Orders"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Source breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                Orders by Source
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.bySource || []} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#374151"
                    opacity={0.3}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="#6b7280"
                  />
                  <YAxis
                    dataKey="source"
                    type="category"
                    tick={{ fontSize: 10 }}
                    stroke="#6b7280"
                    width={90}
                    tickFormatter={(v) => v.replace(/_/g, " ")}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1e293b",
                      border: "none",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" name="Orders" radius={[0, 4, 4, 0]}>
                    {(data?.bySource || []).map((_, i) => (
                      <Cell
                        key={i}
                        fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top cities */}
          {(data?.topCities?.length ?? 0) > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                Top Cities
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {data!.topCities.map((c, i) => (
                  <div
                    key={c.city}
                    className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center"
                  >
                    <div className="text-2xl font-bold text-amber-500">
                      #{i + 1}
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm mt-1">
                      {c.city}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.count} orders
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          {!analyticsMode && onNavigate && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Manage Orders", tab: "orders", color: "btn-primary" },
                {
                  label: "Closers Performance",
                  tab: "closers",
                  color: "btn-secondary",
                },
                {
                  label: "Commission Rules",
                  tab: "commissions",
                  color: "btn-secondary",
                },
                {
                  label: "Shopify Sync",
                  tab: "shopify",
                  color: "btn-secondary",
                },
              ].map(({ label, tab, color }) => (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className={cn(color, "py-2 text-sm")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
