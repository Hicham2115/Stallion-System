import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, ExternalLink, Download, Image, Eye, MessageSquare, AlertCircle } from 'lucide-react';
import { portalApi } from '@/context/PortalAuthContext';
import { ContentDelivery, ContentStatus } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_TABS: { value: ContentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'WAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'NEEDS_REVISION', label: 'Needs Revision' },
  { value: 'PUBLISHED', label: 'Published' },
];

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  WAITING_APPROVAL: { label: 'Awaiting Approval', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  APPROVED: { label: 'Approved', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  NEEDS_REVISION: { label: 'Needs Revision', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  PUBLISHED: { label: 'Published', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
};

const CATEGORY_LABELS: Record<string, string> = {
  SOCIAL_POST: 'Social Post', REEL: 'Reel', VIDEO: 'Video',
  AD_CREATIVE: 'Ad Creative', BANNER: 'Banner', THUMBNAIL: 'Thumbnail',
  BRANDING: 'Branding', OTHER: 'Other',
};

function RevisionModal({ item, onClose, onSubmit }: {
  item: ContentDelivery; onClose: () => void; onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#0d1528] border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-white">Request Revision</h3>
          <p className="text-xs text-slate-400 mt-0.5">{item.title}</p>
        </div>
        <div className="p-5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Revision Notes
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Describe what changes you'd like..."
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 resize-none"
          />
        </div>
        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await onSubmit(comment);
              setLoading(false);
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-sm text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Request Revision'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentDelivery[]>([]);
  const [activeTab, setActiveTab] = useState<ContentStatus | 'ALL'>('WAITING_APPROVAL');
  const [loading, setLoading] = useState(true);
  const [revisionItem, setRevisionItem] = useState<ContentDelivery | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchContent = () => {
    setLoading(true);
    const params = activeTab !== 'ALL' ? `?status=${activeTab}` : '';
    portalApi.get<ContentDelivery[]>(`/content${params}`)
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchContent(); }, [activeTab]);

  const approve = async (id: string) => {
    setActionLoading(id);
    try {
      await portalApi.put(`/content/${id}/approve`);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'APPROVED' } : i));
    } finally {
      setActionLoading(null);
    }
  };

  const requestRevision = async (id: string, comment: string) => {
    await portalApi.put(`/content/${id}/revision`, { comment });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'NEEDS_REVISION', clientComment: comment } : i));
    setRevisionItem(null);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-white">Creative Delivery</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review and approve your designs, ads, and creative assets</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1528] border border-slate-800/60 rounded-xl p-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'ALL' ? items.length : items.filter((i) => i.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                activeTab === tab.value ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {tab.label}
              {activeTab === tab.value && count > 0 && (
                <span className="w-4 h-4 bg-white/20 rounded-full text-[9px] flex items-center justify-center">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <Image className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No content in this category yet</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <div key={item.id} className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl overflow-hidden flex flex-col">
                {/* Preview */}
                <div className="relative aspect-video bg-slate-800/50 flex items-center justify-center">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-600">
                      <Image className="w-8 h-8" />
                      <span className="text-xs">{CATEGORY_LABELS[item.category]}</span>
                    </div>
                  )}
                  <div className={cn('absolute top-2.5 right-2.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
                    {cfg.label}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="text-sm font-semibold text-white mb-0.5">{item.title}</div>
                  <div className="text-xs text-slate-500 mb-1">{CATEGORY_LABELS[item.category]}</div>
                  {item.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">{item.description}</p>
                  )}
                  {item.revisionNote && (
                    <div className="flex items-start gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2">
                      <AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-300">{item.revisionNote}</p>
                    </div>
                  )}
                  {item.clientComment && item.status === 'NEEDS_REVISION' && (
                    <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-2">
                      <MessageSquare className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-300">{item.clientComment}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-2">
                    {item.externalLink && (
                      <a href={item.externalLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    )}
                    {item.fileUrl && (
                      <a href={item.fileUrl} download
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                        <Download className="w-3 h-3" /> Download
                      </a>
                    )}
                    {item.previewUrl && (
                      <a href={item.previewUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                        <Eye className="w-3 h-3" /> Preview
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {item.status === 'WAITING_APPROVAL' && (
                  <div className="flex border-t border-slate-800/60">
                    <button
                      onClick={() => setRevisionItem(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors border-r border-slate-800/60"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Revision
                    </button>
                    <button
                      disabled={actionLoading === item.id}
                      onClick={() => approve(item.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {actionLoading === item.id ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {revisionItem && (
        <RevisionModal
          item={revisionItem}
          onClose={() => setRevisionItem(null)}
          onSubmit={(comment) => requestRevision(revisionItem.id, comment)}
        />
      )}
    </div>
  );
}
