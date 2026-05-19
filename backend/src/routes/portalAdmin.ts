import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate, requireRole("MANAGER"));

function normalizeShopifyStoreUrl(storeUrl: string) {
  return storeUrl
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

async function syncShopifyOrders(config: any) {
  const url = `https://${config.storeUrl}/admin/api/2024-01/orders.json?limit=250&status=any`;
  const resp = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`Shopify API error: ${resp.status}`);
  }

  const data = (await resp.json()) as { orders: any[] };
  const shopifyOrders = data.orders || [];
  let created = 0;
  let updated = 0;

  for (const o of shopifyOrders) {
    const existing = await (prisma as any).crmOrder.findFirst({
      where: { shopifyOrderId: String(o.id), shopifyStore: config.storeUrl },
    });
    const lineItem = o.line_items?.[0] || {};
    const addr = o.shipping_address || o.billing_address || {};
    const orderData = {
      clientId: config.clientId,
      shopifyOrderId: String(o.id),
      shopifyStore: config.storeUrl,
      customerName:
        `${o.customer?.first_name || ""} ${o.customer?.last_name || ""}`.trim() ||
        o.email ||
        "Unknown",
      customerPhone: o.customer?.phone || addr.phone || null,
      customerCity: addr.city || null,
      productName: lineItem.name || "Shopify Order",
      quantity: lineItem.quantity || 1,
      orderAmount: parseFloat(o.total_price || "0"),
      status: o.cancelled_at
        ? "CANCELLED"
        : o.fulfillment_status === "fulfilled"
          ? "DELIVERED"
          : ("NEW" as any),
      paymentStatus: o.financial_status === "paid" ? "PAID" : ("COD_PENDING" as any),
      source: "OTHER" as any,
    };

    if (existing) {
      await (prisma as any).crmOrder.update({
        where: { id: existing.id },
        data: orderData,
      });
      updated++;
    } else {
      await (prisma as any).crmOrder.create({
        data: { ...orderData, netProfit: orderData.orderAmount },
      });
      created++;
    }
  }

  await (prisma as any).shopifyConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: new Date() },
  });

  return { message: "Sync complete", created, updated, total: shopifyOrders.length };
}

// GET /api/portal-admin — list clients with portal status
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  const clients = await prisma.client.findMany({
    where: { archived: false },
    include: {
      portalUser: {
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          lastLogin: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
  res.json(clients);
});

// POST /api/portal-admin/:clientId/create-account
router.post(
  "/:clientId/create-account",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ message: "Email, name, and password required" });
      return;
    }

    const existing = await prisma.clientPortalUser.findUnique({
      where: { clientId: req.params.clientId },
    });
    if (existing) {
      res
        .status(409)
        .json({ message: "Portal account already exists for this client" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const portalUser = await prisma.clientPortalUser.create({
      data: {
        email: email.toLowerCase().trim(),
        name,
        password: hashed,
        clientId: req.params.clientId,
      },
    });
    const { password: _, ...safe } = portalUser;
    res.status(201).json(safe);
  },
);

// DELETE /api/portal-admin/:clientId/account
router.delete(
  "/:clientId/account",
  async (req: AuthRequest, res: Response): Promise<void> => {
    await prisma.clientPortalUser.deleteMany({
      where: { clientId: req.params.clientId },
    });
    res.json({ message: "Portal account deleted" });
  },
);

// PUT /api/portal-admin/:clientId/reset-password
router.put(
  "/:clientId/reset-password",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { password } = req.body;
    if (!password || password.length < 6) {
      res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
      return;
    }
    const portalUser = await prisma.clientPortalUser.findUnique({
      where: { clientId: req.params.clientId },
    });
    if (!portalUser) {
      res.status(404).json({ message: "No portal account for this client" });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.clientPortalUser.update({
      where: { id: portalUser.id },
      data: { password: hashed },
    });
    res.json({ message: "Password reset successfully" });
  },
);

// GET /api/portal-admin/:clientId — full portal details
router.get(
  "/:clientId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { clientId } = req.params;
    const [client, updates, content, portalUser, costs] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.projectUpdate.findMany({
        where: { clientId },
        include: {
          postedBy: { select: { name: true } },
          comments: { orderBy: { createdAt: "asc" } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contentDelivery.findMany({
        where: { clientId },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.clientPortalUser.findUnique({
        where: { clientId },
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      prisma.clientCost.findMany({
        where: { clientId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
    ]);
    if (!client) {
      res.status(404).json({ message: "Client not found" });
      return;
    }
    res.json({ client, updates, content, portalUser, costs });
  },
);

// POST /api/portal-admin/:clientId/costs — add a client cost
router.post(
  "/:clientId/costs",
  async (req: AuthRequest, res: Response): Promise<void> => {
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

    const cost = await prisma.clientCost.create({
      data: {
        clientId: req.params.clientId,
        name: name.trim(),
        amount: parsedAmount,
        date: parsedDate,
      },
    });

    res.status(201).json(cost);
  },
);

// DELETE /api/portal-admin/costs/:costId
router.delete(
  "/costs/:costId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    await prisma.clientCost.delete({ where: { id: req.params.costId } });
    res.json({ message: "Cost deleted" });
  },
);

// POST /api/portal-admin/:clientId/updates — post project update
router.post(
  "/:clientId/updates",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, content, phase, imageUrl, fileUrl } = req.body;
    if (!title || !content) {
      res.status(400).json({ message: "Title and content required" });
      return;
    }

    const update = await prisma.projectUpdate.create({
      data: {
        clientId: req.params.clientId,
        title,
        content,
        phase: phase || null,
        imageUrl: imageUrl || null,
        fileUrl: fileUrl || null,
        postedById: req.user!.userId,
      },
      include: { postedBy: { select: { name: true, avatar: true } } },
    });

    // Notify the client
    const portalUser = await prisma.clientPortalUser.findUnique({
      where: { clientId: req.params.clientId },
    });
    if (portalUser) {
      await prisma.clientNotification.create({
        data: {
          clientPortalUserId: portalUser.id,
          title: "New Project Update",
          message: title,
          type: "info",
          link: "/portal/updates",
        },
      });
    }

    res.status(201).json(update);
  },
);

// DELETE /api/portal-admin/updates/:updateId
router.delete(
  "/updates/:updateId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    await prisma.projectUpdate.delete({ where: { id: req.params.updateId } });
    res.json({ message: "Update deleted" });
  },
);

// POST /api/portal-admin/:clientId/content — add content item
router.post(
  "/:clientId/content",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const {
      title,
      description,
      fileUrl,
      previewUrl,
      externalLink,
      category,
      status,
    } = req.body;
    if (!title) {
      res.status(400).json({ message: "Title required" });
      return;
    }

    const item = await prisma.contentDelivery.create({
      data: {
        clientId: req.params.clientId,
        title,
        description: description || null,
        fileUrl: fileUrl || null,
        previewUrl: previewUrl || null,
        externalLink: externalLink || null,
        category: category || "OTHER",
        status: status || "WAITING_APPROVAL",
        uploadedById: req.user!.userId,
      },
      include: { uploadedBy: { select: { name: true } } },
    });

    // Notify client
    const portalUser = await prisma.clientPortalUser.findUnique({
      where: { clientId: req.params.clientId },
    });
    if (portalUser && item.status === "WAITING_APPROVAL") {
      await prisma.clientNotification.create({
        data: {
          clientPortalUserId: portalUser.id,
          title: "New Design Ready for Review",
          message: `"${title}" is waiting for your approval`,
          type: "info",
          link: "/portal/content",
        },
      });
    }

    res.status(201).json(item);
  },
);

// PUT /api/portal-admin/content/:contentId — update content item
router.put(
  "/content/:contentId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const {
      title,
      description,
      fileUrl,
      previewUrl,
      externalLink,
      category,
      status,
      revisionNote,
    } = req.body;
    const updated = await prisma.contentDelivery.update({
      where: { id: req.params.contentId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(fileUrl !== undefined && { fileUrl }),
        ...(previewUrl !== undefined && { previewUrl }),
        ...(externalLink !== undefined && { externalLink }),
        ...(category && { category }),
        ...(status && { status }),
        ...(revisionNote !== undefined && { revisionNote }),
      },
      include: { uploadedBy: { select: { name: true } } },
    });
    res.json(updated);
  },
);

// DELETE /api/portal-admin/content/:contentId
router.delete(
  "/content/:contentId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    await prisma.contentDelivery.delete({
      where: { id: req.params.contentId },
    });
    res.json({ message: "Content deleted" });
  },
);

// PUT /api/portal-admin/:clientId/currency
router.put(
  "/:clientId/currency",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { preferredCurrency } = req.body;
    if (!["MAD", "USD", "EUR"].includes(preferredCurrency)) {
      res.status(400).json({ message: "Invalid currency" });
      return;
    }
    await prisma.client.update({
      where: { id: req.params.clientId },
      data: { preferredCurrency },
    });
    res.json({ message: "Currency updated" });
  },
);

// GET /api/portal-admin/:clientId/kpi-config
router.get(
  "/:clientId/kpi-config",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const config = await prisma.clientKpiConfig.findUnique({
      where: { clientId: req.params.clientId },
    });
    if (!config) {
      res.json({ metaAdAccountId: null, hasToken: false });
      return;
    }
    res.json({
      metaAdAccountId: config.metaAdAccountId,
      hasToken: !!config.metaToken,
    });
  },
);

// PUT /api/portal-admin/:clientId/kpi-config
router.put(
  "/:clientId/kpi-config",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { metaToken, metaAdAccountId } = req.body;
    await prisma.clientKpiConfig.upsert({
      where: { clientId: req.params.clientId },
      create: {
        clientId: req.params.clientId,
        metaToken: metaToken || null,
        metaAdAccountId: metaAdAccountId || null,
      },
      update: {
        metaToken: metaToken || null,
        metaAdAccountId: metaAdAccountId || null,
      },
    });
    res.json({ message: "KPI config saved" });
  },
);

// GET /api/portal-admin/:clientId/shopify — client Shopify connections
router.get(
  "/:clientId/shopify",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const configs = await (prisma as any).shopifyConfig.findMany({
      where: { clientId: req.params.clientId },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(configs);
  },
);

// POST /api/portal-admin/:clientId/shopify — connect Shopify store
router.post(
  "/:clientId/shopify",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { storeName, storeUrl, accessToken } = req.body;
    if (!storeName || !storeUrl || !accessToken) {
      res
        .status(400)
        .json({ message: "storeName, storeUrl, accessToken are required" });
      return;
    }

    const config = await (prisma as any).shopifyConfig.create({
      data: {
        clientId: req.params.clientId,
        storeName,
        storeUrl: normalizeShopifyStoreUrl(storeUrl),
        accessToken,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.status(201).json(config);
  },
);

// PUT /api/portal-admin/shopify/:id — update Shopify connection
router.put(
  "/shopify/:id",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { storeName, storeUrl, accessToken, active } = req.body;
    const config = await (prisma as any).shopifyConfig.update({
      where: { id: req.params.id },
      data: {
        storeName: storeName || undefined,
        storeUrl: storeUrl ? normalizeShopifyStoreUrl(storeUrl) : undefined,
        accessToken: accessToken || undefined,
        active: active !== undefined ? active : undefined,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.json(config);
  },
);

// DELETE /api/portal-admin/shopify/:id — remove Shopify connection
router.delete(
  "/shopify/:id",
  async (req: AuthRequest, res: Response): Promise<void> => {
    await (prisma as any).shopifyConfig.delete({
      where: { id: req.params.id },
    });
    res.json({ message: "Deleted" });
  },
);

// POST /api/portal-admin/shopify/:id/sync — import Shopify orders into CRM orders
router.post(
  "/shopify/:id/sync",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const config = await (prisma as any).shopifyConfig.findUnique({
      where: { id: req.params.id },
    });
    if (!config) {
      res.status(404).json({ message: "Config not found" });
      return;
    }

    try {
      res.json(await syncShopifyOrders(config));
    } catch (err: any) {
      res.status(502).json({ message: err.message || "Failed to connect to Shopify" });
    }
  },
);

// POST /api/portal-admin/:clientId/notify
router.post(
  "/:clientId/notify",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, message, type, link } = req.body;
    if (!title || !message) {
      res.status(400).json({ message: "Title and message required" });
      return;
    }
    const portalUser = await prisma.clientPortalUser.findUnique({
      where: { clientId: req.params.clientId },
    });
    if (!portalUser) {
      res.status(404).json({ message: "No portal account for this client" });
      return;
    }
    const notification = await prisma.clientNotification.create({
      data: {
        clientPortalUserId: portalUser.id,
        title,
        message,
        type: type || "info",
        link: link || null,
      },
    });
    res.status(201).json(notification);
  },
);

// POST /api/portal-admin/:clientId/updates/:updateId/comments (admin reply)
router.post(
  "/:clientId/updates/:updateId/comments",
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ message: "Content required" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { name: true },
    });
    const comment = await prisma.updateComment.create({
      data: {
        updateId: req.params.updateId,
        content: content.trim(),
        isClient: false,
        authorName: user?.name || "Agency Team",
        authorId: req.user!.userId,
      },
    });
    res.status(201).json(comment);
  },
);

export default router;
