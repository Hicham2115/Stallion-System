import { useEffect, useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { portalApi } from "@/context/PortalAuthContext";
import { ClientCost } from "@/types";
import { cn, formatDate } from "@/lib/utils";
import { usePortalCurrency } from "@/context/PortalCurrencyContext";
import DateSelector from "@/components/DateSelector";

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

export default function PortalCostsPage() {
  const { currency, fmt } = usePortalCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [costs, setCosts] = useState<ClientCost[]>([]);
  const [form, setForm] = useState({ name: "", amount: "", date: "" });

  useEffect(() => {
    portalApi
      .get<ClientCost[]>("/costs")
      .then(({ data }) => setCosts(data))
      .finally(() => setLoading(false));
  }, []);

  const addCost = async () => {
    if (!form.name.trim() || !form.amount || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        amount: Number(form.amount),
        date: form.date,
      };
      const { data } = await portalApi.post<ClientCost>("/costs", payload);
      setCosts((cs) => [data, ...cs]);
      setForm({ name: "", amount: "", date: "" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-white">Costs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Add and track your costs
        </p>
      </div>

      <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Add Cost</div>
            <div className="text-xs text-slate-500">Name, amount, and date</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <InputField
            label="Cost Name"
            placeholder="e.g. Ads, Tools, Freelancer"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <InputField
            label={`Amount (${currency})`}
            type="number"
            step="0.01"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <DateSelector
            label="Date"
            value={form.date}
            onChange={(date) => setForm((f) => ({ ...f, date }))}
            dark
          />
        </div>

        <button
          onClick={addCost}
          disabled={saving || !form.name.trim() || !form.amount || !form.date}
          className={cn(
            "mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors",
            saving || !form.name.trim() || !form.amount || !form.date
              ? "bg-amber-500/40 text-white/70 cursor-not-allowed"
              : "bg-amber-500 hover:bg-amber-400 text-white",
          )}
        >
          <Plus className="w-4 h-4" />
          {saving ? "Saving..." : "Add Cost"}
        </button>
      </div>

      <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60">
          <h3 className="text-sm font-semibold text-white">
            Saved Costs ({costs.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-800/50">
          {costs.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-500">
              No costs yet
            </div>
          ) : (
            costs.map((c) => (
              <div
                key={c.id}
                className="px-5 py-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {formatDate(c.date)}
                  </div>
                </div>
                <div className="text-sm font-bold text-white whitespace-nowrap">
                  {fmt(Number(c.amount))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
