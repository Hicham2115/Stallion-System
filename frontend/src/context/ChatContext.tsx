import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { ChatMessage, Channel, ChatUser } from '@/types';

const API = 'http://localhost:5000';

interface TypingInfo { userId: string; name: string; channelId?: string; toUserId?: string; }

interface ChannelWithMembers extends Channel {
  members?: { user: { id: string; name: string; avatar?: string; role: string } }[];
}

interface ChatContextValue {
  socket: Socket | null;
  connected: boolean;
  channels: ChannelWithMembers[];
  users: ChatUser[];
  onlineUsers: Set<string>;
  channelMessages: Record<string, ChatMessage[]>;
  dmMessages: Record<string, ChatMessage[]>;  // keyed by conversationId
  conversationIds: Record<string, string>;    // otherUserId -> conversationId
  typingUsers: TypingInfo[];
  sendChannelMessage: (channelId: string, content: string, replyToId?: string) => void;
  sendDm: (toUserId: string, content: string, replyToId?: string) => void;
  startTyping: (opts: { channelId?: string; toUserId?: string }) => void;
  stopTyping: (opts: { channelId?: string; toUserId?: string }) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  addMember: (channelId: string, userId: string) => Promise<void>;
  removeMember: (channelId: string, userId: string) => Promise<void>;
  loadChannelMessages: (channelId: string, before?: string) => Promise<void>;
  loadDmMessages: (userId: string, before?: string) => Promise<void>;
  loadUsers: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// Merge two message arrays, dedup by id, sort by createdAt
function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  [...existing, ...incoming].forEach((m) => map.set(m.id, m));
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, user: authUser } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState<ChannelWithMembers[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [channelMessages, setChannelMessages] = useState<Record<string, ChatMessage[]>>({});
  const [dmMessages, setDmMessages] = useState<Record<string, ChatMessage[]>>({});
  const [conversationIds, setConversationIds] = useState<Record<string, string>>({});
  const [typingUsers, setTypingUsers] = useState<TypingInfo[]>([]);

  useEffect(() => {
    if (!token) return;

    const socket = io(API, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Presence
    socket.on('presence:list', (ids: string[]) => setOnlineUsers(new Set(ids)));
    socket.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        online ? next.add(userId) : next.delete(userId);
        return next;
      });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, onlineStatus: online } : u));
    });

    // Channel message — merge with existing (never replace) to avoid race with HTTP load
    socket.on('channel:message', (msg: ChatMessage) => {
      if (!msg.channelId) return;
      const cid = msg.channelId;
      setChannelMessages((prev) => ({
        ...prev,
        [cid]: mergeMessages(prev[cid] || [], [msg]),
      }));
    });

    // DM message — backend now sends toUserId so we know which conversation it belongs to
    socket.on('dm:message', (msg: ChatMessage & { conversationId: string; toUserId: string }) => {
      const { conversationId, toUserId } = msg;
      // toUserId is the "other" user from our perspective
      setDmMessages((prev) => ({
        ...prev,
        [conversationId]: mergeMessages(prev[conversationId] || [], [msg]),
      }));
      setConversationIds((prev) =>
        prev[toUserId] ? prev : { ...prev, [toUserId]: conversationId }
      );
    });

    // Typing
    socket.on('typing:start', (info: TypingInfo) => {
      setTypingUsers((prev) => [
        ...prev.filter((t) => !(t.userId === info.userId && t.channelId === info.channelId && t.toUserId === info.toUserId)),
        info,
      ]);
    });
    socket.on('typing:stop', ({ userId, channelId, toUserId }: any) => {
      setTypingUsers((prev) =>
        prev.filter((t) => !(t.userId === userId && t.channelId === channelId && t.toUserId === toUserId))
      );
    });

    // Reactions
    socket.on('reaction:update', ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      const patch = (msgs: ChatMessage[]) => msgs.map((m) => m.id === messageId ? { ...m, reactions } : m);
      setChannelMessages((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { next[k] = patch(next[k]); });
        return next;
      });
      setDmMessages((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { next[k] = patch(next[k]); });
        return next;
      });
    });

    // Edit
    socket.on('message:updated', (updated: ChatMessage) => {
      const patch = (msgs: ChatMessage[]) => msgs.map((m) => m.id === updated.id ? updated : m);
      if (updated.channelId) {
        setChannelMessages((prev) => ({ ...prev, [updated.channelId!]: patch(prev[updated.channelId!] || []) }));
      }
      if (updated.conversationId) {
        setDmMessages((prev) => ({ ...prev, [updated.conversationId!]: patch(prev[updated.conversationId!] || []) }));
      }
    });

    // Delete
    socket.on('message:deleted', ({ messageId }: { messageId: string }) => {
      const markDeleted = (msgs: ChatMessage[]) =>
        msgs.map((m) => m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m);
      setChannelMessages((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { next[k] = markDeleted(next[k]); });
        return next;
      });
      setDmMessages((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { next[k] = markDeleted(next[k]); });
        return next;
      });
    });

    return () => { socket.disconnect(); socketRef.current = null; setConnected(false); };
  }, [token]);

  const authHeader = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadChannelMessages = useCallback(async (channelId: string, before?: string) => {
    const params = new URLSearchParams({ limit: '50' });
    if (before) params.set('before', before);
    const res = await fetch(`${API}/api/chat/channels/${channelId}/messages?${params}`, { headers: authHeader() });
    const msgs: ChatMessage[] = await res.json();
    setChannelMessages((prev) => ({
      ...prev,
      // Merge to preserve any messages received via socket during the fetch
      [channelId]: before
        ? mergeMessages(msgs, prev[channelId] || [])
        : mergeMessages(msgs, prev[channelId] || []),
    }));
  }, [authHeader]);

  const loadDmMessages = useCallback(async (userId: string, before?: string) => {
    const params = new URLSearchParams({ limit: '50' });
    if (before) params.set('before', before);
    const res = await fetch(`${API}/api/chat/dm/${userId}?${params}`, { headers: authHeader() });
    const data: { conversationId: string; messages: ChatMessage[] } = await res.json();
    setConversationIds((prev) => ({ ...prev, [userId]: data.conversationId }));
    setDmMessages((prev) => ({
      ...prev,
      [data.conversationId]: before
        ? mergeMessages(data.messages, prev[data.conversationId] || [])
        : mergeMessages(data.messages, prev[data.conversationId] || []),
    }));
  }, [authHeader]);

  const loadUsers = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch(`${API}/api/chat/users`, { headers: authHeader() }),
      fetch(`${API}/api/chat/channels`, { headers: authHeader() }),
    ]);
    setUsers(await r1.json());
    setChannels(await r2.json());
  }, [authHeader]);

  const sendChannelMessage = useCallback((channelId: string, content: string, replyToId?: string) => {
    // Optimistic: add immediately to local state so it shows without waiting for echo
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      senderId: authUser?.id || '',
      sender: { id: authUser?.id || '', name: authUser?.name || '', avatar: authUser?.avatar, role: authUser?.role || 'TEAM_MEMBER' },
      channelId,
      content,
      type: 'TEXT',
      reactions: [],
      edited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(replyToId ? { replyToId } : {}),
    };
    setChannelMessages((prev) => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), tempMsg],
    }));
    socketRef.current?.emit('channel:message', { channelId, content, replyToId });
  }, [authUser]);

  const sendDm = useCallback((toUserId: string, content: string, replyToId?: string) => {
    socketRef.current?.emit('dm:send', { toUserId, content, replyToId });
  }, []);

  const startTyping = useCallback((opts: { channelId?: string; toUserId?: string }) => {
    socketRef.current?.emit('typing:start', opts);
  }, []);

  const stopTyping = useCallback((opts: { channelId?: string; toUserId?: string }) => {
    socketRef.current?.emit('typing:stop', opts);
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit('reaction:toggle', { messageId, emoji });
  }, []);

  const editMessage = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit('message:edit', { messageId, content });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    socketRef.current?.emit('message:delete', { messageId });
  }, []);

  const addMember = useCallback(async (channelId: string, userId: string) => {
    const res = await fetch(`${API}/api/chat/channels/${channelId}/members`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const updated = await res.json();
    setChannels((prev) => prev.map((c) => c.id === channelId ? updated : c));
  }, [authHeader]);

  const removeMember = useCallback(async (channelId: string, userId: string) => {
    const res = await fetch(`${API}/api/chat/channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    const updated = await res.json();
    setChannels((prev) => prev.map((c) => c.id === channelId ? updated : c));
  }, [authHeader]);

  return (
    <ChatContext.Provider value={{
      socket: socketRef.current,
      connected,
      channels,
      users,
      onlineUsers,
      channelMessages,
      dmMessages,
      conversationIds,
      typingUsers,
      sendChannelMessage,
      sendDm,
      startTyping,
      stopTyping,
      toggleReaction,
      editMessage,
      deleteMessage,
      addMember,
      removeMember,
      loadChannelMessages,
      loadDmMessages,
      loadUsers,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be inside ChatProvider');
  return ctx;
}
