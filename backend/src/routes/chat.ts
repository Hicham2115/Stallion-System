import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const MSG_INCLUDE = {
  sender: { select: { id: true, name: true, avatar: true, role: true } },
  replyTo: { include: { sender: { select: { id: true, name: true } } } },
  reactions: { include: { user: { select: { id: true, name: true } } } },
};

// GET /api/chat/channels
router.get('/channels', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const channels = await prisma.channel.findMany({
    where: {
      OR: [
        { type: 'PUBLIC' },
        { members: { some: { userId } } },
      ],
    },
    include: {
      _count: { select: { messages: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(channels);
});

// GET /api/chat/channels/:id/messages
router.get('/channels/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string | undefined;

  const messages = await prisma.chatMessage.findMany({
    where: {
      channelId: id,
      deletedAt: null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: MSG_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(messages.reverse());
});

// POST /api/chat/channels/:id/members — add member (manager+)
router.post('/channels/:id/members', requireRole('MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) { res.status(400).json({ message: 'userId required' }); return; }

  const channel = await prisma.channel.findUnique({ where: { id } });
  if (!channel) { res.status(404).json({ message: 'Channel not found' }); return; }

  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId: id, userId } },
    create: { channelId: id, userId },
    update: {},
  });

  const updated = await prisma.channel.findUnique({
    where: { id },
    include: {
      _count: { select: { messages: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
    },
  });
  res.json(updated);
});

// DELETE /api/chat/channels/:id/members/:userId — remove member (manager+)
router.delete('/channels/:id/members/:userId', requireRole('MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id, userId } = req.params;
  await prisma.channelMember.deleteMany({ where: { channelId: id, userId } });

  const updated = await prisma.channel.findUnique({
    where: { id },
    include: {
      _count: { select: { messages: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
    },
  });
  res.json(updated);
});

// GET /api/chat/dm/:userId — get or create conversation
router.get('/dm/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const me = req.user!.userId;
  const other = req.params.userId;
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string | undefined;

  const [aId, bId] = [me, other].sort();
  let convo = await prisma.conversation.findUnique({ where: { userAId_userBId: { userAId: aId, userBId: bId } } });
  if (!convo) {
    convo = await prisma.conversation.create({ data: { userAId: aId, userBId: bId } });
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId: convo.id,
      deletedAt: null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: MSG_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json({ conversationId: convo.id, messages: messages.reverse() });
});

// GET /api/chat/users
router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { active: true, suspended: false },
    select: { id: true, name: true, avatar: true, role: true, onlineStatus: true, lastSeen: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// GET /api/chat/search
router.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  const q = (req.query.q as string)?.trim();
  if (!q) { res.json([]); return; }
  const messages = await prisma.chatMessage.findMany({
    where: { content: { contains: q, mode: 'insensitive' }, deletedAt: null },
    include: {
      ...MSG_INCLUDE,
      channel: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(messages);
});

export default router;
