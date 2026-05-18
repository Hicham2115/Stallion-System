import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import { CrmOrder, OrderStatus, Client, User } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import OrderModal from "./OrderModal";
import { useCrmCurrency } from "@/context/CrmCurrencyContext";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
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
  DELIVERED: {
    label: "Shipped in all platforme",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  RETURNED: {
    label: "Returned",
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  },
};

const PAYMENT_CONFIG = {
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  COD_PENDING:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REFUNDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthOptions() {
  const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
  return Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - index, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: `${fmtMonth.format(date)} ${date.getFullYear()}`,
      from: toIsoDate(start),
      to: toIsoDate(end),
    };
  });
}

export default function Orders() {
  const { fmt } = useCrmCurrency();
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOrder, setModalOrder] = useState<CrmOrder | null | undefined>(
    undefined,
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<any>("/clients?limit=100"),
      api.get<any>("/users?limit=100"),
    ]).then(([c, u]) => {
      setClients(Array.isArray(c.data) ? c.data : c.data.clients || []);
      setUsers(u.data.users || []);
    });
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (clientFilter) params.set("clientId", clientFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (monthFilter) {
        const month = monthOptions().find((m) => m.key === monthFilter);
        if (month) {
          params.set("from", month.from);
          params.set("to", month.to);
        }
      }
      const { data } = await api.get<{
        orders: CrmOrder[];
        total: number;
        pages: number;
      }>(`/crm/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, search, clientFilter, statusFilter, monthFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  useEffect(() => {
    setPage(1);
  }, [search, clientFilter, statusFilter, monthFilter]);

  async function handleDelete(id: string) {
    await api.delete(`/crm/orders/${id}`);
    setConfirmDelete(null);
    fetchOrders();
  }

  async function handleStatusChange(order: CrmOrder, newStatus: OrderStatus) {
    await api.put(`/crm/orders/${order.id}`, { status: newStatus });
    fetchOrders();
  }

  return (
    <div className="space-y-5 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Orders
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{total} total orders</p>
        </div>
        <button
          onClick={() => setModalOrder(null)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search orders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select w-full sm:w-48"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="select w-full sm:w-44"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        >
          <option value="">All Months</option>
          {monthOptions().map((month) => (
            <option key={month.key} value={month.key}>
              {month.label}
            </option>
          ))}
        </select>
        <button onClick={fetchOrders} className="btn-secondary p-2.5">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                {[
                  "Customer",
                  "Product",
                  "Amount",
                  "Net Profit",
                  "Status",
                  "Payment",
                  "Closer",
                  "Source",
                  "Date",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(10)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const sc = STATUS_CONFIG[o.status];
                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
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
                        {o.customerPhone && (
                          <div className="text-xs text-slate-400">
                            {o.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800 dark:text-slate-200">
                          {o.productName}
                        </div>
                        {o.quantity > 1 && (
                          <div className="text-xs text-slate-400">
                            ×{o.quantity}
                          </div>
                        )}
                        {o.client && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            {o.client.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {fmt(o.orderAmount)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-semibold whitespace-nowrap",
                          o.netProfit >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-500",
                        )}
                      >
                        {fmt(o.netProfit)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            handleStatusChange(o, e.target.value as OrderStatus)
                          }
                          className={cn(
                            "text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer",
                            sc.color,
                          )}
                        >
                          {Object.entries(STATUS_CONFIG).map(
                            ([v, { label }]) => (
                              <option key={v} value={v}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "badge whitespace-nowrap text-xs",
                            PAYMENT_CONFIG[o.paymentStatus],
                          )}
                        >
                          {o.paymentStatus.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {o.closer?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {o.source.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setModalOrder(o)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(o.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {o.shopifyOrderId && (
                            <a
                              href={`https://${o.shopifyStore}/admin/orders/${o.shopifyOrderId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {total} orders · page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-slate-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-slate-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Modal */}
      {modalOrder !== undefined && (
        <OrderModal
          order={modalOrder}
          clients={clients}
          users={users}
          onClose={() => setModalOrder(undefined)}
          onSaved={fetchOrders}
        />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Delete Order?
            </h3>
            <p className="text-sm text-slate-500">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
