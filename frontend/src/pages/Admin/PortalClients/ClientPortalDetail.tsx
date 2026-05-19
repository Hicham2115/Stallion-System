import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Send,
  Settings,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Key,
  Copy,
  ExternalLink,
  RefreshCw,
  Store,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import DateSelector from "@/components/DateSelector";
import {
  Client,
  ProjectUpdate,
  ContentDelivery,
  ContentCategory,
  ContentStatus,
  ProjectPhase,
  Currency,
  ClientCost,
  ShopifyConfig,
} from "@/types";

interface PortalUserInfo {
  id: string;
  email: string;
  name: string;
  active: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface DetailData {
  client: Client;
  updates: ProjectUpdate[];
  content: ContentDelivery[];
  portalUser: PortalUserInfo | null;
  costs: ClientCost[];
}

const TABS = [
  "Overview",
  "Updates",
  "Content",
  "KPI Config",
  "Shopify",
  "Notifications",
] as const;
type Tab = (typeof TABS)[number];

interface SyncResult {
  message: string;
  created: number;
  updated: number;
  total: number;
}

function isSyncResult(result: SyncResult | { message: string }): result is SyncResult {
  return "total" in result && "created" in result && "updated" in result;
}

const PHASE_OPTS: ProjectPhase[] = [
  "DISCOVERY",
  "PLANNING",
  "DESIGN",
  "DEVELOPMENT",
  "TESTING",
  "DEPLOYMENT",
  "MAINTENANCE",
];
const CATEGORY_OPTS: ContentCategory[] = [
  "SOCIAL_POST",
  "REEL",
  "VIDEO",
  "AD_CREATIVE",
  "BANNER",
  "THUMBNAIL",
  "BRANDING",
  "OTHER",
];
const CATEGORY_LABELS: Record<string, string> = {
  SOCIAL_POST: "Social Post",
  REEL: "Reel",
  VIDEO: "Video",
  AD_CREATIVE: "Ad Creative",
  BANNER: "Banner",
  THUMBNAIL: "Thumbnail",
  BRANDING: "Branding",
  OTHER: "Other",
};
const STATUS_OPTS: ContentStatus[] = [
  "DRAFT",
  "WAITING_APPROVAL",
  "APPROVED",
  "NEEDS_REVISION",
  "PUBLISHED",
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InputField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
      />
    </div>
  );
}

function SelectField({
  label,
  children,
  ...props
}: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <select
        {...props}
        className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
      >
        {children}
      </select>
    </div>
  );
}

export default function ClientPortalDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  // Create account form
  const [accountForm, setAccountForm] = useState({
    email: "",
    name: "",
    password: "",
  });
  const [accountLoading, setAccountLoading] = useState(false);

  // Update form
  const [updateForm, setUpdateForm] = useState({
    title: "",
    content: "",
    phase: "",
    imageUrl: "",
    fileUrl: "",
  });
  const [updateLoading, setUpdateLoading] = useState(false);

  // Content form
  const [contentForm, setContentForm] = useState({
    title: "",
    description: "",
    fileUrl: "",
    previewUrl: "",
    externalLink: "",
    category: "SOCIAL_POST" as ContentCategory,
    status: "WAITING_APPROVAL" as ContentStatus,
  });
  const [contentLoading, setContentLoading] = useState(false);

  // KPI config
  const [kpiForm, setKpiForm] = useState({
    metaToken: "",
    metaAdAccountId: "",
  });
  const [kpiHasToken, setKpiHasToken] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Shopify config
  const [shopifyConfigs, setShopifyConfigs] = useState<ShopifyConfig[]>([]);
  const [shopifyForm, setShopifyForm] = useState({
    storeName: "",
    storeUrl: "",
    accessToken: "",
  });
  const [shopifyHasToken, setShopifyHasToken] = useState(false);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [shopifySyncing, setShopifySyncing] = useState<string | null>(null);
  const [shopifySyncResult, setShopifySyncResult] = useState<{
    id: string;
    result: SyncResult | { message: string };
  } | null>(null);

  // Reset password form
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Currency
  const [currencyLoading, setCurrencyLoading] = useState(false);

  // Notify form
  const [notifyForm, setNotifyForm] = useState({
    title: "",
    message: "",
    type: "info",
    link: "",
  });
  const [notifyLoading, setNotifyLoading] = useState(false);

  // Costs
  const [costForm, setCostForm] = useState({ name: "", amount: "", date: "" });
  const [costLoading, setCostLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get<DetailData>(`/portal-admin/${clientId}`),
      api.get<{ metaAdAccountId: string | null; hasToken: boolean }>(
        `/portal-admin/${clientId}/kpi-config`,
      ),
      api.get<ShopifyConfig[]>(`/portal-admin/${clientId}/shopify`),
    ])
      .then(([detailRes, kpiRes, shopifyRes]) => {
        setData(detailRes.data);
        setKpiForm((f) => ({
          ...f,
          metaAdAccountId: kpiRes.data.metaAdAccountId ?? "",
        }));
        setKpiHasToken(kpiRes.data.hasToken);
        setShopifyConfigs(shopifyRes.data);
        setShopifyHasToken(shopifyRes.data.some((config) => !!config.accessToken));
        if (shopifyRes.data[0]) {
          setShopifyForm((form) => ({
            ...form,
            storeName: shopifyRes.data[0].storeName,
            storeUrl: shopifyRes.data[0].storeUrl,
          }));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const createAccount = async () => {
    if (!accountForm.email || !accountForm.name || !accountForm.password)
      return;
    setAccountLoading(true);
    try {
      await api.post(`/portal-admin/${clientId}/create-account`, accountForm);
      showToast("Portal account created!");
      fetchData();
      setAccountForm({ email: "", name: "", password: "" });
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Failed to create account",
        false,
      );
    } finally {
      setAccountLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (
      !confirm(
        "Delete this portal account? This will remove the client's access.",
      )
    )
      return;
    await api.delete(`/portal-admin/${clientId}/account`);
    showToast("Portal account deleted");
    fetchData();
  };

  const doResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) {
      showToast("Password must be at least 6 characters", false);
      return;
    }
    setResetLoading(true);
    try {
      await api.put(`/portal-admin/${clientId}/reset-password`, {
        password: resetPassword,
      });
      showToast("Password reset successfully!");
      setResetPassword("");
    } catch (err: any) {
      showToast(
        err.response?.data?.message || "Failed to reset password",
        false,
      );
    } finally {
      setResetLoading(false);
    }
  };

  const postUpdate = async () => {
    if (!updateForm.title || !updateForm.content) return;
    setUpdateLoading(true);
    try {
      await api.post(`/portal-admin/${clientId}/updates`, {
        ...updateForm,
        phase: updateForm.phase || null,
        imageUrl: updateForm.imageUrl || null,
        fileUrl: updateForm.fileUrl || null,
      });
      showToast("Update posted!");
      setUpdateForm({
        title: "",
        content: "",
        phase: "",
        imageUrl: "",
        fileUrl: "",
      });
      fetchData();
    } finally {
      setUpdateLoading(false);
    }
  };

  const deleteUpdate = async (id: string) => {
    await api.delete(`/portal-admin/updates/${id}`);
    setData((d) =>
      d ? { ...d, updates: d.updates.filter((u) => u.id !== id) } : d,
    );
    showToast("Update deleted");
  };

  const addContent = async () => {
    if (!contentForm.title) return;
    setContentLoading(true);
    try {
      await api.post(`/portal-admin/${clientId}/content`, contentForm);
      showToast("Content added!");
      setContentForm({
        title: "",
        description: "",
        fileUrl: "",
        previewUrl: "",
        externalLink: "",
        category: "SOCIAL_POST",
        status: "WAITING_APPROVAL",
      });
      fetchData();
    } finally {
      setContentLoading(false);
    }
  };

  const deleteContent = async (id: string) => {
    await api.delete(`/portal-admin/content/${id}`);
    setData((d) =>
      d ? { ...d, content: d.content.filter((c) => c.id !== id) } : d,
    );
    showToast("Content deleted");
  };

  const saveKpi = async () => {
    setKpiLoading(true);
    try {
      await api.put(`/portal-admin/${clientId}/kpi-config`, kpiForm);
      showToast("KPI config saved!");
      setKpiHasToken(!!kpiForm.metaToken);
    } finally {
      setKpiLoading(false);
    }
  };

  const saveShopify = async () => {
    if (!clientId) return;
    if (!shopifyForm.storeName || !shopifyForm.storeUrl) return;
    if (!shopifyHasToken && !shopifyForm.accessToken) return;

    setShopifyLoading(true);
    try {
      if (shopifyConfigs[0]) {
        const { data } = await api.put<ShopifyConfig>(
          `/portal-admin/shopify/${shopifyConfigs[0].id}`,
          shopifyForm,
        );
        setShopifyConfigs((configs) =>
          configs.map((config) => (config.id === data.id ? data : config)),
        );
        setShopifyHasToken(true);
      } else {
        const { data } = await api.post<ShopifyConfig>(
          `/portal-admin/${clientId}/shopify`,
          shopifyForm,
        );
        setShopifyConfigs([data]);
        setShopifyHasToken(true);
      }
      setShopifyForm((form) => ({ ...form, accessToken: "" }));
      showToast("Shopify connection saved!");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to save Shopify", false);
    } finally {
      setShopifyLoading(false);
    }
  };

  const syncShopify = async (config: ShopifyConfig) => {
    setShopifySyncing(config.id);
    setShopifySyncResult(null);
    try {
      const { data } = await api.post<SyncResult>(
        `/portal-admin/shopify/${config.id}/sync`,
      );
      setShopifySyncResult({ id: config.id, result: data });
      setShopifyConfigs((configs) =>
        configs.map((item) =>
          item.id === config.id
            ? { ...item, lastSyncAt: new Date().toISOString() }
            : item,
        ),
      );
      showToast("Shopify orders synced!");
    } catch (err: any) {
      const message = err.response?.data?.message || "Sync failed";
      setShopifySyncResult({ id: config.id, result: { message } });
      showToast(message, false);
    } finally {
      setShopifySyncing(null);
    }
  };

  const toggleShopify = async (config: ShopifyConfig) => {
    const { data } = await api.put<ShopifyConfig>(
      `/portal-admin/shopify/${config.id}`,
      { active: !config.active },
    );
    setShopifyConfigs((configs) =>
      configs.map((item) => (item.id === data.id ? data : item)),
    );
  };

  const deleteShopify = async (id: string) => {
    if (!confirm("Remove this Shopify connection?")) return;
    await api.delete(`/portal-admin/shopify/${id}`);
    setShopifyConfigs((configs) => configs.filter((config) => config.id !== id));
    setShopifyHasToken(false);
    setShopifyForm({ storeName: "", storeUrl: "", accessToken: "" });
    showToast("Shopify connection removed");
  };

  const saveCurrency = async (currency: Currency) => {
    setCurrencyLoading(true);
    try {
      await api.put(`/portal-admin/${clientId}/currency`, {
        preferredCurrency: currency,
      });
      setData((d) =>
        d ? { ...d, client: { ...d.client, preferredCurrency: currency } } : d,
      );
      showToast(`Currency set to ${currency}`);
    } catch {
      showToast("Failed to update currency", false);
    } finally {
      setCurrencyLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!notifyForm.title || !notifyForm.message) return;
    setNotifyLoading(true);
    try {
      await api.post(`/portal-admin/${clientId}/notify`, notifyForm);
      showToast("Notification sent!");
      setNotifyForm({ title: "", message: "", type: "info", link: "" });
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to send", false);
    } finally {
      setNotifyLoading(false);
    }
  };

  const addCost = async () => {
    if (!clientId) return;
    if (!costForm.name.trim() || !costForm.amount || !costForm.date) return;
    setCostLoading(true);
    try {
      const payload = {
        name: costForm.name.trim(),
        amount: Number(costForm.amount),
        date: costForm.date,
      };
      const res = await api.post<ClientCost>(
        `/portal-admin/${clientId}/costs`,
        payload,
      );
      setData((d) => (d ? { ...d, costs: [res.data, ...(d.costs || [])] } : d));
      setCostForm({ name: "", amount: "", date: "" });
      showToast("Cost added");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Failed to add cost", false);
    } finally {
      setCostLoading(false);
    }
  };

  const deleteCost = async (id: string) => {
    await api.delete(`/portal-admin/costs/${id}`);
    setData((d) =>
      d ? { ...d, costs: (d.costs || []).filter((c) => c.id !== id) } : d,
    );
    showToast("Cost deleted");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="text-slate-400">Client not found</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium",
            toast.ok
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400",
          )}
        >
          {toast.ok ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/portal-admin")}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{data.client.name}</h1>
          <p className="text-sm text-slate-500">
            {data.client.service} · Portal Management
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1528] border border-slate-800/60 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
              activeTab === tab
                ? "bg-amber-500 text-white"
                : "text-slate-400 hover:text-white",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "Overview" && (
        <div className="space-y-4">
          {/* Currency Settings */}
          <Section title="Portal Currency">
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Select the currency shown to this client in their portal. All
                MAD amounts are converted using live exchange rates.
              </p>
              <div className="flex items-center gap-2">
                {(["MAD", "USD", "EUR"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    disabled={currencyLoading}
                    onClick={() => saveCurrency(c)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all",
                      (data.client.preferredCurrency || "MAD") === c
                        ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {(data.client.preferredCurrency || "MAD") !== "MAD" && (
                <p className="text-xs text-amber-400/80">
                  Client sees amounts in {data.client.preferredCurrency}.
                  Converted from MAD at live rates.
                </p>
              )}
            </div>
          </Section>

          <Section title="Portal Account">
            {data.portalUser ? (
              <div className="space-y-4">
                {/* Account info row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <User className="w-4.5 h-4.5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {data.portalUser.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {data.portalUser.email}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              data.portalUser!.email,
                            );
                            showToast("Email copied!");
                          }}
                          className="text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Last login:{" "}
                        {data.portalUser.lastLogin
                          ? new Date(
                              data.portalUser.lastLogin,
                            ).toLocaleDateString()
                          : "Never logged in"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={deleteAccount}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Account
                  </button>
                </div>

                {/* Portal login link */}
                <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <ExternalLink className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-blue-400 mb-0.5">
                      Client Portal Login URL
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {window.location.origin}/portal/login
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/portal/login`,
                      );
                      showToast("Link copied!");
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/20 text-xs text-blue-400 hover:bg-blue-500/30 transition-colors flex-shrink-0"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>

                {/* Reset password */}
                <div className="border border-slate-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-white">
                      Reset Password
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="New password (min 6 characters)"
                      className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      onClick={doResetPassword}
                      disabled={resetLoading || !resetPassword}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <Key className="w-3.5 h-3.5" />
                      {resetLoading ? "Resetting..." : "Reset"}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">
                      {data.updates.length}
                    </div>
                    <div className="text-xs text-slate-500">Updates</div>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">
                      {data.content.length}
                    </div>
                    <div className="text-xs text-slate-500">Content Items</div>
                  </div>
                  <div className="bg-slate-800/40 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-white">
                      {
                        data.content.filter(
                          (c) => c.status === "WAITING_APPROVAL",
                        ).length
                      }
                    </div>
                    <div className="text-xs text-slate-500">
                      Awaiting Approval
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">
                    No portal account yet. Create one to give this client
                    access.
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <InputField
                    label="Full Name"
                    placeholder="Client name"
                    value={accountForm.name}
                    onChange={(e) =>
                      setAccountForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                  <InputField
                    label="Email"
                    type="email"
                    placeholder="client@company.com"
                    value={accountForm.email}
                    onChange={(e) =>
                      setAccountForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                  <InputField
                    label="Password"
                    type="password"
                    placeholder="Temporary password"
                    value={accountForm.password}
                    onChange={(e) =>
                      setAccountForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>
                <button
                  onClick={createAccount}
                  disabled={accountLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {accountLoading ? "Creating..." : "Create Portal Account"}
                </button>
              </div>
            )}
          </Section>

          <Section title="Costs">
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <InputField
                  label="Cost Name"
                  placeholder="e.g. Ads, Tools, Freelancer"
                  value={costForm.name}
                  onChange={(e) =>
                    setCostForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <InputField
                  label="Amount"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={costForm.amount}
                  onChange={(e) =>
                    setCostForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <DateSelector
                  label="Date"
                  value={costForm.date}
                  onChange={(date) => setCostForm((f) => ({ ...f, date }))}
                  dark
                />
              </div>

              <button
                onClick={addCost}
                disabled={
                  costLoading ||
                  !costForm.name.trim() ||
                  !costForm.amount ||
                  !costForm.date
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {costLoading ? "Adding..." : "Add Cost"}
              </button>

              <div className="border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-700/50">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Saved Costs ({data.costs?.length ?? 0})
                  </div>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {(data.costs?.length ?? 0) === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-500">
                      No costs yet
                    </div>
                  ) : (
                    data.costs.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {new Date(c.date).toLocaleDateString()} ·{" "}
                            {Number(c.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteCost(c.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                          aria-label="Delete cost"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Updates */}
      {activeTab === "Updates" && (
        <div className="space-y-4">
          <Section title="Post New Update">
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Title"
                  placeholder="Update title"
                  value={updateForm.title}
                  onChange={(e) =>
                    setUpdateForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
                <SelectField
                  label="Phase (optional)"
                  value={updateForm.phase}
                  onChange={(e) =>
                    setUpdateForm((f) => ({ ...f, phase: e.target.value }))
                  }
                >
                  <option value="">No phase</option>
                  {PHASE_OPTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Content
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the update..."
                  value={updateForm.content}
                  onChange={(e) =>
                    setUpdateForm((f) => ({ ...f, content: e.target.value }))
                  }
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Image URL (optional)"
                  placeholder="https://..."
                  value={updateForm.imageUrl}
                  onChange={(e) =>
                    setUpdateForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                />
                <InputField
                  label="File URL (optional)"
                  placeholder="https://..."
                  value={updateForm.fileUrl}
                  onChange={(e) =>
                    setUpdateForm((f) => ({ ...f, fileUrl: e.target.value }))
                  }
                />
              </div>
              <button
                onClick={postUpdate}
                disabled={
                  updateLoading || !updateForm.title || !updateForm.content
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {updateLoading ? "Posting..." : "Post Update"}
              </button>
            </div>
          </Section>

          <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/60">
              <h3 className="text-sm font-semibold text-white">
                Posted Updates ({data.updates.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-800/50">
              {data.updates.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-slate-500">
                  No updates posted yet
                </div>
              ) : (
                data.updates.map((u) => (
                  <div key={u.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {u.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {u.phase && (
                            <span className="text-amber-400 mr-2">
                              {u.phase}
                            </span>
                          )}
                          {new Date(u.createdAt).toLocaleDateString()} ·{" "}
                          {u.comments?.length ?? 0} comments
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                          {u.content}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteUpdate(u.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === "Content" && (
        <div className="space-y-4">
          <Section title="Add Content Item">
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Title"
                  placeholder="Content title"
                  value={contentForm.title}
                  onChange={(e) =>
                    setContentForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
                <SelectField
                  label="Category"
                  value={contentForm.category}
                  onChange={(e) =>
                    setContentForm((f) => ({
                      ...f,
                      category: e.target.value as ContentCategory,
                    }))
                  }
                >
                  {CATEGORY_OPTS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <InputField
                label="Description (optional)"
                placeholder="Brief description..."
                value={contentForm.description}
                onChange={(e) =>
                  setContentForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <InputField
                  label="File URL"
                  placeholder="Download link"
                  value={contentForm.fileUrl}
                  onChange={(e) =>
                    setContentForm((f) => ({ ...f, fileUrl: e.target.value }))
                  }
                />
                <InputField
                  label="Preview URL"
                  placeholder="Preview image"
                  value={contentForm.previewUrl}
                  onChange={(e) =>
                    setContentForm((f) => ({
                      ...f,
                      previewUrl: e.target.value,
                    }))
                  }
                />
                <InputField
                  label="External Link"
                  placeholder="View online"
                  value={contentForm.externalLink}
                  onChange={(e) =>
                    setContentForm((f) => ({
                      ...f,
                      externalLink: e.target.value,
                    }))
                  }
                />
              </div>
              <SelectField
                label="Status"
                value={contentForm.status}
                onChange={(e) =>
                  setContentForm((f) => ({
                    ...f,
                    status: e.target.value as ContentStatus,
                  }))
                }
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </SelectField>
              <button
                onClick={addContent}
                disabled={contentLoading || !contentForm.title}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {contentLoading ? "Adding..." : "Add Content"}
              </button>
            </div>
          </Section>

          <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800/60">
              <h3 className="text-sm font-semibold text-white">
                Content Items ({data.content.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-800/50">
              {data.content.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-slate-500">
                  No content added yet
                </div>
              ) : (
                data.content.map((item) => (
                  <div
                    key={item.id}
                    className="px-5 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                            item.status === "APPROVED"
                              ? "text-green-400 bg-green-500/10"
                              : item.status === "NEEDS_REVISION"
                                ? "text-red-400 bg-red-500/10"
                                : item.status === "WAITING_APPROVAL"
                                  ? "text-amber-400 bg-amber-500/10"
                                  : "text-slate-400 bg-slate-500/10",
                          )}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      {item.clientComment && (
                        <p className="text-xs text-red-300 mt-1">
                          Client: {item.clientComment}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteContent(item.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Config */}
      {activeTab === "KPI Config" && (
        <Section title="Meta Ads Configuration">
          <div className="space-y-4">
            {kpiHasToken && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <p className="text-xs text-green-300">
                  Meta token is configured. Leave the token field empty to keep
                  the existing one.
                </p>
              </div>
            )}
            <InputField
              label="Meta Ad Account ID"
              placeholder="123456789"
              value={kpiForm.metaAdAccountId}
              onChange={(e) =>
                setKpiForm((f) => ({ ...f, metaAdAccountId: e.target.value }))
              }
            />
            <InputField
              label={
                kpiHasToken
                  ? "Update Meta Token (leave blank to keep)"
                  : "Meta Access Token"
              }
              placeholder="EAAxxxxxxxxxx..."
              value={kpiForm.metaToken}
              onChange={(e) =>
                setKpiForm((f) => ({ ...f, metaToken: e.target.value }))
              }
            />
            <button
              onClick={saveKpi}
              disabled={kpiLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {kpiLoading ? "Saving..." : "Save KPI Config"}
            </button>
          </div>
        </Section>
      )}

      {/* Shopify */}
      {activeTab === "Shopify" && (
        <div className="space-y-4">
          <Section title="Shopify Store Connection">
            <div className="space-y-4">
              {shopifyHasToken && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-green-300">
                    Shopify token is configured. Leave the token field empty to
                    keep the existing one.
                  </p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Store Display Name"
                  placeholder="Brand Shopify Store"
                  value={shopifyForm.storeName}
                  onChange={(e) =>
                    setShopifyForm((form) => ({
                      ...form,
                      storeName: e.target.value,
                    }))
                  }
                />
                <InputField
                  label="Shopify Store Domain"
                  placeholder="your-store.myshopify.com"
                  value={shopifyForm.storeUrl}
                  onChange={(e) =>
                    setShopifyForm((form) => ({
                      ...form,
                      storeUrl: e.target.value,
                    }))
                  }
                />
              </div>

              <InputField
                label={
                  shopifyHasToken
                    ? "Update Admin API Access Token (leave blank to keep)"
                    : "Admin API Access Token"
                }
                type="password"
                placeholder="shpat_..."
                value={shopifyForm.accessToken}
                onChange={(e) =>
                  setShopifyForm((form) => ({
                    ...form,
                    accessToken: e.target.value,
                  }))
                }
              />

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300 leading-relaxed">
                Required Shopify info: the store domain, for example
                your-store.myshopify.com, and a custom app Admin API access
                token with read_orders and read_customers scopes. In Shopify,
                open Settings, Apps and sales channels, Develop apps, create or
                open a custom app, configure Admin API scopes, install it, then
                copy the Admin API access token.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={saveShopify}
                  disabled={
                    shopifyLoading ||
                    !shopifyForm.storeName ||
                    !shopifyForm.storeUrl ||
                    (!shopifyHasToken && !shopifyForm.accessToken)
                  }
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  <Store className="w-4 h-4" />
                  {shopifyLoading ? "Saving..." : "Save Shopify Config"}
                </button>
                {shopifyConfigs[0] && (
                  <button
                    onClick={() => syncShopify(shopifyConfigs[0])}
                    disabled={shopifySyncing === shopifyConfigs[0].id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
                  >
                    <RefreshCw
                      className={cn(
                        "w-4 h-4",
                        shopifySyncing === shopifyConfigs[0].id && "animate-spin",
                      )}
                    />
                    {shopifySyncing === shopifyConfigs[0].id
                      ? "Syncing..."
                      : "Sync Orders Now"}
                  </button>
                )}
              </div>
            </div>
          </Section>

          <Section title="Connected Store">
            {shopifyConfigs.length === 0 ? (
              <div className="px-1 py-4 text-sm text-slate-500">
                No Shopify store connected yet.
              </div>
            ) : (
              <div className="space-y-3">
                {shopifyConfigs.map((config) => {
                  const result =
                    shopifySyncResult?.id === config.id
                      ? shopifySyncResult.result
                      : null;
                  return (
                    <div
                      key={config.id}
                      className="border border-slate-700/50 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center border",
                              config.active
                                ? "bg-green-500/10 border-green-500/20"
                                : "bg-slate-800/60 border-slate-700/60",
                            )}
                          >
                            <Store
                              className={cn(
                                "w-4 h-4",
                                config.active
                                  ? "text-green-400"
                                  : "text-slate-500",
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white truncate">
                                {config.storeName}
                              </h3>
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                  config.active
                                    ? "text-green-400 bg-green-500/10"
                                    : "text-slate-400 bg-slate-500/10",
                                )}
                              >
                                {config.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {config.storeUrl}
                            </div>
                            {config.lastSyncAt && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                Last sync:{" "}
                                {new Date(config.lastSyncAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => toggleShopify(config)}
                            className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                          >
                            {config.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={() => deleteShopify(config.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                            aria-label="Delete Shopify connection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {result && (
                        <div
                          className={cn(
                            "mt-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2 border",
                            isSyncResult(result)
                              ? "bg-green-500/10 border-green-500/20 text-green-300"
                              : "bg-red-500/10 border-red-500/20 text-red-300",
                          )}
                        >
                          {isSyncResult(result) ? (
                            <>
                              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              Synced {result.total} orders · {result.created}{" "}
                              created · {result.updated} updated. These orders
                              now appear in Orders for this client.
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              {result.message}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Notifications */}
      {activeTab === "Notifications" && (
        <Section title="Send Notification to Client">
          {!data.portalUser ? (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-amber-300">
                This client needs a portal account to receive notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <InputField
                  label="Title"
                  placeholder="Notification title"
                  value={notifyForm.title}
                  onChange={(e) =>
                    setNotifyForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
                <SelectField
                  label="Type"
                  value={notifyForm.type}
                  onChange={(e) =>
                    setNotifyForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </SelectField>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  rows={3}
                  placeholder="Notification message..."
                  value={notifyForm.message}
                  onChange={(e) =>
                    setNotifyForm((f) => ({ ...f, message: e.target.value }))
                  }
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
              <InputField
                label="Link (optional)"
                placeholder="/portal/updates"
                value={notifyForm.link}
                onChange={(e) =>
                  setNotifyForm((f) => ({ ...f, link: e.target.value }))
                }
              />
              <button
                onClick={sendNotification}
                disabled={
                  notifyLoading || !notifyForm.title || !notifyForm.message
                }
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {notifyLoading ? "Sending..." : "Send Notification"}
              </button>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
