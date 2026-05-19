import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Pencil,
  Save,
  X,
  Settings,
  Users,
  Link2,
} from "lucide-react";

import api from "@/lib/api";
import {
  Client,
  CloserStat,
  CommissionRule,
  CommissionType,
  User,
} from "@/types";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCrmCurrency } from "@/context/CrmCurrencyContext";

export default function ClosersSettings() {
  const { isAdmin } = useAuth();
  const { fmt } = useCrmCurrency();

  const [loading, setLoading] = useState(true);
  const [closers, setClosers] = useState<CloserStat[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [profileModal, setProfileModal] = useState<null | { userId: string }>(
    null,
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    avatar: "",
  });

  const [commissionModal, setCommissionModal] = useState<null | {
    closerId: string;
    closerName: string;
  }>(null);
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionError, setCommissionError] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(
    new Set(),
  );
  const [commissionType, setCommissionType] =
    useState<CommissionType>("FIXED_PER_ORDER");
  const [commissionValue, setCommissionValue] = useState("");

  const clientList = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  async function loadClosers() {
    setLoading(true);
    try {
      const { data } = await api.get<CloserStat[]>(
        "/crm/closers?teamOnly=true",
      );
      setClosers(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const res = await api.get<any>("/clients?limit=250");
      setClients(Array.isArray(res.data) ? res.data : res.data.clients || []);
    } catch {
      setClients([]);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadClosers();
    loadClients();
  }, [isAdmin]);

  async function openProfileModal(userId: string) {
    setProfileError("");
    setProfileSaving(false);
    try {
      const { data } = await api.get<User>(`/users/${userId}`);
      setProfileForm({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        avatar: data.avatar || "",
      });
      setProfileModal({ userId });
    } catch (err: any) {
      setProfileError(err?.response?.data?.message || "Failed to load user.");
    }
  }

  async function saveProfile() {
    if (!profileModal) return;
    setProfileSaving(true);
    setProfileError("");
    try {
      await api.put(`/users/${profileModal.userId}`, {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim() || null,
        avatar: profileForm.avatar.trim() || null,
      });
      setProfileModal(null);
      await loadClosers();
    } catch (err: any) {
      setProfileError(
        err?.response?.data?.message || "Failed to save changes.",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  function openCommissionModalFor(closer: { id: string; name: string }) {
    setCommissionError("");
    setSelectedClientIds(new Set());
    setCommissionType("FIXED_PER_ORDER");
    setCommissionValue("");
    setCommissionModal({ closerId: closer.id, closerName: closer.name });
  }

  async function saveCommissionRules() {
    if (!commissionModal) return;
    if (selectedClientIds.size === 0) {
      setCommissionError("Please select at least one client.");
      return;
    }
    if (!commissionValue || Number(commissionValue) <= 0) {
      setCommissionError(
        commissionType === "FIXED_PER_ORDER"
          ? "Please enter a fixed amount."
          : "Please enter a percentage.",
      );
      return;
    }

    setCommissionSaving(true);
    setCommissionError("");

    try {
      const selectedClients = clients.filter((c) =>
        selectedClientIds.has(c.id),
      );
      const valueNum = Number(commissionValue);

      await Promise.all(
        selectedClients.map(async (client) => {
          // Assign closer to client (ignore duplicates)
          try {
            await api.post(`/clients/${client.id}/closers`, {
              userId: commissionModal.closerId,
            });
          } catch (err: any) {
            if (err?.response?.status !== 409) throw err;
          }

          // Create or update an existing closer-specific rule for this client
          const { data: existing } = await api.get<CommissionRule[]>(
            `/crm/commission-rules?clientId=${client.id}`,
          );
          const existingForCloser = existing.find(
            (r) => r.closerId === commissionModal.closerId,
          );

          const basePayload = {
            clientId: client.id,
            closerId: commissionModal.closerId,
            name: `${commissionModal.closerName} · ${client.name}`,
            type: commissionType,
            fixedAmount: commissionType === "FIXED_PER_ORDER" ? valueNum : null,
            percentage: commissionType === "PERCENTAGE" ? valueNum : null,
            description: null,
          };

          if (existingForCloser) {
            await api.put(`/crm/commission-rules/${existingForCloser.id}`, {
              ...basePayload,
              active: true,
            });
          } else {
            await api.post(`/crm/commission-rules`, basePayload);
          }
        }),
      );

      setCommissionModal(null);
      await loadClosers();
    } catch (err: any) {
      setCommissionError(
        err?.response?.data?.message || "Failed to save commission rules.",
      );
    } finally {
      setCommissionSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="card p-6 max-w-4xl">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Closers Settings
          </h2>
        </div>
        <p className="text-sm text-slate-500 mt-2">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Closers Settings
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Edit closer profiles and commission settings.
          </p>
        </div>
        <button onClick={loadClosers} className="btn-secondary p-2.5">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : closers.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          No closers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {closers.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        className="w-full h-full object-cover"
                        alt={c.name}
                      />
                    ) : (
                      getInitials(c.name)
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {c.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.role.replace(/_/g, " ")} · {c.email}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
                    onClick={() =>
                      openCommissionModalFor({ id: c.id, name: c.name })
                    }
                    title="Edit commission rules"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Commission
                  </button>
                  <button
                    className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
                    onClick={() => openProfileModal(c.id)}
                    title="Edit closer profile"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="Total" value={c.totalOrders} />
                <Stat label="Confirmed" value={c.confirmedOrders} />
                <Stat label="Shipped" value={c.shippedOrders} />
                <Stat label="Delivered" value={c.deliveredOrders} />
                <Stat label="Rate" value={`${c.conversionRate}%`} accent />
                <Stat label="Earned" value={fmt(c.totalEarnings)} accent />
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Commission rules
                  </div>
                  <div className="text-xs text-slate-500">
                    {c.commissionRuleCount || 0} active
                  </div>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {c.commissionRuleType
                    ? c.commissionRuleType === "MIXED"
                      ? "Mixed"
                      : c.commissionRuleType === "FIXED_PER_ORDER"
                        ? `Fixed · ${c.commissionRuleValue ?? "—"}`
                        : `Percent · ${c.commissionRuleValue ?? "—"}%`
                    : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => (!profileSaving ? setProfileModal(null) : null)}
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Edit closer
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Update profile fields (admin only).
                </p>
              </div>
              <button
                onClick={() => setProfileModal(null)}
                disabled={profileSaving}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Name</label>
                <input
                  className="input mt-1"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input
                  className="input mt-1"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm((s) => ({ ...s, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input mt-1"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="+212..."
                />
              </div>
              <div>
                <label className="label">Avatar URL</label>
                <input
                  className="input mt-1"
                  value={profileForm.avatar}
                  onChange={(e) =>
                    setProfileForm((s) => ({ ...s, avatar: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
            </div>

            {profileError && (
              <p className="text-sm text-red-500">{profileError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setProfileModal(null)}
                disabled={profileSaving}
                className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2"
              >
                {profileSaving ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {profileSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission modal */}
      {commissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() =>
              !commissionSaving ? setCommissionModal(null) : null
            }
          />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Commission settings
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Choose client(s) + commission for {commissionModal.closerName}
                  .
                </p>
              </div>
              <button
                onClick={() => setCommissionModal(null)}
                disabled={commissionSaving}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <div>
              <label className="label">Client(s) *</label>
              <div className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2">
                {clientList.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">
                    No clients found
                  </div>
                ) : (
                  clientList.map((client) => {
                    const checked = selectedClientIds.has(client.id);
                    return (
                      <label
                        key={client.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selectedClientIds);
                              if (e.target.checked) next.add(client.id);
                              else next.delete(client.id);
                              setSelectedClientIds(next);
                            }}
                            className="accent-amber-500"
                          />
                          <span className="text-sm text-slate-800 dark:text-slate-200">
                            {client.name}
                          </span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Selected: {selectedClientIds.size}
                </span>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setSelectedClientIds(new Set())}
                  disabled={commissionSaving || selectedClientIds.size === 0}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Commission Type</label>
                <select
                  className="select mt-1"
                  value={commissionType}
                  onChange={(e) =>
                    setCommissionType(e.target.value as CommissionType)
                  }
                >
                  <option value="FIXED_PER_ORDER">Fixed per Order</option>
                  <option value="PERCENTAGE">Percentage of Sale</option>
                </select>
              </div>
              <div>
                <label className="label">
                  {commissionType === "FIXED_PER_ORDER"
                    ? "Fixed Amount"
                    : "Percentage"}
                </label>
                <input
                  className="input mt-1"
                  type="number"
                  step={commissionType === "FIXED_PER_ORDER" ? "0.01" : "0.1"}
                  max={commissionType === "PERCENTAGE" ? 100 : undefined}
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  placeholder={
                    commissionType === "FIXED_PER_ORDER" ? "20" : "5"
                  }
                />
              </div>
            </div>

            {commissionError && (
              <p className="text-sm text-red-500">{commissionError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCommissionModal(null)}
                disabled={commissionSaving}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveCommissionRules}
                disabled={commissionSaving}
                className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2"
              >
                {commissionSaving && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {commissionSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-2">
      <div
        className={cn(
          "text-sm font-semibold",
          accent
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-900 dark:text-white",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
