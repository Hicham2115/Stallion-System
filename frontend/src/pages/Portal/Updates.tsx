import { useEffect, useState, useRef } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp, GitBranch, User } from 'lucide-react';
import { portalApi } from '@/context/PortalAuthContext';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { ProjectUpdate, UpdateComment } from '@/types';
import { cn } from '@/lib/utils';

const PHASE_CONFIG: Record<string, { label: string; color: string }> = {
  DISCOVERY: { label: 'Discovery', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  PLANNING: { label: 'Planning', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  DESIGN: { label: 'Design', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  DEVELOPMENT: { label: 'Development', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  TESTING: { label: 'Testing', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  DEPLOYMENT: { label: 'Deployment', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  MAINTENANCE: { label: 'Maintenance', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

function CommentThread({ update, onNewComment }: {
  update: ProjectUpdate;
  onNewComment: (updateId: string, comment: UpdateComment) => void;
}) {
  const { user } = usePortalAuth();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendComment = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const { data } = await portalApi.post<UpdateComment>(`/updates/${update.id}/comments`, { content });
      onNewComment(update.id, data);
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-800/50 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>{update.comments?.length ?? 0} comment{update.comments?.length !== 1 ? 's' : ''}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {update.comments?.map((c) => (
            <div key={c.id} className={cn('flex gap-2.5', c.isClient ? 'flex-row-reverse' : '')}>
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                c.isClient ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400',
              )}>
                {c.authorName.charAt(0).toUpperCase()}
              </div>
              <div className={cn('max-w-[80%]', c.isClient ? 'items-end flex flex-col' : '')}>
                <div className={cn(
                  'px-3 py-2 rounded-xl text-xs',
                  c.isClient
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-100'
                    : 'bg-slate-800/60 border border-slate-700/40 text-slate-200',
                )}>
                  {c.content}
                </div>
                <div className={cn('flex items-center gap-2 mt-1 text-[10px] text-slate-500', c.isClient ? 'flex-row-reverse' : '')}>
                  <span className="font-medium">{c.isClient ? 'You' : c.authorName}</span>
                  <span>·</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Reply input */}
          <div className="flex items-end gap-2 pt-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                rows={1}
                placeholder="Write a comment..."
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 pr-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
              />
              <button
                onClick={sendComment}
                disabled={loading || !content.trim()}
                className="absolute right-2.5 bottom-2 text-amber-400 disabled:text-slate-600 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi.get<ProjectUpdate[]>('/updates')
      .then(({ data }) => setUpdates(data))
      .finally(() => setLoading(false));
  }, []);

  const addComment = (updateId: string, comment: UpdateComment) => {
    setUpdates((prev) => prev.map((u) =>
      u.id === updateId ? { ...u, comments: [...(u.comments ?? []), comment] } : u,
    ));
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Project Updates</h1>
        <p className="text-sm text-slate-500 mt-0.5">Stay up to date with your campaign progress</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <GitBranch className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No project updates yet</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-6 bottom-6 w-px bg-slate-800/80" />

          <div className="space-y-4">
            {updates.map((update, i) => {
              const phase = update.phase ? PHASE_CONFIG[update.phase] : null;
              return (
                <div key={update.id} className="relative pl-14">
                  {/* Timeline dot */}
                  <div className="absolute left-3.5 top-5 w-3 h-3 rounded-full bg-amber-500 border-2 border-[#060b18] shadow-lg shadow-amber-500/30" />

                  <div className="bg-[#0d1528]/80 border border-slate-800/60 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{update.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {phase && (
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', phase.color)}>
                              {phase.label}
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <User className="w-3 h-3" />
                            {update.postedBy?.name}
                          </div>
                          <span className="text-[10px] text-slate-600">
                            {new Date(update.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{update.content}</p>

                    {update.imageUrl && (
                      <img
                        src={update.imageUrl}
                        alt=""
                        className="mt-3 rounded-xl w-full max-h-64 object-cover border border-slate-700/40"
                      />
                    )}

                    {update.fileUrl && (
                      <a
                        href={update.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        📎 View attached file
                      </a>
                    )}

                    <CommentThread update={update} onNewComment={addComment} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
