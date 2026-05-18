import { Router, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest, ROLE_LEVELS } from "../middleware/auth";
import { getRatesCache } from "../lib/currency";

const router = Router();
router.use(authenticate);

const h =
  (
    fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>,
  ) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcNetProfit(order: {
  orderAmount: number;
  productCost: number;
  shippingCost: number;
  adCost: number;
  closerCommission: number;
}) {
  return (
    order.orderAmount -
    order.productCost -
    order.shippingCost -
    order.adCost -
    order.closerCommission
  );
}

async function calcCommission(
  closerId: string,
  clientId: string,
  orderAmount: number,
): Promise<number> {
  const rule = await (prisma as any).commissionRule.findFirst({
    where: { clientId, active: true, OR: [{ closerId }, { closerId: null }] },
    orderBy: { closerId: "desc" },
  });
  if (!rule) return 0;
  if (rule.type === "FIXED_PER_ORDER") return rule.fixedAmount ?? 0;
  if (rule.type === "PERCENTAGE")
    return (orderAmount * (rule.percentage ?? 0)) / 100;
  return 0;
}

// ── ORDERS ────────────────────────────────────────────────────────────────────

router.get(
  "/orders",
  h(async (req, res) => {
    const {
      clientId,
      closerId,
      status,
      paymentStatus,
      source,
      search,
      page = "1",
      limit = "50",
    } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (closerId) where.closerId = closerId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: "insensitive" } },
        { productName: { contains: search as string, mode: "insensitive" } },
        { customerPhone: { contains: search as string, mode: "insensitive" } },
        { customerCity: { contains: search as string, mode: "insensitive" } },
      ];
    }
    const [orders, total] = await Promise.all([
      (prisma as any).crmOrder.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        include: {
          client: { select: { id: true, name: true } },
          closer: { select: { id: true, name: true, avatar: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).crmOrder.count({ where }),
    ]);
    res.json({
      orders,
      total,
      page: parseInt(page as string),
      pages: Math.ceil(total / parseInt(limit as string)),
    });
  }),
);

router.get(
  "/orders/:id",
  h(async (req, res) => {
    const order = await (prisma as any).crmOrder.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true, avatar: true } },
        customer: true,
        commissionRecords: {
          include: { closer: { select: { id: true, name: true } } },
        },
      },
    });
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json(order);
  }),
);

router.post(
  "/orders",
  h(async (req, res) => {
    const {
      clientId,
      closerId,
      customerId,
      customerName,
      customerPhone,
      customerCity,
      productName,
      quantity,
      orderAmount,
      productCost,
      shippingCost,
      adCost,
      status,
      paymentStatus,
      source,
      notes,
      shopifyOrderId,
      shopifyStore,
    } = req.body;
    if (!clientId || !customerName || !productName || !orderAmount) {
      res
        .status(400)
        .json({
          message:
            "clientId, customerName, productName, orderAmount are required",
        });
      return;
    }

    // Team members can only create orders for clients they're assigned to
    const userLevel = ROLE_LEVELS[req.user!.role] || 0;
    if (userLevel < ROLE_LEVELS["MANAGER"]) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM client_closers WHERE "clientId" = ${clientId} AND "userId" = ${req.user!.userId} LIMIT 1
    `;
      if (rows.length === 0) {
        res
          .status(403)
          .json({ message: "You are not assigned to this client" });
        return;
      }
    }

    let commission = 0;
    if (closerId)
      commission = await calcCommission(
        closerId,
        clientId,
        Number(orderAmount),
      );
    const netProfit = calcNetProfit({
      orderAmount: Number(orderAmount),
      productCost: Number(productCost || 0),
      shippingCost: Number(shippingCost || 0),
      adCost: Number(adCost || 0),
      closerCommission: commission,
    });
    const order = await (prisma as any).crmOrder.create({
      data: {
        clientId,
        closerId: closerId || null,
        customerId: customerId || null,
        customerName,
        customerPhone: customerPhone || null,
        customerCity: customerCity || null,
        productName,
        quantity: Number(quantity || 1),
        orderAmount: Number(orderAmount),
        productCost: Number(productCost || 0),
        shippingCost: Number(shippingCost || 0),
        adCost: Number(adCost || 0),
        closerCommission: commission,
        netProfit,
        status: status || "NEW",
        paymentStatus: paymentStatus || "COD_PENDING",
        source: source || "OTHER",
        notes: notes || null,
        shopifyOrderId: shopifyOrderId || null,
        shopifyStore: shopifyStore || null,
      },
      include: {
        client: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true, avatar: true } },
      },
    });
    res.status(201).json(order);
  }),
);

router.put(
  "/orders/:id",
  h(async (req, res) => {
    const existing = await (prisma as any).crmOrder.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const fields = [
      "clientId",
      "closerId",
      "customerId",
      "customerName",
      "customerPhone",
      "customerCity",
      "productName",
      "quantity",
      "orderAmount",
      "productCost",
      "shippingCost",
      "adCost",
      "status",
      "paymentStatus",
      "source",
      "notes",
      "closerNotes",
      "shopifyOrderId",
      "shopifyStore",
    ];
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in req.body) data[f] = req.body[f] ?? null;
    }
    for (const numField of [
      "quantity",
      "orderAmount",
      "productCost",
      "shippingCost",
      "adCost",
    ]) {
      if (numField in data) data[numField] = Number(data[numField]);
    }

    const closerId = (
      "closerId" in data ? data.closerId : existing.closerId
    ) as string | null;
    const clientId = existing.clientId as string;
    const orderAmount = (
      "orderAmount" in data ? Number(data.orderAmount) : existing.orderAmount
    ) as number;

    if (closerId) {
      data.closerCommission = await calcCommission(
        closerId,
        clientId,
        orderAmount,
      );
    }
    data.netProfit = calcNetProfit({
      orderAmount,
      productCost: Number(
        "productCost" in data ? data.productCost : existing.productCost,
      ),
      shippingCost: Number(
        "shippingCost" in data ? data.shippingCost : existing.shippingCost,
      ),
      adCost: Number("adCost" in data ? data.adCost : existing.adCost),
      closerCommission: Number(
        data.closerCommission ?? existing.closerCommission,
      ),
    });

    const wasConfirmed =
      existing.status !== "CONFIRMED" && data.status === "CONFIRMED";
    if (wasConfirmed) data.confirmedAt = new Date();

    const order = await (prisma as any).crmOrder.update({
      where: { id: req.params.id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Auto-create commission record when confirmed
    if (wasConfirmed && closerId && Number(data.closerCommission) > 0) {
      await (prisma as any).closerCommissionRecord.create({
        data: {
          closerId,
          orderId: order.id,
          amount: Number(data.closerCommission),
        },
      });
    }

    res.json(order);
  }),
);

router.delete(
  "/orders/:id",
  h(async (req, res) => {
    await (prisma as any).crmOrder.delete({ where: { id: req.params.id } });
    res.json({ message: "Order deleted" });
  }),
);

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

router.get(
  "/customers",
  h(async (req, res) => {
    const { clientId, search } = req.query;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { phone: { contains: search as string, mode: "insensitive" } },
        { city: { contains: search as string, mode: "insensitive" } },
      ];
    }
    const customers = await (prisma as any).crmCustomer.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { totalSpend: "desc" },
    });
    res.json(customers);
  }),
);

router.post(
  "/customers",
  h(async (req, res) => {
    const { clientId, name, phone, city, address, notes } = req.body;
    if (!clientId || !name) {
      res.status(400).json({ message: "clientId and name are required" });
      return;
    }
    const customer = await (prisma as any).crmCustomer.create({
      data: {
        clientId,
        name,
        phone: phone || null,
        city: city || null,
        address: address || null,
        notes: notes || null,
      },
    });
    res.status(201).json(customer);
  }),
);

router.put(
  "/customers/:id",
  h(async (req, res) => {
    const { name, phone, city, address, notes } = req.body;
    const customer = await (prisma as any).crmCustomer.update({
      where: { id: req.params.id },
      data: {
        name,
        phone: phone || null,
        city: city || null,
        address: address || null,
        notes: notes || null,
      },
    });
    res.json(customer);
  }),
);

// ── CLOSERS ───────────────────────────────────────────────────────────────────

// GET /crm/rates — exchange rates for currency conversion
router.get(
  "/rates",
  h(async (_req, res) => {
    res.json(getRatesCache());
  }),
);

router.get(
  "/closers",
  h(async (req, res) => {
    const { teamOnly } = req.query;
    const users =
      teamOnly === "true"
        ? await prisma.$queryRaw<
            {
              id: string;
              name: string;
              email: string;
              avatar: string | null;
              role: string;
              isCloser: boolean;
            }[]
          >`
        SELECT id, name, email, avatar, role, "isCloser" FROM users
        WHERE active = true AND suspended = false AND "isCloser" = true ORDER BY name ASC`
        : await prisma.$queryRaw<
            {
              id: string;
              name: string;
              email: string;
              avatar: string | null;
              role: string;
              isCloser: boolean;
            }[]
          >`
        SELECT id, name, email, avatar, role, "isCloser" FROM users
        WHERE active = true AND suspended = false ORDER BY name ASC`;
    const stats = await Promise.all(
      users.map(async (u) => {
        const [total, confirmed, delivered, earnings] = await Promise.all([
          (prisma as any).crmOrder.count({ where: { closerId: u.id } }),
          (prisma as any).crmOrder.count({
            where: { closerId: u.id, status: "CONFIRMED" },
          }),
          (prisma as any).crmOrder.count({
            where: { closerId: u.id, status: "DELIVERED" },
          }),
          (prisma as any).closerCommissionRecord.aggregate({
            where: { closerId: u.id },
            _sum: { amount: true },
          }),
        ]);
        return {
          ...u,
          totalOrders: total,
          confirmedOrders: confirmed,
          deliveredOrders: delivered,
          conversionRate:
            total > 0 ? Math.round(((confirmed + delivered) / total) * 100) : 0,
          totalEarnings: earnings._sum.amount ?? 0,
        };
      }),
    );
    res.json(stats);
  }),
);

// ── COMMISSION RULES ──────────────────────────────────────────────────────────

router.get(
  "/commission-rules",
  h(async (req, res) => {
    const { clientId } = req.query;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    const rules = await (prisma as any).commissionRule.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rules);
  }),
);

router.post(
  "/commission-rules",
  h(async (req, res) => {
    const {
      clientId,
      closerId,
      name,
      type,
      fixedAmount,
      percentage,
      description,
    } = req.body;
    if (!clientId || !name || !type) {
      res.status(400).json({ message: "clientId, name, type are required" });
      return;
    }
    const rule = await (prisma as any).commissionRule.create({
      data: {
        clientId,
        closerId: closerId || null,
        name,
        type,
        fixedAmount: fixedAmount ? Number(fixedAmount) : null,
        percentage: percentage ? Number(percentage) : null,
        description: description || null,
      },
      include: {
        client: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(rule);
  }),
);

router.put(
  "/commission-rules/:id",
  h(async (req, res) => {
    const {
      name,
      type,
      fixedAmount,
      percentage,
      description,
      active,
      closerId,
    } = req.body;
    const rule = await (prisma as any).commissionRule.update({
      where: { id: req.params.id },
      data: {
        name,
        type,
        active,
        closerId: closerId !== undefined ? closerId || null : undefined,
        fixedAmount:
          fixedAmount !== undefined
            ? fixedAmount
              ? Number(fixedAmount)
              : null
            : undefined,
        percentage:
          percentage !== undefined
            ? percentage
              ? Number(percentage)
              : null
            : undefined,
        description: description || null,
      },
      include: {
        client: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true } },
      },
    });
    res.json(rule);
  }),
);

router.delete(
  "/commission-rules/:id",
  h(async (req, res) => {
    await (prisma as any).commissionRule.delete({
      where: { id: req.params.id },
    });
    res.json({ message: "Deleted" });
  }),
);

// ── COMMISSION RECORDS ────────────────────────────────────────────────────────

router.get(
  "/commissions",
  h(async (req, res) => {
    const { closerId, paid } = req.query;
    const where: Record<string, unknown> = {};
    if (closerId) where.closerId = closerId;
    if (paid !== undefined) where.paid = paid === "true";
    const records = await (prisma as any).closerCommissionRecord.findMany({
      where,
      include: {
        closer: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            customerName: true,
            productName: true,
            orderAmount: true,
            confirmedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(records);
  }),
);

router.put(
  "/commissions/:id/pay",
  h(async (req, res) => {
    const record = await (prisma as any).closerCommissionRecord.update({
      where: { id: req.params.id },
      data: { paid: true, paidAt: new Date() },
    });
    res.json(record);
  }),
);

// ── SHOPIFY ───────────────────────────────────────────────────────────────────

router.get(
  "/shopify",
  h(async (req, res) => {
    const { clientId } = req.query;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    const configs = await (prisma as any).shopifyConfig.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(configs);
  }),
);

router.post(
  "/shopify",
  h(async (req, res) => {
    const { clientId, storeName, storeUrl, accessToken } = req.body;
    if (!clientId || !storeName || !storeUrl || !accessToken) {
      res
        .status(400)
        .json({
          message: "clientId, storeName, storeUrl, accessToken are required",
        });
      return;
    }
    const config = await (prisma as any).shopifyConfig.create({
      data: {
        clientId,
        storeName,
        storeUrl: storeUrl.replace(/\/$/, ""),
        accessToken,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.status(201).json(config);
  }),
);

router.put(
  "/shopify/:id",
  h(async (req, res) => {
    const { storeName, storeUrl, accessToken, active } = req.body;
    const config = await (prisma as any).shopifyConfig.update({
      where: { id: req.params.id },
      data: {
        storeName: storeName || undefined,
        storeUrl: storeUrl ? storeUrl.replace(/\/$/, "") : undefined,
        accessToken: accessToken || undefined,
        active: active !== undefined ? active : undefined,
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.json(config);
  }),
);

router.delete(
  "/shopify/:id",
  h(async (req, res) => {
    await (prisma as any).shopifyConfig.delete({
      where: { id: req.params.id },
    });
    res.json({ message: "Deleted" });
  }),
);

router.post(
  "/shopify/:id/sync",
  h(async (req, res) => {
    const config = await (prisma as any).shopifyConfig.findUnique({
      where: { id: req.params.id },
    });
    if (!config) {
      res.status(404).json({ message: "Config not found" });
      return;
    }

    const url = `https://${config.storeUrl}/admin/api/2024-01/orders.json?limit=250&status=any`;
    let shopifyOrders: any[] = [];
    try {
      const resp = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": config.accessToken,
          "Content-Type": "application/json",
        },
      });
      if (!resp.ok) {
        res.status(502).json({ message: `Shopify API error: ${resp.status}` });
        return;
      }
      const data = (await resp.json()) as { orders: any[] };
      shopifyOrders = data.orders || [];
    } catch (e) {
      res.status(502).json({ message: "Failed to connect to Shopify" });
      return;
    }

    let created = 0,
      updated = 0;
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
        paymentStatus:
          o.financial_status === "paid" ? "PAID" : ("COD_PENDING" as any),
        source: "OTHER" as any,
      };
      if (existing) {
        await (prisma as any).crmOrder.update({
          where: { id: existing.id },
          data: orderData,
        });
        updated++;
      } else {
        const commission = 0;
        await (prisma as any).crmOrder.create({
          data: { ...orderData, netProfit: orderData.orderAmount - commission },
        });
        created++;
      }
    }

    await (prisma as any).shopifyConfig.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      message: "Sync complete",
      created,
      updated,
      total: shopifyOrders.length,
    });
  }),
);

// ── MY ORDERS (team member view) ──────────────────────────────────────────────

router.get(
  "/my-clients",
  h(async (req, res) => {
    const userLevel = ROLE_LEVELS[req.user!.role] || 0;
    if (userLevel >= ROLE_LEVELS["MANAGER"]) {
      const clients = await prisma.client.findMany({
        where: { archived: false },
        select: { id: true, name: true, service: true, status: true },
        orderBy: { name: "asc" },
      });
      res.json(clients);
      return;
    }
    const clients = await prisma.$queryRaw<
      { id: string; name: string; service: string; status: string }[]
    >`
    SELECT c.id, c.name, c.service, c.status
    FROM client_closers cc
    JOIN clients c ON c.id = cc."clientId"
    WHERE cc."userId" = ${req.user!.userId}
    ORDER BY cc."assignedAt" ASC
  `;
    res.json(clients);
  }),
);

router.get(
  "/my-orders",
  h(async (req, res) => {
    const { status, search, page = "1" } = req.query;
    const take = 30;
    const skip = (parseInt(page as string) - 1) * take;
    const where: Record<string, unknown> = { closerId: req.user!.userId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search as string, mode: "insensitive" } },
        { productName: { contains: search as string, mode: "insensitive" } },
        { customerPhone: { contains: search as string, mode: "insensitive" } },
      ];
    }
    const [orders, total] = await Promise.all([
      (prisma as any).crmOrder.findMany({
        where,
        skip,
        take,
        include: { client: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).crmOrder.count({ where }),
    ]);
    res.json({ orders, total, pages: Math.ceil(total / take) });
  }),
);

router.get(
  "/my-stats",
  h(async (req, res) => {
    const userId = req.user!.userId;
    const [total, confirmed, shipped, delivered, pendingComm, totalComm] =
      await Promise.all([
        (prisma as any).crmOrder.count({ where: { closerId: userId } }),
        (prisma as any).crmOrder.count({
          where: { closerId: userId, status: "CONFIRMED" },
        }),
        (prisma as any).crmOrder.count({
          where: { closerId: userId, status: "SHIPPED" },
        }),
        (prisma as any).crmOrder.count({
          where: { closerId: userId, status: "DELIVERED" },
        }),
        (prisma as any).closerCommissionRecord.aggregate({
          where: { closerId: userId, paid: false },
          _sum: { amount: true },
        }),
        (prisma as any).closerCommissionRecord.aggregate({
          where: { closerId: userId },
          _sum: { amount: true },
        }),
      ]);
    res.json({
      totalOrders: total,
      confirmed,
      shipped,
      delivered,
      conversionRate:
        total > 0
          ? Math.round(((confirmed + shipped + delivered) / total) * 100)
          : 0,
      pendingCommission: pendingComm._sum.amount ?? 0,
      totalCommission: totalComm._sum.amount ?? 0,
    });
  }),
);

// ── ANALYTICS ─────────────────────────────────────────────────────────────────

router.get(
  "/analytics",
  h(async (req, res) => {
    const { clientId, from, to } = req.query;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (from || to) {
      const dateFilter: Record<string, unknown> = {};
      if (from) dateFilter.gte = new Date(from as string);
      if (to) dateFilter.lte = new Date(to as string);
      where.createdAt = dateFilter;
    }

    const [orders, commissions] = await Promise.all([
      (prisma as any).crmOrder.findMany({
        where,
        select: {
          orderAmount: true,
          productCost: true,
          shippingCost: true,
          adCost: true,
          closerCommission: true,
          netProfit: true,
          status: true,
          paymentStatus: true,
          source: true,
          createdAt: true,
          customerCity: true,
        },
      }),
      (prisma as any).closerCommissionRecord.aggregate({
        where: clientId ? { order: { clientId: clientId as string } } : {},
        _sum: { amount: true },
      }),
    ]);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (s: number, o: any) => s + o.orderAmount,
      0,
    );
    const totalNetProfit = orders.reduce(
      (s: number, o: any) => s + o.netProfit,
      0,
    );
    const totalAdSpend = orders.reduce((s: number, o: any) => s + o.adCost, 0);
    const totalProductCost = orders.reduce(
      (s: number, o: any) => s + o.productCost,
      0,
    );
    const totalShipping = orders.reduce(
      (s: number, o: any) => s + o.shippingCost,
      0,
    );
    const confirmed = orders.filter(
      (o: any) => o.status === "CONFIRMED" || o.status === "DELIVERED",
    ).length;
    const delivered = orders.filter(
      (o: any) => o.status === "DELIVERED",
    ).length;
    const cancelled = orders.filter(
      (o: any) => o.status === "CANCELLED" || o.status === "REFUSED",
    ).length;
    const returned = orders.filter((o: any) => o.status === "RETURNED").length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate =
      totalOrders > 0 ? Math.round((confirmed / totalOrders) * 100) : 0;

    // Monthly breakdown (last 6 months)
    const monthlyMap: Record<
      string,
      { revenue: number; profit: number; orders: number }
    > = {};
    orders.forEach((o: any) => {
      const key = new Date(o.createdAt).toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      if (!monthlyMap[key])
        monthlyMap[key] = { revenue: 0, profit: 0, orders: 0 };
      monthlyMap[key].revenue += o.orderAmount;
      monthlyMap[key].profit += o.netProfit;
      monthlyMap[key].orders++;
    });

    // By status
    const statusMap: Record<string, number> = {};
    orders.forEach((o: any) => {
      statusMap[o.status] = (statusMap[o.status] || 0) + 1;
    });

    // By source
    const sourceMap: Record<string, number> = {};
    orders.forEach((o: any) => {
      sourceMap[o.source] = (sourceMap[o.source] || 0) + 1;
    });

    // Top cities
    const cityMap: Record<string, number> = {};
    orders.forEach((o: any) => {
      if (o.customerCity)
        cityMap[o.customerCity] = (cityMap[o.customerCity] || 0) + 1;
    });

    res.json({
      summary: {
        totalOrders,
        totalRevenue,
        totalNetProfit,
        totalAdSpend,
        totalProductCost,
        totalShipping,
        confirmed,
        delivered,
        cancelled,
        returned,
        avgOrderValue,
        conversionRate,
        totalCommissions: commissions._sum.amount ?? 0,
      },
      monthly: Object.entries(monthlyMap).map(([month, v]) => ({
        month,
        ...v,
      })),
      byStatus: Object.entries(statusMap).map(([status, count]) => ({
        status,
        count,
      })),
      bySource: Object.entries(sourceMap).map(([source, count]) => ({
        source,
        count,
      })),
      topCities: Object.entries(cityMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([city, count]) => ({ city, count })),
    });
  }),
);

export default router;
