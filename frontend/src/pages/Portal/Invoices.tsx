import { useEffect, useState } from 'react';
import { FileText, DollarSign, AlertCircle, CheckCircle, Clock, Download } from 'lucide-react';
import { portalApi } from '@/context/PortalAuthContext';
import { usePortalCurrency } from '@/context/PortalCurrencyContext';
import { Payment, PaymentStatus } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_TABS: { value: PaymentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Invoices' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
];

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: React.ElementType }> = {
  PAID: { label: 'Paid', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle },
  PENDING: { label: 'Pending', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  OVERDUE: { label: 'Overdue', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertCircle },
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer', CREDIT_CARD: 'Credit Card', CASH: 'Cash',
  CHECK: 'Check', PAYPAL: 'PayPal', OTHER: 'Other',
};

export default function InvoicesPage() {
  const { fmt } = usePortalCurrency();
  const [invoices, setInvoices] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<PaymentStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = activeTab !== 'ALL' ? `?status=${activeTab}` : '';
    portalApi.get<{ invoices: Payment[] } | Payment[]>(`/invoices${params}`)
      .then(({ data }) => {
        if (data && !Array.isArray(data) && 'invoices' in data) {
          setInvoices(data.invoices);
        } else {
          setInvoices(data as Payment[]);
        }
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  const totals = {
    paid: invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter((i) => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0),
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white">Invoices</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your billing history and outstanding payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Paid', value: fmt(totals.paid), icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Pending', value: fmt(totals.pending), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Overdue', value: fmt(totals.overdue), icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-4">
            <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center mb-3', bg)}>
              <Icon className={cn('w-4.5 h-4.5', color)} />
            </div>
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1528] border border-slate-800/60 rounded-xl p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium transition-all',
              activeTab === tab.value ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">PDF</span>
            </div>

            {invoices.map((inv) => {
              const cfg = STATUS_CONFIG[inv.status];
              const Icon = cfg.icon;
              return (
                <div key={inv.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {inv.invoiceNumber || `INV-${inv.id.slice(-6).toUpperCase()}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {METHOD_LABELS[inv.method] ?? inv.method}
                        {inv.notes && ` · ${inv.notes}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-400 whitespace-nowrap">
                    {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>

                  <div className="text-sm font-bold text-white whitespace-nowrap">{fmt(inv.amount)}</div>

                  <div className={cn('flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap', cfg.color)}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </div>

                  <div>
                    {inv.pdfUrl ? (
                      <a
                        href={inv.pdfUrl}
                        download={`${inv.invoiceNumber || `INV-${inv.id.slice(-6).toUpperCase()}`}.pdf`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-medium whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
