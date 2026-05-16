import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash, Lock, MessageSquare, Search, Send, Smile,
  Edit2, Trash2, Reply, Wifi, WifiOff, Users, UserPlus, X,
} from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { ChatMessage, Channel } from '@/types';
import { cn } from '@/lib/utils';

const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '👏', '🎉'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ name, avatar, size = 8 }: { name: string; avatar?: string; size?: number }) {
  if (avatar) {
    return <img src={avatar} alt={name} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-full bg-amber-500 flex items-center justify-center text-white font-bold flex-shrink-0 select-none`}
      style={{ fontSize: size * 1.8 + 'px' }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Member Management Modal ───────────────────────────────────────────────────

function MemberManagePanel({
  channel,
  allUsers,
  onClose,
}: {
  channel: Channel;
  allUsers: { id: string; name: string; avatar?: string; role: string }[];
  onClose: () => void;
}) {
  const { addMember, removeMember, isManager } = { ...useChat(), isManager: useAuth().isManager };
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState('');

  const memberIds = new Set((channel.members || []).map((m) => m.user.id));
  const nonMembers = allUsers.filter((u) => !memberIds.has(u.id) && u.name.toLowerCase().includes(search.toLowerCase()));
  const currentMembers = (channel.members || []).filter((m) => m.user.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (userId: string) => {
    setLoading(userId);
    await addMember(channel.id, userId);
    setLoading('');
  };

  const handleRemove = async (userId: string) => {
    setLoading(userId);
    await removeMember(channel.id, userId);
    setLoading('');
  };

  return (
    <div className="absolute right-0 top-12 z-30 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-[480px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Manage Members — #{channel.name}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Current members */}
        {currentMembers.length > 0 && (
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Members ({channel.members?.length || 0})
            </p>
            {currentMembers.map(({ user: u }) => (
              <div key={u.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg group hover:bg-slate-50 dark:hover:bg-slate-700">
                <Avatar name={u.name} avatar={u.avatar} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.role.replace(/_/g, ' ')}</p>
                </div>
                {isManager && (
                  <button
                    onClick={() => handleRemove(u.id)}
                    disabled={loading === u.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-500 hover:text-red-600 font-medium px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {loading === u.id ? '...' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add members */}
        {isManager && nonMembers.length > 0 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Add Members</p>
            {nonMembers.map((u) => (
              <div key={u.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                <Avatar name={u.name} avatar={u.avatar} size={7} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                  <p className="text-xs text-slate-400 truncate">{u.role.replace(/_/g, ' ')}</p>
                </div>
                <button
                  onClick={() => handleAdd(u.id)}
                  disabled={loading === u.id}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  {loading === u.id ? '...' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        )}

        {currentMembers.length === 0 && nonMembers.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">No users match your search</div>
        )}
      </div>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const { user } = useAuth();

  if (msg.deletedAt) {
    return (
      <div className="flex gap-3 px-4 py-1.5 opacity-40">
        <div className="w-8 flex-shrink-0" />
        <p className="text-xs italic text-slate-400 self-center">This message was deleted</p>
      </div>
    );
  }

  // Skip temp messages that were replaced by real ones (temp IDs start with "temp-")
  // They will be replaced when the socket echo arrives via mergeMessages

  const reactionGroups: Record<string, { count: number; users: string[]; hasMe: boolean }> = {};
  (msg.reactions || []).forEach((r) => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, users: [], hasMe: false };
    reactionGroups[r.emoji].count++;
    reactionGroups[r.emoji].users.push(r.user.name);
    if (r.userId === user?.id) reactionGroups[r.emoji].hasMe = true;
  });

  return (
    <div
      className="flex gap-3 px-4 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmoji(false); }}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Avatar name={msg.sender.name} avatar={msg.sender.avatar} size={8} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-semibold text-sm text-slate-900 dark:text-white">{msg.sender.name}</span>
          <span className="text-xs text-slate-400">{formatTime(msg.createdAt)}</span>
          {msg.edited && <span className="text-xs text-slate-400 italic">(edited)</span>}
          {msg.id.startsWith('temp-') && <span className="text-xs text-slate-300 dark:text-slate-600">sending...</span>}
        </div>

        {msg.replyTo && (
          <div className="flex gap-2 mb-1 pl-3 border-l-2 border-slate-300 dark:border-slate-600">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-medium">{msg.replyTo.sender.name}:</span> {msg.replyTo.content}
            </p>
          </div>
        )}

        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{msg.content}</p>

        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(reactionGroups).map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                title={info.users.join(', ')}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                  info.hasMe
                    ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-600'
                    : 'bg-slate-100 border-slate-200 dark:bg-slate-700 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                )}
              >
                {emoji} {info.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions — skip for temp messages */}
      {showActions && !msg.id.startsWith('temp-') && (
        <div className="absolute right-4 top-1 flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md px-1 py-0.5 z-10">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmoji && (
              <div className="absolute right-0 top-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 flex gap-1 z-20">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => { onReact(msg.id, e); setShowEmoji(false); }}
                    className="text-lg hover:scale-125 transition-transform p-1">{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Reply">
            <Reply className="w-3.5 h-3.5" />
          </button>
          {isOwn && (
            <button onClick={() => onEdit(msg)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onDelete(msg.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Message Input ─────────────────────────────────────────────────────────────

function MessageInput({
  onSend, onTyping, replyTo, onCancelReply, editingMsg, onCancelEdit, placeholder,
}: {
  onSend: (content: string, replyToId?: string) => void;
  onTyping: (active: boolean) => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  editingMsg: ChatMessage | null;
  onCancelEdit: () => void;
  placeholder: string;
}) {
  const [content, setContent] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { editMessage } = useChat();

  useEffect(() => {
    if (editingMsg) { setContent(editingMsg.content); inputRef.current?.focus(); }
    else setContent('');
  }, [editingMsg]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (editingMsg) { editMessage(editingMsg.id, trimmed); onCancelEdit(); }
    else { onSend(trimmed, replyTo?.id); onCancelReply(); }
    setContent('');
    onTyping(false);
  };

  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 pl-3 border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-r py-1 pr-2">
          <p className="text-xs text-slate-500 flex-1 truncate">
            <span className="font-medium text-amber-600">Replying to {replyTo.sender.name}:</span> {replyTo.content}
          </p>
          <button onClick={onCancelReply} className="text-slate-400 hover:text-slate-600 leading-none text-base">&times;</button>
        </div>
      )}
      {editingMsg && (
        <div className="flex items-center gap-2 mb-2 pl-3 border-l-2 border-blue-400 bg-blue-50 dark:bg-blue-900/10 rounded-r py-1 pr-2">
          <p className="text-xs text-blue-600 flex-1">Editing message</p>
          <button onClick={onCancelEdit} className="text-slate-400 hover:text-slate-600 leading-none text-base">&times;</button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none input py-2 text-sm max-h-28 overflow-y-auto"
          style={{ minHeight: '42px' }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="btn-primary px-3 py-2 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}

// ── Main Chat Page ────────────────────────────────────────────────────────────

export default function Chat() {
  const { type, id } = useParams<{ type?: string; id?: string }>();
  const navigate = useNavigate();
  const { user, isManager } = useAuth();
  const {
    connected, channels, users, onlineUsers,
    channelMessages, dmMessages, conversationIds,
    typingUsers,
    sendChannelMessage, sendDm,
    startTyping, stopTyping,
    toggleReaction, deleteMessage,
    loadChannelMessages, loadDmMessages, loadUsers,
  } = useChat();

  const [search, setSearch] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannelId = type === 'channel' ? id : undefined;
  const activeDmUserId = type === 'dm' ? id : undefined;
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeDmUser = users.find((u) => u.id === activeDmUserId);
  const convId = activeDmUserId ? conversationIds[activeDmUserId] : undefined;

  const messages: ChatMessage[] = activeChannelId
    ? (channelMessages[activeChannelId] || [])
    : convId
      ? (dmMessages[convId] || [])
      : [];

  const currentTypers = typingUsers.filter((t) => {
    if (activeChannelId) return t.channelId === activeChannelId && t.userId !== user?.id;
    if (activeDmUserId) return t.toUserId === user?.id && t.userId === activeDmUserId;
    return false;
  });

  // Load on mount
  useEffect(() => { loadUsers(); }, []);

  // Load channel messages when channel changes
  useEffect(() => {
    if (activeChannelId) loadChannelMessages(activeChannelId);
  }, [activeChannelId]);

  // Load DM messages when DM user changes
  useEffect(() => {
    if (activeDmUserId) loadDmMessages(activeDmUserId);
  }, [activeDmUserId]);

  // Auto-navigate to general on first load
  useEffect(() => {
    if (!type && channels.length > 0) {
      const general = channels.find((c) => c.slug === 'general') || channels[0];
      navigate(`/chat/channel/${general.id}`, { replace: true });
    }
  }, [type, channels]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Close member panel when channel changes
  useEffect(() => { setShowMemberPanel(false); }, [activeChannelId]);

  const handleSend = useCallback((content: string, replyToId?: string) => {
    if (activeChannelId) sendChannelMessage(activeChannelId, content, replyToId);
    else if (activeDmUserId) sendDm(activeDmUserId, content, replyToId);
  }, [activeChannelId, activeDmUserId, sendChannelMessage, sendDm]);

  const handleTyping = useCallback((active: boolean) => {
    if (activeChannelId) active ? startTyping({ channelId: activeChannelId }) : stopTyping({ channelId: activeChannelId });
    else if (activeDmUserId) active ? startTyping({ toUserId: activeDmUserId }) : stopTyping({ toUserId: activeDmUserId });
  }, [activeChannelId, activeDmUserId, startTyping, stopTyping]);

  const filteredUsers = users.filter((u) =>
    u.id !== user?.id && u.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-4.5rem)] flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Team Chat</h2>
            <div className="flex items-center gap-1">
              {connected
                ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {/* Channels */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-1">Channels</p>
          {filteredChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => navigate(`/chat/channel/${ch.id}`)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left',
                activeChannelId === ch.id
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {ch.type === 'PRIVATE'
                ? <Lock className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                : <Hash className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />}
              <span className="truncate">{ch.name}</span>
              {ch.type === 'PRIVATE' && (
                <span className="ml-auto text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 rounded">private</span>
              )}
            </button>
          ))}

          {/* DMs */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 pt-3 pb-1">Direct Messages</p>
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => navigate(`/chat/dm/${u.id}`)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left',
                activeDmUserId === u.id
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              <div className="relative flex-shrink-0">
                <Avatar name={u.name} avatar={u.avatar} size={6} />
                <span className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-800',
                  onlineUsers.has(u.id) ? 'bg-emerald-500' : 'bg-slate-400'
                )} />
              </div>
              <span className="truncate">{u.name}</span>
            </button>
          ))}
        </div>

        {/* Current user strip */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <Avatar name={user?.name || ''} avatar={user?.avatar} size={7} />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!type ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a channel or conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                {activeChannel ? (
                  activeChannel.type === 'PRIVATE'
                    ? <Lock className="w-4 h-4 text-slate-400" />
                    : <Hash className="w-4 h-4 text-slate-400" />
                ) : activeDmUser ? (
                  <div className="relative">
                    <Avatar name={activeDmUser.name} avatar={activeDmUser.avatar} size={8} />
                    <span className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900',
                      onlineUsers.has(activeDmUser.id) ? 'bg-emerald-500' : 'bg-slate-400'
                    )} />
                  </div>
                ) : null}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {activeChannel ? activeChannel.name : activeDmUser?.name || ''}
                  </h3>
                  {activeChannel?.description && (
                    <p className="text-xs text-slate-400">{activeChannel.description}</p>
                  )}
                  {activeDmUser && (
                    <p className="text-xs text-slate-400">
                      {onlineUsers.has(activeDmUser.id) ? 'Online' : 'Offline'}
                    </p>
                  )}
                </div>
              </div>

              {/* Channel action buttons */}
              {activeChannel && (
                <div className="flex items-center gap-1 relative">
                  {isManager && (
                    <button
                      onClick={() => setShowMemberPanel(!showMemberPanel)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        showMemberPanel
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Manage Members
                    </button>
                  )}
                  <button
                    onClick={() => setShowMemberPanel(!showMemberPanel)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      showMemberPanel && !isManager
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : !isManager ? 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400' : 'hidden'
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {activeChannel.members?.length || 0}
                  </button>

                  {showMemberPanel && activeChannel && (
                    <MemberManagePanel
                      channel={activeChannel}
                      allUsers={users}
                      onClose={() => setShowMemberPanel(false)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-2">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm">Be the first to say something!</p>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.senderId === user?.id}
                  onReply={setReplyTo}
                  onEdit={setEditingMsg}
                  onDelete={deleteMessage}
                  onReact={toggleReaction}
                />
              ))}
              {currentTypers.length > 0 && (
                <div className="px-4 py-1 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 italic">
                    {currentTypers.map((t) => t.name).join(', ')} {currentTypers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <MessageInput
              onSend={handleSend}
              onTyping={handleTyping}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              editingMsg={editingMsg}
              onCancelEdit={() => setEditingMsg(null)}
              placeholder={
                activeChannel
                  ? `Message #${activeChannel.name}`
                  : `Message ${activeDmUser?.name || ''}`
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
