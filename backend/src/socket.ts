import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma';

interface AuthPayload { userId: string; email: string; role: string; }

const onlineUsers = new Map<string, string>(); // userId -> socketId

export function initSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(token as string, process.env.JWT_SECRET!) as AuthPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user as AuthPayload;
    const uid = user.userId;
    const dbUser = await prisma.user.findUnique({ where: { id: uid }, select: { name: true } });
    const userName = dbUser?.name ?? 'Unknown';

    onlineUsers.set(uid, socket.id);
    await prisma.user.update({ where: { id: uid }, data: { onlineStatus: true, lastSeen: new Date() } });
    io.emit('presence:update', { userId: uid, online: true });

    // Join public channels
    const channels = await prisma.channel.findMany({ where: { type: 'PUBLIC' } });
    channels.forEach((ch) => socket.join(`channel:${ch.id}`));

    // Join private channels where user is a member
    const memberships = await prisma.channelMember.findMany({ where: { userId: uid }, select: { channelId: true } });
    memberships.forEach((m) => socket.join(`channel:${m.channelId}`));

    // Personal room for DMs
    socket.join(`user:${uid}`);

    socket.emit('presence:list', Array.from(onlineUsers.keys()));

    // ── Channel Messages ─────────────────────────────────────────────────────

    socket.on('channel:message', async (data: { channelId: string; content: string; replyToId?: string }) => {
      try {
        const channel = await prisma.channel.findUnique({ where: { id: data.channelId } });
        if (!channel) return;

        const message = await prisma.chatMessage.create({
          data: {
            senderId: uid,
            channelId: data.channelId,
            content: data.content.trim(),
            type: 'TEXT',
            replyToId: data.replyToId || null,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, role: true } },
            replyTo: { include: { sender: { select: { id: true, name: true } } } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          },
        });

        io.to(`channel:${data.channelId}`).emit('channel:message', message);
      } catch (err) {
        console.error('channel:message error', err);
      }
    });

    // ── Direct Messages ───────────────────────────────────────────────────────

    socket.on('dm:send', async (data: { toUserId: string; content: string; replyToId?: string }) => {
      try {
        const [aId, bId] = [uid, data.toUserId].sort();
        let conversation = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId: aId, userBId: bId } } });
        if (!conversation) {
          conversation = await prisma.conversation.create({ data: { userAId: aId, userBId: bId } });
        }

        const message = await prisma.chatMessage.create({
          data: {
            senderId: uid,
            conversationId: conversation.id,
            content: data.content.trim(),
            type: 'TEXT',
            replyToId: data.replyToId || null,
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true, role: true } },
            replyTo: { include: { sender: { select: { id: true, name: true } } } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          },
        });

        // Include toUserId so the client can determine which "other" user this belongs to
        const payload = { ...message, conversationId: conversation.id, toUserId: data.toUserId };
        io.to(`user:${uid}`).emit('dm:message', payload);
        io.to(`user:${data.toUserId}`).emit('dm:message', { ...payload, toUserId: uid });
      } catch (err) {
        console.error('dm:send error', err);
      }
    });

    // ── Typing ────────────────────────────────────────────────────────────────

    socket.on('typing:start', (data: { channelId?: string; toUserId?: string }) => {
      const payload = { userId: uid, name: userName };
      if (data.channelId) socket.to(`channel:${data.channelId}`).emit('typing:start', { ...payload, channelId: data.channelId });
      else if (data.toUserId) socket.to(`user:${data.toUserId}`).emit('typing:start', { ...payload, toUserId: data.toUserId });
    });

    socket.on('typing:stop', (data: { channelId?: string; toUserId?: string }) => {
      const payload = { userId: uid };
      if (data.channelId) socket.to(`channel:${data.channelId}`).emit('typing:stop', { ...payload, channelId: data.channelId });
      else if (data.toUserId) socket.to(`user:${data.toUserId}`).emit('typing:stop', { ...payload, toUserId: data.toUserId });
    });

    // ── Reactions ─────────────────────────────────────────────────────────────

    socket.on('reaction:toggle', async (data: { messageId: string; emoji: string }) => {
      try {
        const existing = await prisma.messageReaction.findUnique({
          where: { messageId_userId_emoji: { messageId: data.messageId, userId: uid, emoji: data.emoji } },
        });
        if (existing) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.messageReaction.create({ data: { messageId: data.messageId, userId: uid, emoji: data.emoji } });
        }
        const reactions = await prisma.messageReaction.findMany({
          where: { messageId: data.messageId },
          include: { user: { select: { id: true, name: true } } },
        });
        const msg = await prisma.chatMessage.findUnique({ where: { id: data.messageId }, select: { channelId: true, conversationId: true } });
        if (msg?.channelId) {
          io.to(`channel:${msg.channelId}`).emit('reaction:update', { messageId: data.messageId, reactions });
        } else if (msg?.conversationId) {
          const convo = await prisma.conversation.findUnique({ where: { id: msg.conversationId }, select: { userAId: true, userBId: true } });
          if (convo) {
            io.to(`user:${convo.userAId}`).emit('reaction:update', { messageId: data.messageId, reactions });
            io.to(`user:${convo.userBId}`).emit('reaction:update', { messageId: data.messageId, reactions });
          }
        }
      } catch (err) {
        console.error('reaction:toggle error', err);
      }
    });

    // ── Edit / Delete ─────────────────────────────────────────────────────────

    socket.on('message:edit', async (data: { messageId: string; content: string }) => {
      try {
        const msg = await prisma.chatMessage.findUnique({ where: { id: data.messageId } });
        if (!msg || msg.senderId !== uid) return;
        const updated = await prisma.chatMessage.update({
          where: { id: data.messageId },
          data: { content: data.content.trim(), edited: true },
          include: { sender: { select: { id: true, name: true, avatar: true, role: true } }, reactions: true },
        });
        if (msg.channelId) {
          io.to(`channel:${msg.channelId}`).emit('message:updated', updated);
        } else if (msg.conversationId) {
          const convo = await prisma.conversation.findUnique({ where: { id: msg.conversationId }, select: { userAId: true, userBId: true } });
          if (convo) {
            io.to(`user:${convo.userAId}`).emit('message:updated', updated);
            io.to(`user:${convo.userBId}`).emit('message:updated', updated);
          }
        }
      } catch (err) {
        console.error('message:edit error', err);
      }
    });

    socket.on('message:delete', async (data: { messageId: string }) => {
      try {
        const msg = await prisma.chatMessage.findUnique({ where: { id: data.messageId } });
        if (!msg) return;
        if (msg.senderId !== uid && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return;
        await prisma.chatMessage.update({ where: { id: data.messageId }, data: { deletedAt: new Date(), content: '' } });
        if (msg.channelId) {
          io.to(`channel:${msg.channelId}`).emit('message:deleted', { messageId: data.messageId });
        } else if (msg.conversationId) {
          const convo = await prisma.conversation.findUnique({ where: { id: msg.conversationId }, select: { userAId: true, userBId: true } });
          if (convo) {
            io.to(`user:${convo.userAId}`).emit('message:deleted', { messageId: data.messageId });
            io.to(`user:${convo.userBId}`).emit('message:deleted', { messageId: data.messageId });
          }
        }
      } catch (err) {
        console.error('message:delete error', err);
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      onlineUsers.delete(uid);
      await prisma.user.update({ where: { id: uid }, data: { onlineStatus: false, lastSeen: new Date() } });
      io.emit('presence:update', { userId: uid, online: false });
    });
  });

  return io;
}
