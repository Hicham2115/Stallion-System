import { useEffect, useState, FormEvent, useCallback } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Package,
  TrendingUp,
  CheckCircle,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { OrderStatus, OrderSource, OrderPaymentStatus } from "@/types";
import { cn, formatDate } from "@/lib/utils";

interface MyClient {
  id: string;
  name: string;
  service: string;
  status: string;
}
interface MyOrder {
  id: string;
  clientId: string;
  client?: { id: string; name: string };
  customerName: string;
  customerPhone?: string;
  customerCity?: string;
  productName: string;
  quantity: number;
  orderAmount: number;
  closerCommission: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  source: OrderSource;
  notes?: string;
  createdAt: string;
}
interface MyStats {
  totalOrders: number;
  confirmed: number;
  shipped?: number;
  delivered: number;
  conversionRate: number;
  pendingCommission: number;
  totalCommission: number;
}

const CLOSER_STATUSES: OrderStatus[] = [
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "NO_ANSWER",
  "CANCELLED",
  "REFUSED",
];
const SOURCES: OrderSource[] = [
  "FACEBOOK_ADS",
  "TIKTOK_ADS",
  "GOOGLE_ADS",
  "ORGANIC",
  "WHATSAPP",
  "INSTAGRAM",
  "OTHER",
];

function fmt(n: number) {
  return n.toLocaleString("en-MA", { maximumFractionDigits: 0 }) + " MAD";
}

const STATUS_CONFIG: Partial<
  Record<OrderStatus, { label: string; color: string }>
> = {
  NEW: {
    label: "New",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  PENDING_CONFIRMATION: {
    label: "Pending",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  CONFIRMED: {
    label: "Confirmed",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  NO_ANSWER: {
    label: "No Answer",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  REFUSED: {
    label: "Refused",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  SHIPPED: {
    label: "Shipped",
    color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  RETURNED: {
    label: "Returned",
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  },
};

const LIST_STATUSES: OrderStatus[] = [
  "NEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "NO_ANSWER",
  "CANCELLED",
  "REFUSED",
  "SHIPPED",
  "RETURNED",
];

const defaultForm = {
  clientId: "",
  customerName: "",
  customerPhone: "",
  customerCity: "",
  productName: "",
  quantity: "1",
  orderAmount: "",
  productCost: "0",
  shippingCost: "0",
  status: "NEW" as OrderStatus,
  source: "OTHER" as OrderSource,
  notes: "",
};

export default function MyOrders() {
  const { user } = useAuth();
  const [clients, setClients] = useState<MyClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const loadAll = useCallback(async () => {
    setClientsLoading(true);
    try {
      const [clientsRes, statsRes] = await Promise.all([
        api.get<MyClient[]>("/crm/my-clients"),
        api.get<MyStats>("/crm/my-stats"),
      ]);
      setClients(clientsRes.data);

      // Backward-compatible: older backend versions don't return `shipped`.
      // In that case, derive it from the existing /crm/my-orders count.
      let shipped = (statsRes.data as any).shipped as number | undefined;
      if (typeof shipped !== "number") {
        const shippedRes = await api.get<{ total: number }>(
          "/crm/my-orders?status=SHIPPED&page=1",
        );
        shipped = shippedRes.data.total ?? 0;
      }

      const totalOrders = statsRes.data.totalOrders ?? 0;
      const confirmed = statsRes.data.confirmed ?? 0;
      const delivered = statsRes.data.delivered ?? 0;
      const conversionRate =
        totalOrders > 0
          ? Math.round(((confirmed + shipped + delivered) / totalOrders) * 100)
          : 0;

      setStats({
        ...statsRes.data,
        shipped,
        conversionRate,
      });
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await api.get<{
        orders: MyOrder[];
        total: number;
        pages: number;
      }>(`/crm/my-orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleStatusChange(order: MyOrder, newStatus: OrderStatus) {
    if (updatingStatusId) return;
    setUpdatingStatusId(order.id);
    try {
      await api.put(`/crm/orders/${order.id}`, { status: newStatus });
      setOrders((prev) =>
        prev.map((x) => (x.id === order.id ? { ...x, status: newStatus } : x)),
      );
      await loadAll();
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !form.clientId ||
      !form.customerName ||
      !form.productName ||
      !form.orderAmount
    ) {
      setError("Client, customer name, product and amount are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/crm/orders", {
        ...form,
        closerId: user?.id,
        quantity: Number(form.quantity),
        orderAmount: Number(form.orderAmount),
        productCost: Number(form.productCost),
        shippingCost: Number(form.shippingCost),
        adCost: 0,
      });
      setForm(defaultForm);
      setShowForm(false);
      await Promise.all([loadOrders(), loadAll()]);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  const netProfit =
    (Number(form.orderAmount) || 0) -
    (Number(form.productCost) || 0) -
    (Number(form.shippingCost) || 0);

  if (clientsLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Package className="w-14 h-14 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          No clients assigned
        </h2>
        <p className="text-slate-500 mt-2 text-sm">
          Ask your admin to assign you as a closer to a client before you can
          add orders.
        </p>
        <button
          onClick={loadAll}
          className="mt-5 btn-secondary flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            My Orders
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Orders you've submitted · {clients.length} client
            {clients.length !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex items-center gap-2"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add Order
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Total Orders",
              value: stats.totalOrders.toString(),
              icon: Package,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Confirmed",
              value: stats.confirmed.toString(),
              icon: CheckCircle,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Shipped",
              value: String(stats.shipped ?? 0),
              icon: CheckCircle,
              color: "text-amber-500",
              bg: "bg-amber-500/10",
            },
            {
              label: "Conv. Rate",
              value: `${stats.conversionRate}%`,
              icon: TrendingUp,
              color: "text-purple-500",
              bg: "bg-purple-500/10",
            },
            {
              label: "Pending Pay",
              value: fmt(stats.pendingCommission),
              icon: DollarSign,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
            },
            {
              label: "Total Earned",
              value: fmt(stats.totalCommission),
              icon: DollarSign,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="card p-3 flex flex-col items-center text-center gap-1"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  bg,
                )}
              >
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {value}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Order Form */}
      {showForm && (
        <form
          onSubmit={submit}
          className="card p-5 border-2 border-amber-400/30 space-y-4"
        >
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-500" /> New Order
          </h3>

          {/* Client */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client *</label>
              <select
                className="select mt-1"
                value={form.clientId}
                onChange={(e) => set("clientId", e.target.value)}
                required
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Order Status</label>
              <select
                className="select mt-1"
                value={form.status}
                onChange={(e) => set("status", e.target.value as OrderStatus)}
              >
                {CLOSER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Customer Name *</label>
              <input
                className="input mt-1"
                value={form.customerName}
                onChange={(e) => set("customerName", e.target.value)}
                placeholder="Mohamed Alami"
                required
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input mt-1"
                value={form.customerPhone}
                onChange={(e) => set("customerPhone", e.target.value)}
                placeholder="+212 6…"
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                className="input mt-1"
                value={form.customerCity}
                onChange={(e) => set("customerCity", e.target.value)}
                placeholder="Casablanca"
              />
            </div>
          </div>

          {/* Product */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product Name *</label>
              <input
                className="input mt-1"
                value={form.productName}
                onChange={(e) => set("productName", e.target.value)}
                placeholder="Product name"
                required
              />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                className="input mt-1"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Order Amount (MAD) *</label>
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                value={form.orderAmount}
                onChange={(e) => set("orderAmount", e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="label">Product Cost (MAD)</label>
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                value={form.productCost}
                onChange={(e) => set("productCost", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="label">Shipping Cost (MAD)</label>
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                value={form.shippingCost}
                onChange={(e) => set("shippingCost", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Profit preview */}
          <div
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-medium",
              netProfit >= 0
                ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-900/10 text-red-600",
            )}
          >
            Estimated Margin: {netProfit.toFixed(2)} MAD
          </div>

          {/* Source + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Source</label>
              <select
                className="select mt-1"
                value={form.source}
                onChange={(e) => set("source", e.target.value as OrderSource)}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                className="input mt-1"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Optional notes…"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary px-5 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
            >
              {saving && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {saving ? "Saving…" : "Submit Order"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search orders…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="select w-full sm:w-48"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          {LIST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s]?.label ?? s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button onClick={loadOrders} className="btn-secondary p-2.5">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {[
                  "Customer",
                  "Product",
                  "Amount",
                  "Commission",
                  "Status",
                  "Client",
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const sc =
                    STATUS_CONFIG[o.status] ??
                    ({
                      label: o.status.replace(/_/g, " "),
                      color:
                        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                    } as const);

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {o.customerName}
                        </div>
                        {o.customerCity && (
                          <div className="text-xs text-slate-400">
                            {o.customerCity}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div>{o.productName}</div>
                        {o.quantity > 1 && (
                          <div className="text-xs text-slate-400">
                            × {o.quantity}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {fmt(o.orderAmount)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">
                        {o.closerCommission > 0 ? (
                          fmt(o.closerCommission)
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            handleStatusChange(o, e.target.value as OrderStatus)
                          }
                          disabled={updatingStatusId === o.id}
                          className={cn(
                            "text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer disabled:opacity-60",
                            sc.color,
                          )}
                        >
                          {/* Keep current status visible even if not in the list */}
                          {!LIST_STATUSES.includes(o.status) && (
                            <option value={o.status}>{sc.label}</option>
                          )}
                          {LIST_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_CONFIG[s]?.label ?? s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {o.client?.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {formatDate(o.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">{total} orders</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronUp className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-xs text-slate-500">
                Page {page}/{pages}
              </span>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 disabled:opacity-40"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
