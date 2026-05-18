import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { portalAuthenticate, PortalRequest } from "../middleware/portalAuth";
import { getRatesCache } from "../lib/currency";

const router = Router();

function getPresetRange(datePreset: string) {
  const days =
    datePreset === "today"
      ? 1
      : datePreset === "last_7d"
        ? 7
        : datePreset === "last_30d"
          ? 30
          : 90;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { days, start, end };
}

function isoDay(date: Date) {
  return date.toISOString().split("T")[0];
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post("/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: "Email and password required" });
    return;
  }

  const portalUser = await prisma.clientPortalUser.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          service: true,
          monthlyFee: true,
          status: true,
          startDate: true,
          contactPerson: true,
          email: true,
          preferredCurrency: true,
        },
      },
    },
  });

  if (!portalUser || !portalUser.active) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, portalUser.password);
  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  await prisma.clientPortalUser.update({
    where: { id: portalUser.id },
    data: { lastLogin: new Date() },
  });

  const token = jwt.sign(
    {
      clientPortalUserId: portalUser.id,
      clientId: portalUser.clientId,
      type: "portal",
    },
    process.env.JWT_SECRET!,
    { expiresIn: "30d" },
  );

  const { password: _, ...safeUser } = portalUser;
  res.json({ token, user: safeUser });
});

router.get(
  "/me",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const portalUser = await prisma.clientPortalUser.findUnique({
      where: { id: req.portalUser!.clientPortalUserId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            service: true,
            monthlyFee: true,
            status: true,
            startDate: true,
            contactPerson: true,
            email: true,
            preferredCurrency: true,
          },
        },
      },
    });
    if (!portalUser) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const { password: _, ...safeUser } = portalUser;
    res.json(safeUser);
  },
);

router.put(
  "/profile",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { name, avatar } = req.body;
    const updated = await prisma.clientPortalUser.update({
      where: { id: req.portalUser!.clientPortalUserId },
      data: { ...(name && { name }), ...(avatar !== undefined && { avatar }) },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            service: true,
            monthlyFee: true,
            status: true,
            startDate: true,
            contactPerson: true,
            email: true,
            preferredCurrency: true,
          },
        },
      },
    });
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  },
);

router.put(
  "/change-password",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: "Both passwords required" });
      return;
    }
    const user = await prisma.clientPortalUser.findUnique({
      where: { id: req.portalUser!.clientPortalUserId },
    });
    if (!user) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.clientPortalUser.update({
      where: { id: user.id },
      data: { password: hashed },
    });
    res.json({ message: "Password updated" });
  },
);

// ── Exchange Rates ────────────────────────────────────────────────────────────

router.get("/rates", portalAuthenticate, async (_req, res: Response) => {
  res.json(getRatesCache());
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get(
  "/dashboard",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { clientId, clientPortalUserId } = req.portalUser!;

    const [client, payments, recentUpdates, pendingApprovals, unreadCount] =
      await Promise.all([
        prisma.client.findUnique({ where: { id: clientId } }),
        prisma.payment.findMany({
          where: { clientId },
          orderBy: { date: "desc" },
          take: 5,
        }),
        prisma.projectUpdate.findMany({
          where: { clientId },
          include: {
            postedBy: { select: { name: true, avatar: true } },
            _count: { select: { comments: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 4,
        }),
        prisma.contentDelivery.count({
          where: { clientId, status: "WAITING_APPROVAL" },
        }),
        prisma.clientNotification.count({
          where: { clientPortalUserId, read: false },
        }),
      ]);

    const paidTotal = payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + p.amount, 0);
    const pendingPayments = payments.filter((p) =>
      ["PENDING", "OVERDUE"].includes(p.status),
    );
    const pendingAmount = pendingPayments.reduce((s, p) => s + p.amount, 0);

    res.json({
      client,
      recentPayments: payments.slice(0, 3),
      paidTotal,
      pendingInvoices: pendingPayments.length,
      pendingAmount,
      recentUpdates,
      unreadNotifications: unreadCount,
      pendingApprovals,
    });
  },
);

// ── Project Updates ───────────────────────────────────────────────────────────

router.get(
  "/updates",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const updates = await prisma.projectUpdate.findMany({
      where: { clientId: req.portalUser!.clientId },
      include: {
        postedBy: { select: { name: true, avatar: true } },
        comments: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(updates);
  },
);

router.post(
  "/updates/:id/comments",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ message: "Comment content required" });
      return;
    }

    const update = await prisma.projectUpdate.findUnique({
      where: { id: req.params.id },
    });
    if (!update || update.clientId !== req.portalUser!.clientId) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    const portalUser = await prisma.clientPortalUser.findUnique({
      where: { id: req.portalUser!.clientPortalUserId },
      select: { name: true },
    });

    const comment = await prisma.updateComment.create({
      data: {
        updateId: req.params.id,
        content: content.trim(),
        isClient: true,
        authorName: portalUser?.name || "Client",
        authorId: req.portalUser!.clientPortalUserId,
      },
    });
    res.status(201).json(comment);
  },
);

// ── Content Delivery ──────────────────────────────────────────────────────────

router.get(
  "/content",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { status } = req.query;
    const content = await prisma.contentDelivery.findMany({
      where: {
        clientId: req.portalUser!.clientId,
        ...(status ? { status: status as any } : {}),
      },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(content);
  },
);

router.put(
  "/content/:id/approve",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const item = await prisma.contentDelivery.findUnique({
      where: { id: req.params.id },
    });
    if (!item || item.clientId !== req.portalUser!.clientId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const updated = await prisma.contentDelivery.update({
      where: { id: req.params.id },
      data: { status: "APPROVED", clientComment: null },
    });
    res.json(updated);
  },
);

router.put(
  "/content/:id/revision",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { comment } = req.body;
    const item = await prisma.contentDelivery.findUnique({
      where: { id: req.params.id },
    });
    if (!item || item.clientId !== req.portalUser!.clientId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const updated = await prisma.contentDelivery.update({
      where: { id: req.params.id },
      data: {
        status: "NEEDS_REVISION",
        clientComment: comment?.trim() || null,
      },
    });
    res.json(updated);
  },
);

// ── Invoices ──────────────────────────────────────────────────────────────────

// ── Costs ─────────────────────────────────────────────────────────────────────

router.get(
  "/costs",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const costs = await (prisma as any).clientCost.findMany({
      where: { clientId: req.portalUser!.clientId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json(costs);
  },
);

router.post(
  "/costs",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { name, amount, date } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ message: "Cost name required" });
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) {
      res.status(400).json({ message: "Valid amount required" });
      return;
    }
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400).json({ message: "Valid date required" });
      return;
    }

    const cost = await (prisma as any).clientCost.create({
      data: {
        clientId: req.portalUser!.clientId,
        name: name.trim(),
        amount: parsedAmount,
        date: parsedDate,
      },
    });

    res.status(201).json(cost);
  },
);

router.get(
  "/invoices",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { status } = req.query;
    const invoices = await prisma.payment.findMany({
      where: {
        clientId: req.portalUser!.clientId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { date: "desc" },
    });
    res.json({ invoices });
  },
);

// ── Notifications ─────────────────────────────────────────────────────────────

router.get(
  "/notifications",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const notifications = await prisma.clientNotification.findMany({
      where: { clientPortalUserId: req.portalUser!.clientPortalUserId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  },
);

router.put(
  "/notifications/read-all",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    await prisma.clientNotification.updateMany({
      where: {
        clientPortalUserId: req.portalUser!.clientPortalUserId,
        read: false,
      },
      data: { read: true },
    });
    res.json({ message: "All marked as read" });
  },
);

router.put(
  "/notifications/:id/read",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    await prisma.clientNotification.updateMany({
      where: {
        id: req.params.id,
        clientPortalUserId: req.portalUser!.clientPortalUserId,
      },
      data: { read: true },
    });
    res.json({ message: "Marked as read" });
  },
);

// ── Meetings (Portal Booking) ─────────────────────────────────────────────────

router.get(
  "/meeting-types",
  portalAuthenticate,
  async (_req, res: Response): Promise<void> => {
    const types = await (prisma as any).meetingType.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(types);
  },
);

router.get(
  "/available-slots",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { date, duration } = req.query;
    if (!date || !duration) {
      res.status(400).json({ message: "date and duration required" });
      return;
    }
    const durationMin = parseInt(duration as string);
    const targetDate = new Date(date as string);
    const dayOfWeek = targetDate.getDay();
    const startOfDay = new Date(date as string);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date as string);
    endOfDay.setHours(23, 59, 59, 999);

    const admins = await (prisma as any).adminAvailability.findMany({
      where: { dayOfWeek },
      include: { admin: { select: { id: true, name: true, avatar: true } } },
    });

    const result: { adminId: string; adminName: string; slots: string[] }[] =
      [];

    for (const avail of admins) {
      const blocked = await (prisma as any).blockedDate.findFirst({
        where: {
          adminId: avail.adminId,
          blockedDate: { gte: startOfDay, lte: endOfDay },
        },
      });
      if (blocked) continue;

      const existingMeetings = await (prisma as any).meeting.findMany({
        where: {
          adminId: avail.adminId,
          status: { notIn: ["CANCELLED"] },
          startTime: { gte: startOfDay, lte: endOfDay },
        },
        select: { startTime: true, endTime: true },
      });

      const [sh, sm] = avail.startTime.split(":").map(Number);
      const [eh, em] = avail.endTime.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      const allSlots: string[] = [];
      for (let t = start; t + durationMin <= end; t += durationMin) {
        allSlots.push(
          `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
        );
      }

      const available = allSlots.filter((slot) => {
        const [slh, slm] = slot.split(":").map(Number);
        const slotStart = slh * 60 + slm;
        const slotEnd = slotStart + durationMin;
        return !existingMeetings.some((m: any) => {
          const mS =
            new Date(m.startTime).getHours() * 60 +
            new Date(m.startTime).getMinutes();
          const mE =
            new Date(m.endTime).getHours() * 60 +
            new Date(m.endTime).getMinutes();
          return slotStart < mE && slotEnd > mS;
        });
      });

      if (available.length > 0) {
        result.push({
          adminId: avail.adminId,
          adminName: avail.admin.name,
          slots: available,
        });
      }
    }

    res.json(result);
  },
);

router.get(
  "/meetings",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { past } = req.query;
    const now = new Date();
    const meetings = await (prisma as any).meeting.findMany({
      where: {
        clientId: req.portalUser!.clientId,
        status: { notIn: ["CANCELLED"] },
        startTime: past === "true" ? { lt: now } : { gte: now },
      },
      include: {
        admin: { select: { id: true, name: true, avatar: true } },
        meetingType: true,
      },
      orderBy: { startTime: past === "true" ? "desc" : "asc" },
    });
    res.json(meetings);
  },
);

router.post(
  "/meetings",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const {
      adminId,
      meetingTypeId,
      title,
      description,
      startTime,
      endTime,
      timezone,
      notes,
    } = req.body;
    if (!adminId || !startTime || !endTime) {
      res.status(400).json({ message: "adminId, startTime, endTime required" });
      return;
    }
    const clientId = req.portalUser!.clientId;
    const bookedByPortalUserId = req.portalUser!.clientPortalUserId;

    const toDate = (v: string) => {
      const d = new Date(v);
      if (isNaN(d.getTime())) throw new Error("Invalid date");
      return d;
    };

    const meeting = await (prisma as any).meeting.create({
      data: {
        clientId,
        adminId,
        meetingTypeId: meetingTypeId || null,
        title: title || "Meeting",
        description: description || null,
        startTime: toDate(startTime),
        endTime: toDate(endTime),
        timezone: timezone || "Africa/Casablanca",
        notes: notes || null,
        bookedByPortalUserId,
        status: "SCHEDULED",
      },
      include: {
        admin: { select: { id: true, name: true, avatar: true } },
        meetingType: true,
      },
    });

    await prisma.clientNotification
      .create({
        data: {
          clientPortalUserId: bookedByPortalUserId,
          title: "Meeting Booked",
          message: `Your meeting "${meeting.title}" has been scheduled for ${new Date(meeting.startTime).toLocaleString()}.`,
          type: "meeting",
          link: "/portal/meetings",
        },
      })
      .catch(() => {});

    res.status(201).json(meeting);
  },
);

router.put(
  "/meetings/:id/cancel",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { cancelReason } = req.body;
    const meeting = await (prisma as any).meeting.findUnique({
      where: { id: req.params.id },
    });
    if (!meeting || meeting.clientId !== req.portalUser!.clientId) {
      res.status(404).json({ message: "Meeting not found" });
      return;
    }
    const updated = await (prisma as any).meeting.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED", cancelReason: cancelReason || null },
    });
    res.json(updated);
  },
);

// ── CRM (client-scoped) ───────────────────────────────────────────────────────

router.get(
  "/crm/orders",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const { status, search, from, to, page = "1" } = req.query;
    const clientId = req.portalUser!.clientId;
    const take = 20;
    const skip = (parseInt(page as string) - 1) * take;
    const dateFilter: Record<string, Date> = {};
    if (from) {
      const start = new Date(from as string);
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (to) {
      const end = new Date(to as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where: any = {
      clientId,
      ...(status && { status }),
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      ...(search && {
        OR: [
          { customerName: { contains: search as string, mode: "insensitive" } },
          { productName: { contains: search as string, mode: "insensitive" } },
          {
            customerPhone: { contains: search as string, mode: "insensitive" },
          },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      (prisma as any).crmOrder.findMany({
        where,
        include: { closer: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      (prisma as any).crmOrder.count({ where }),
    ]);

    res.json({
      orders,
      total,
      page: parseInt(page as string),
      pages: Math.ceil(total / take),
    });
  },
);

router.get(
  "/crm/stats",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const clientId = req.portalUser!.clientId;
    const orders = await (prisma as any).crmOrder.findMany({
      where: { clientId },
      select: {
        orderAmount: true,
        netProfit: true,
        adCost: true,
        productCost: true,
        shippingCost: true,
        status: true,
        paymentStatus: true,
        source: true,
        productName: true,
        quantity: true,
        createdAt: true,
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (s: number, o: any) => s + o.orderAmount,
      0,
    );
    const totalProfit = orders.reduce(
      (s: number, o: any) => s + o.netProfit,
      0,
    );
    const totalAdSpend = orders.reduce((s: number, o: any) => s + o.adCost, 0);
    const confirmed = orders.filter(
      (o: any) => o.status === "CONFIRMED",
    ).length;
    const delivered = orders.filter(
      (o: any) => o.status === "DELIVERED",
    ).length;
    const shipped = orders.filter((o: any) => o.status === "SHIPPED").length;
    const cancelled = orders.filter(
      (o: any) => o.status === "CANCELLED",
    ).length;
    const returned = orders.filter((o: any) => o.status === "RETURNED").length;
    const refused = orders.filter((o: any) => o.status === "REFUSED").length;
    const codPending = orders
      .filter((o: any) => o.paymentStatus === "COD_PENDING")
      .reduce((s: number, o: any) => s + o.orderAmount, 0);
    const convRate =
      totalOrders > 0
        ? ((confirmed + delivered + shipped) / totalOrders) * 100
        : 0;
    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const returnRate = totalOrders > 0 ? (returned / totalOrders) * 100 : 0;
    const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0;

    // Monthly breakdown (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const recentOrders = orders.filter(
      (o: any) => new Date(o.createdAt) >= sixMonthsAgo,
    );
    const monthly: Record<
      string,
      { revenue: number; profit: number; orders: number }
    > = {};
    for (const o of recentOrders) {
      const key = new Date(o.createdAt).toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      });
      if (!monthly[key]) monthly[key] = { revenue: 0, profit: 0, orders: 0 };
      monthly[key].revenue += o.orderAmount;
      monthly[key].profit += o.netProfit;
      monthly[key].orders += 1;
    }

    // By status
    const statusMap: Record<string, number> = {};
    for (const o of orders)
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;

    // By source
    const sourceMap: Record<string, number> = {};
    for (const o of orders)
      sourceMap[o.source] = (sourceMap[o.source] || 0) + 1;

    // Top products
    const productMap: Record<string, { revenue: number; count: number }> = {};
    for (const o of orders) {
      if (!productMap[o.productName])
        productMap[o.productName] = { revenue: 0, count: 0 };
      productMap[o.productName].revenue += o.orderAmount;
      productMap[o.productName].count += o.quantity;
    }
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, v]) => ({ name, ...v }));

    res.json({
      totalOrders,
      totalRevenue,
      totalProfit,
      totalAdSpend,
      confirmed,
      delivered,
      shipped,
      cancelled,
      returned,
      refused,
      codPending,
      conversionRate: parseFloat(convRate.toFixed(1)),
      profitMargin: parseFloat(profitMargin.toFixed(1)),
      avgOrderValue: parseFloat(avgOrderValue.toFixed(0)),
      returnRate: parseFloat(returnRate.toFixed(1)),
      roas: parseFloat(roas.toFixed(2)),
      monthlyTrend: Object.entries(monthly).map(([month, v]) => ({
        month,
        ...v,
      })),
      byStatus: Object.entries(statusMap).map(([status, count]) => ({
        status,
        count,
      })),
      bySource: Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      topProducts,
    });
  },
);

// ── KPIs (Meta Ads) ───────────────────────────────────────────────────────────

router.get(
  "/kpis",
  portalAuthenticate,
  async (req: PortalRequest, res: Response): Promise<void> => {
    const datePreset = (req.query.datePreset as string) || "last_7d";
    const config = await prisma.clientKpiConfig.findUnique({
      where: { clientId: req.portalUser!.clientId },
    });

    if (config?.metaToken && config?.metaAdAccountId) {
      try {
        const fields =
          "spend,reach,impressions,cpm,cpc,ctr,actions,action_values";
        const url = `https://graph.facebook.com/v19.0/act_${config.metaAdAccountId}/insights?fields=${fields}&date_preset=${datePreset}&level=account&access_token=${config.metaToken}`;
        const metaRes = await fetch(url);
        const metaData: any = await metaRes.json();

        if (metaData.error) throw new Error(metaData.error.message);

        const d = metaData.data?.[0] || {};
        const actions = d.actions || [];
        const actionValues = d.action_values || [];
        const leads =
          actions.find((a: any) => a.action_type === "lead")?.value || 0;
        const purchases =
          actions.find((a: any) => a.action_type === "purchase")?.value || 0;
        const purchaseValue =
          actionValues.find((a: any) => a.action_type === "purchase")?.value ||
          0;
        const spend = parseFloat(d.spend || 0);
        const roas = spend > 0 ? purchaseValue / spend : 0;
        const costPerLead = leads > 0 ? spend / leads : 0;
        const conversionRate =
          leads > 0 ? (parseInt(purchases) / parseInt(leads)) * 100 : 0;

        // Daily breakdown
        const dailyUrl = `https://graph.facebook.com/v19.0/act_${config.metaAdAccountId}/insights?fields=spend,reach,actions&date_preset=${datePreset}&time_increment=1&access_token=${config.metaToken}`;
        const dailyRes = await fetch(dailyUrl);
        const dailyData: any = await dailyRes.json();
        const daily = (dailyData.data || []).map((dd: any) => ({
          date: dd.date_start,
          spend: parseFloat(dd.spend || 0),
          reach: parseInt(dd.reach || 0),
          leads: parseInt(
            (dd.actions || []).find((a: any) => a.action_type === "lead")
              ?.value || 0,
          ),
          purchases: parseInt(
            (dd.actions || []).find((a: any) => a.action_type === "purchase")
              ?.value || 0,
          ),
          conversionRate: (() => {
            const dayLeads = parseInt(
              (dd.actions || []).find((a: any) => a.action_type === "lead")
                ?.value || 0,
            );
            const dayPurchases = parseInt(
              (dd.actions || []).find((a: any) => a.action_type === "purchase")
                ?.value || 0,
            );
            return dayLeads > 0 ? (dayPurchases / dayLeads) * 100 : 0;
          })(),
          roas: 0,
        }));

        res.json({
          isMock: false,
          datePreset,
          summary: {
            spend,
            reach: parseInt(d.reach || 0),
            impressions: parseInt(d.impressions || 0),
            cpm: parseFloat(d.cpm || 0),
            cpc: parseFloat(d.cpc || 0),
            ctr: parseFloat(d.ctr || 0),
            leads: parseInt(leads),
            purchases: parseInt(purchases),
            roas,
            costPerLead,
            conversionRate,
          },
          daily,
        });
        return;
      } catch (err: any) {
        console.error("Meta Ads API error:", err.message);
      }
    }

    const { days, start, end } = getPresetRange(datePreset);
    const costs = await (prisma as any).clientCost.findMany({
      where: {
        clientId: req.portalUser!.clientId,
        date: { gte: start, lte: end },
      },
      select: { amount: true, date: true },
    });
    const spendByDay = costs.reduce((map: Record<string, number>, cost: any) => {
      const key = isoDay(new Date(cost.date));
      map[key] = (map[key] || 0) + Number(cost.amount || 0);
      return map;
    }, {});
    const daily = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const spend = spendByDay[isoDay(d)] || 0;
      return {
        date: isoDay(d),
        spend: parseFloat(spend.toFixed(2)),
        reach: 0,
        leads: 0,
        purchases: 0,
        conversionRate: 0,
        roas: 0,
      };
    });
    const totalSpend = daily.reduce((s, d) => s + d.spend, 0);
    const totalLeads = daily.reduce((s, d) => s + d.leads, 0);
    const totalReach = daily.reduce((s, d) => s + d.reach, 0);
    const totalPurchases = daily.reduce((s, d) => s + d.purchases, 0);

    res.json({
      isMock: false,
      datePreset,
      summary: {
        spend: parseFloat(totalSpend.toFixed(2)),
        reach: totalReach,
        impressions: Math.floor(totalReach * 1.8),
        cpm: totalReach > 0 ? parseFloat((totalSpend / (totalReach / 1000)).toFixed(2)) : 0,
        cpc: totalLeads > 0 ? parseFloat((totalSpend / (totalLeads * 3)).toFixed(2)) : 0,
        ctr: 0,
        leads: totalLeads,
        purchases: totalPurchases,
        roas: 0,
        costPerLead: totalLeads > 0 ? parseFloat((totalSpend / totalLeads).toFixed(2)) : 0,
        conversionRate:
          totalLeads > 0
            ? parseFloat(((totalPurchases / totalLeads) * 100).toFixed(2))
            : 0,
      },
      daily,
    });
  },
);

export default router;
