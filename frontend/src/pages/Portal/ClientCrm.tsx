import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  PackageCheck,
  XCircle,
  BarChart2,
  Percent,
  Package,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { portalApi } from "@/context/PortalAuthContext";
import { usePortalCurrency } from "@/context/PortalCurrencyContext";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

type OrderStatus =
  | "NEW"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "NO_ANSWER"
  | "CANCELLED"
  | "REFUSED"
  | "SHIPPED"
  | "DELIVERED"
  | "RETURNED";

interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerCity?: string;
  productName: string;
  quantity: number;
  orderAmount: number;
  netProfit: number;
  status: OrderStatus;
  paymentStatus: string;
  source: string;
  closer?: { id: string; name: string } | null;
  createdAt: string;
}

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  totalAdSpend: number;
  confirmed: number;
  delivered: number;
  shipped: number;
  cancelled: number;
  returned: number;
  refused: number;
  codPending: number;
  conversionRate: number;
  profitMargin: number;
  avgOrderValue: number;
  returnRate: number;
  roas: number;
  monthlyTrend: {
    month: string;
    revenue: number;
    profit: number;
    orders: number;
  }[];
  byStatus: { status: string; count: number }[];
  bySource: { source: string; count: number }[];
  topProducts: { name: string; revenue: number; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500/15 text-blue-400",
  PENDING_CONFIRMATION: "bg-amber-500/15 text-amber-400",
  CONFIRMED: "bg-emerald-500/15 text-emerald-400",
  NO_ANSWER: "bg-slate-500/15 text-slate-400",
  CANCELLED: "bg-red-500/15 text-red-400",
  REFUSED: "bg-red-500/15 text-red-400",
  SHIPPED: "bg-indigo-500/15 text-indigo-400",
  DELIVERED: "bg-emerald-500/15 text-emerald-400",
  RETURNED: "bg-orange-500/15 text-orange-400",
};

const PIE_COLORS = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

const CHART_STYLE = {
  contentStyle: {
    background: "#0d1528",
    border: "1px solid #1e293b",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#94a3b8" },
};

export default function ClientCrm() {
  const { fmt } = usePortalCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setStatsLoading(true);
    portalApi
      .get<Stats>("/crm/stats")
      .then(({ data }) => setStats(data))
      .finally(() => setStatsLoading(false));
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const { data } = await portalApi.get<{
      orders: Order[];
      total: number;
      pages: number;
    }>(`/crm/orders?${params}`);
    setOrders(data.orders);
    setTotal(data.total);
    setPages(data.pages);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [search, statusFilter, page]);

  const kpis = stats
    ? [
        {
          label: "Total Orders",
          value: stats.totalOrders.toString(),
          icon: ShoppingCart,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
        },
        {
          label: "Total Revenue",
          value: fmt(stats.totalRevenue),
          icon: DollarSign,
          color: "text-amber-400",
          bg: "bg-amber-500/10",
        },
        {
          label: "Net Profit",
          value: fmt(stats.totalProfit),
          icon: TrendingUp,
          color: stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400",
          bg: stats.totalProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
        },
        {
          label: "Profit Margin",
          value: `${stats.profitMargin}%`,
          icon: Percent,
          color:
            stats.profitMargin >= 20 ? "text-emerald-400" : "text-amber-400",
          bg: "bg-purple-500/10",
        },
        {
          label: "Avg Order Value",
          value: fmt(stats.avgOrderValue),
          icon: BarChart2,
          color: "text-purple-400",
          bg: "bg-purple-500/10",
        },
        {
          label: "Conv. Rate",
          value: `${stats.conversionRate}%`,
          icon: ArrowUpRight,
          color: "text-indigo-400",
          bg: "bg-indigo-500/10",
        },
        {
          label: "Ad Spend ROAS",
          value: stats.roas > 0 ? `${stats.roas}x` : "—",
          icon: TrendingUp,
          color: "text-cyan-400",
          bg: "bg-cyan-500/10",
        },
        {
          label: "COD Pending",
          value: fmt(stats.codPending),
          icon: AlertTriangle,
          color: "text-orange-400",
          bg: "bg-orange-500/10",
        },
        {
          label: "Confirmed",
          value: stats.confirmed.toString(),
          icon: PackageCheck,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10",
        },
        {
          label: "Shipped",
          value: stats.delivered.toString(),
          icon: PackageCheck,
          color: "text-blue-400",
          bg: "bg-blue-500/10",
        },
        {
          label: "Cancelled",
          value: stats.cancelled.toString(),
          icon: XCircle,
          color: "text-red-400",
          bg: "bg-red-500/10",
        },
        {
          label: "Return Rate",
          value: `${stats.returnRate}%`,
          icon: Package,
          color: "text-orange-400",
          bg: "bg-orange-500/10",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Your orders, revenue and performance overview
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statsLoading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] rounded-xl bg-slate-800/50 animate-pulse"
              />
            ))
          : kpis.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="bg-[#0d1528] border border-slate-700/40 rounded-xl p-3.5 flex items-center gap-3"
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                    bg,
                  )}
                >
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-white leading-tight truncate">
                    {value}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {label}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Charts row */}
      {stats && stats.totalOrders > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Revenue & Profit trend */}
          <div className="lg:col-span-2 bg-[#0d1528] border border-slate-700/40 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Revenue & Profit — Last 6 Months
            </h2>
            {stats.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.monthlyTrend}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#f59e0b"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#10b981"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    {...CHART_STYLE}
                    formatter={(v: number) => [fmt(v)]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#gRev)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gProfit)"
                    name="Profit"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                Not enough data
              </div>
            )}
          </div>

          {/* Status breakdown pie */}
          <div className="bg-[#0d1528] border border-slate-700/40 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Orders by Status
            </h2>
            {stats.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats.byStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {stats.byStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_STYLE}
                    formatter={(v: number) => [v, "Orders"]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => (
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>
                        {v.replace(/_/g, " ")}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                No data
              </div>
            )}
          </div>
        </div>
      )}

      {/* Source breakdown + Top products */}
      {stats && stats.totalOrders > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Orders by Source */}
          <div className="bg-[#0d1528] border border-slate-700/40 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Orders by Source
            </h2>
            {stats.bySource.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={stats.bySource}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="source"
                    type="category"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                    tickFormatter={(v) => v.replace(/_/g, " ")}
                  />
                  <Tooltip
                    {...CHART_STYLE}
                    formatter={(v: number) => [v, "Orders"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.bySource.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-500 text-sm">
                No data
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-[#0d1528] border border-slate-700/40 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Top Products by Revenue
            </h2>
            {stats.topProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-4">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm text-slate-200 truncate">
                          {p.name}
                        </span>
                        <span className="text-xs font-semibold text-amber-400 shrink-0">
                          {fmt(p.revenue)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (p.revenue / stats.topProducts[0].revenue) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {p.count} unit{p.count !== 1 ? "s" : ""} sold
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[140px] text-slate-500 text-sm">
                No data
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly orders bar chart */}
      {stats && stats.monthlyTrend.length > 1 && (
        <div className="bg-[#0d1528] border border-slate-700/40 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Monthly Order Count
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stats.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                {...CHART_STYLE}
                formatter={(v: number) => [v, "Orders"]}
              />
              <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-[#0d1528] border border-slate-700/40 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-700/40">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              placeholder="Search by customer, product, phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {(
              [
                "NEW",
                "PENDING_CONFIRMATION",
                "CONFIRMED",
                "NO_ANSWER",
                "CANCELLED",
                "REFUSED",
                "SHIPPED",
                "DELIVERED",
                "RETURNED",
              ] as OrderStatus[]
            ).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            onClick={loadOrders}
            className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/30 border-b border-slate-700/40">
              <tr>
                {[
                  "Customer",
                  "Product",
                  "Revenue",
                  "Profit",
                  "Status",
                  "Payment",
                  "Source",
                  "Agent",
                  "Date",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-700 rounded animate-pulse w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-500">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {o.customerName}
                      </div>
                      {o.customerCity && (
                        <div className="text-xs text-slate-500">
                          {o.customerCity}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="max-w-[120px] truncate">
                        {o.productName}
                      </div>
                      {o.quantity > 1 && (
                        <div className="text-xs text-slate-500">
                          × {o.quantity}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-400">
                      {fmt(o.orderAmount)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span
                        className={
                          o.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                        }
                      >
                        {fmt(o.netProfit)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-medium",
                          STATUS_COLORS[o.status] ||
                            "bg-slate-700 text-slate-300",
                        )}
                      >
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          o.paymentStatus === "PAID"
                            ? "text-emerald-400"
                            : o.paymentStatus === "REFUNDED"
                              ? "text-red-400"
                              : "text-amber-400",
                        )}
                      >
                        {o.paymentStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {o.source.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {o.closer?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/40">
            <span className="text-xs text-slate-500">{total} orders total</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-700/40 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-700/40 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
