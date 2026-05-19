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
  return { start, end };
}

function toIsoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getClientKpiSpend(
  clientId: string,
  datePreset: string,
  from?: string,
  to?: string,
) {
  const linkedCostSpend = await getClientCostsSpend(
    clientId,
    datePreset,
    from,
    to,
  );
  if (linkedCostSpend > 0) return linkedCostSpend;

  const config = await prisma.clientKpiConfig.findUnique({
    where: { clientId },
  });
  if (config?.metaToken && config?.metaAdAccountId) {
    try {
      const qs = new URLSearchParams({
        fields: "spend",
        level: "account",
        access_token: config.metaToken,
      });
      if (from || to) {
        const since = from || to;
        const until = to || from;
        if (since) qs.set("time_range[since]", since);
        if (until) qs.set("time_range[until]", until);
      } else {
        // Meta does not support date_preset=all_time, so use a sane default
        qs.set(
          "date_preset",
          datePreset && datePreset !== "all_time" ? datePreset : "last_90d",
        );
      }
      const url = `https://graph.facebook.com/v19.0/act_${config.metaAdAccountId}/insights?${qs.toString()}`;
      const metaRes = await fetch(url);
      const metaData: any = await metaRes.json();
      if (!metaData.error) {
        return parseFloat(metaData.data?.[0]?.spend || 0);
      }
    } catch (err: any) {
      console.error("Meta Ads spend lookup failed:", err.message);
    }
  }

  return 0;
}

async function getClientCostsSpend(
  clientId: string | undefined,
  datePreset: string,
  from?: string,
  to?: string,
) {
  const customRange =
    from || to
      ? {
          start: from ? new Date(from) : undefined,
          end: to ? new Date(to) : undefined,
        }
      : null;
  if (customRange?.start) customRange.start.setHours(0, 0, 0, 0);
  if (customRange?.end) customRange.end.setHours(23, 59, 59, 999);
  const presetRange =
    datePreset === "all_time" ? null : getPresetRange(datePreset);
  const range = customRange || presetRange;
  const clientCostModel = (prisma as any).clientCost;
  if (!clientCostModel?.aggregate) return 0;
  const costs = await clientCostModel.aggregate({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(range
        ? {
            date: {
              ...(range.start ? { gte: range.start } : {}),
              ...(range.end ? { lte: range.end } : {}),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  return costs._sum.amount || 0;
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
      from,
      to,
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
    if (from || to) {
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
      where.createdAt = dateFilter;
    }
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
      res.status(400).json({
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
    // Commission split used for the Closers commission breakdown.
    // Example (from sheet): Total = 2760, Agency = 2070 (75%), Closer = 690 (25%).
    const CLOSER_COMMISSION_SHARE = 0.25;

    const { teamOnly } = req.query;
    const users =
      teamOnly === "true"
        ? await prisma.$queryRaw<
            {
              id: string;
              name: string;
              email: string;
              avatar: string | null;
              phone: string | null;
              role: string;
              isCloser: boolean;
            }[]
          >`
        SELECT id, name, email, avatar, phone, role, "isCloser" FROM users
        WHERE active = true AND suspended = false AND "isCloser" = true ORDER BY name ASC`
        : await prisma.$queryRaw<
            {
              id: string;
              name: string;
              email: string;
              avatar: string | null;
              phone: string | null;
              role: string;
              isCloser: boolean;
            }[]
          >`
        SELECT id, name, email, avatar, phone, role, "isCloser" FROM users
        WHERE active = true AND suspended = false ORDER BY name ASC`;
    const stats = await Promise.all(
      users.map(async (u) => {
        type CommissionRuleSummary = {
          commissionRuleCount: number;
          commissionRuleType: "FIXED_PER_ORDER" | "PERCENTAGE" | "MIXED" | null;
          commissionRuleValue: number | null;
        };

        const summarizeRules = (
          rules: {
            type: string;
            fixedAmount: number | null;
            percentage: number | null;
          }[],
        ): CommissionRuleSummary => {
          if (!rules || rules.length === 0) {
            return {
              commissionRuleCount: 0,
              commissionRuleType: null,
              commissionRuleValue: null,
            };
          }

          const normalized = rules.map((r) => {
            if (r.type === "FIXED_PER_ORDER") {
              return {
                type: "FIXED_PER_ORDER" as const,
                value: r.fixedAmount ?? 0,
              };
            }
            return { type: "PERCENTAGE" as const, value: r.percentage ?? 0 };
          });

          const first = normalized[0];
          const allSameType = normalized.every((x) => x.type === first.type);
          const allSameValue = normalized.every(
            (x) => x.type === first.type && x.value === first.value,
          );

          if (allSameType && allSameValue) {
            return {
              commissionRuleCount: rules.length,
              commissionRuleType: first.type,
              commissionRuleValue: first.value,
            };
          }

          return {
            commissionRuleCount: rules.length,
            commissionRuleType: "MIXED",
            commissionRuleValue: null,
          };
        };

        const [
          total,
          confirmed,
          shipped,
          delivered,
          confirmedEver,
          shippedFromConfirmed,
          earnings,
          paidCommission,
          unpaidCommission,
          commissionRules,
        ] = await Promise.all([
          (prisma as any).crmOrder.count({ where: { closerId: u.id } }),
          (prisma as any).crmOrder.count({
            where: { closerId: u.id, status: "CONFIRMED" },
          }),
          (prisma as any).crmOrder.count({
            where: { closerId: u.id, status: "SHIPPED" },
          }),
          (prisma as any).crmOrder.count({
            where: { closerId: u.id, status: "DELIVERED" },
          }),
          (prisma as any).crmOrder.count({
            where: { closerId: u.id, confirmedAt: { not: null } },
          }),
          (prisma as any).crmOrder.count({
            where: {
              closerId: u.id,
              confirmedAt: { not: null },
              status: { in: ["SHIPPED", "DELIVERED"] },
            },
          }),
          (prisma as any).closerCommissionRecord.aggregate({
            where: { closerId: u.id },
            _sum: { amount: true },
          }),
          (prisma as any).closerCommissionRecord.aggregate({
            where: { closerId: u.id, paid: true },
            _sum: { amount: true },
          }),
          (prisma as any).closerCommissionRecord.aggregate({
            where: { closerId: u.id, paid: false },
            _sum: { amount: true },
          }),
          (prisma as any).commissionRule.findMany({
            where: { closerId: u.id, active: true },
            select: { type: true, fixedAmount: true, percentage: true },
          }),
        ]);

        const commissionSummary = summarizeRules(commissionRules);

        const closerCommissionTotal = earnings._sum.amount ?? 0;
        const commissionPaid = paidCommission._sum.amount ?? 0;
        const commissionUnpaid = unpaidCommission._sum.amount ?? 0;

        const commissionTotal =
          CLOSER_COMMISSION_SHARE > 0
            ? closerCommissionTotal / CLOSER_COMMISSION_SHARE
            : closerCommissionTotal;
        const agencyCommissionTotal = commissionTotal - closerCommissionTotal;

        return {
          ...u,
          totalOrders: total,
          confirmedOrders: confirmed,
          shippedOrders: shipped,
          deliveredOrders: delivered,
          shippedFromConfirmedOrders: shippedFromConfirmed,
          ...commissionSummary,
          conversionRate:
            confirmedEver > 0
              ? Math.round((shippedFromConfirmed / confirmedEver) * 100)
              : 0,
          totalEarnings: closerCommissionTotal,
          commissionTotal,
          agencyCommissionTotal,
          closerCommissionTotal,
          commissionPaid,
          commissionUnpaid,
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
      res.status(400).json({
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
    const { clientId, from, to, datePreset } = req.query;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Default to a meaningful range to power the "trend" charts.
    // If a custom range is provided, use it as-is.
    const hasCustomRange = Boolean(from || to);
    const effectiveFromDate = (() => {
      if (from) {
        const d = new Date(from as string);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      if (hasCustomRange && !from) return undefined;
      // default: start of month 5 months ago
      return new Date(today.getFullYear(), today.getMonth() - 5, 1);
    })();
    const effectiveToDate = (() => {
      if (to) {
        const d = new Date(to as string);
        d.setHours(23, 59, 59, 999);
        return d;
      }
      if (hasCustomRange && !to) return undefined;
      // default: today
      return today;
    })();

    const dateFilter: Record<string, unknown> = {};
    if (effectiveFromDate) dateFilter.gte = effectiveFromDate;
    if (effectiveToDate) dateFilter.lte = effectiveToDate;
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

    const effectiveFrom = effectiveFromDate
      ? toIsoDate(effectiveFromDate)
      : undefined;
    const effectiveTo = effectiveToDate
      ? toIsoDate(effectiveToDate)
      : undefined;

    const [orders, commissions] = await Promise.all([
      (prisma as any).crmOrder.findMany({
        where,
        orderBy: { createdAt: "asc" },
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
    const orderAdSpend = orders.reduce((s: number, o: any) => s + o.adCost, 0);
    const linkedCostSpend = await getClientCostsSpend(
      clientId ? (clientId as string) : undefined,
      (datePreset as string) || "custom",
      effectiveFrom,
      effectiveTo,
    );
    const totalAdSpend = clientId
      ? await getClientKpiSpend(
          clientId as string,
          (datePreset as string) || "custom",
          effectiveFrom,
          effectiveTo,
        )
      : linkedCostSpend || orderAdSpend;
    const totalProductCost = orders.reduce(
      (s: number, o: any) => s + o.productCost,
      0,
    );
    const totalShipping = orders.reduce(
      (s: number, o: any) => s + o.shippingCost,
      0,
    );
    const totalOrderCommissions = orders.reduce(
      (s: number, o: any) => s + o.closerCommission,
      0,
    );
    const totalNetProfit =
      totalRevenue -
      totalProductCost -
      totalShipping -
      totalAdSpend -
      totalOrderCommissions;
    const confirmed = orders.filter(
      (o: any) => o.status === "CONFIRMED" || o.status === "DELIVERED",
    ).length;
    const shipped = orders.filter(
      (o: any) => o.status === "SHIPPED" || o.status === "DELIVERED",
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

    // Monthly breakdown
    const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short" });
    const ymKeyOf = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

    // Build a continuous month series for the selected/custom range,
    // otherwise default to the last 6 months.
    const seriesStart = effectiveFromDate
      ? monthStart(effectiveFromDate)
      : new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const seriesEnd = effectiveToDate
      ? monthStart(effectiveToDate)
      : monthStart(today);
    const seriesKeys: string[] = [];
    {
      const cursor = new Date(seriesStart);
      while (cursor <= seriesEnd) {
        seriesKeys.push(ymKeyOf(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    type MonthlyAgg = {
      year: number;
      monthIndex: number;
      revenue: number;
      productCost: number;
      shipping: number;
      commissions: number;
      orderAdSpend: number;
      adSpend: number;
      profit: number;
      orders: number;
    };
    const monthlyMap: Record<string, MonthlyAgg> = {};
    for (const key of seriesKeys) {
      const [yy, mm] = key.split("-");
      const year = Number(yy);
      const monthIndex = Number(mm) - 1;
      monthlyMap[key] = {
        year,
        monthIndex,
        revenue: 0,
        productCost: 0,
        shipping: 0,
        commissions: 0,
        orderAdSpend: 0,
        adSpend: 0,
        profit: 0,
        orders: 0,
      };
    }

    for (const o of orders as any[]) {
      const createdAt = new Date(o.createdAt);
      const key = ymKeyOf(createdAt);
      const bucket = monthlyMap[key];
      if (!bucket) continue;
      bucket.revenue += o.orderAmount;
      bucket.productCost += o.productCost;
      bucket.shipping += o.shippingCost;
      bucket.commissions += o.closerCommission;
      bucket.orderAdSpend += o.adCost;
      bucket.orders += 1;
    }

    // Determine monthly ad spend strategy consistent with summary totals.
    if (linkedCostSpend > 0) {
      const start = new Date(seriesStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(
        seriesEnd.getFullYear(),
        seriesEnd.getMonth() + 1,
        0,
      );
      end.setHours(23, 59, 59, 999);

      const rows = (
        clientId
          ? await prisma.$queryRaw<{ ym: string; total: number }[]>`
            SELECT to_char(date_trunc('month', date), 'YYYY-MM') as ym,
                   SUM(amount)::float as total
            FROM client_costs
            WHERE "clientId" = ${clientId as string}
              AND date >= ${start}
              AND date <= ${end}
            GROUP BY ym
          `
          : await prisma.$queryRaw<{ ym: string; total: number }[]>`
            SELECT to_char(date_trunc('month', date), 'YYYY-MM') as ym,
                   SUM(amount)::float as total
            FROM client_costs
            WHERE date >= ${start}
              AND date <= ${end}
            GROUP BY ym
          `
      ) as any[];

      const costByYm: Record<string, number> = {};
      for (const r of rows) costByYm[r.ym] = Number(r.total || 0);
      for (const key of seriesKeys)
        monthlyMap[key].adSpend = costByYm[key] || 0;
    } else if (clientId) {
      const revenueSum = seriesKeys.reduce(
        (sum, k) => sum + monthlyMap[k].revenue,
        0,
      );
      for (const key of seriesKeys) {
        monthlyMap[key].adSpend =
          revenueSum > 0
            ? (totalAdSpend * monthlyMap[key].revenue) / revenueSum
            : totalAdSpend / Math.max(seriesKeys.length, 1);
      }
    } else {
      for (const key of seriesKeys)
        monthlyMap[key].adSpend = monthlyMap[key].orderAdSpend;
    }

    for (const key of seriesKeys) {
      const v = monthlyMap[key];
      v.profit =
        v.revenue - v.productCost - v.shipping - v.adSpend - v.commissions;
    }

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
        shipped,
        delivered,
        cancelled,
        returned,
        avgOrderValue,
        conversionRate,
        totalCommissions: commissions._sum.amount ?? 0,
      },
      monthly: seriesKeys
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .map((key) => {
          const v = monthlyMap[key];
          const label = `${fmtMonth.format(new Date(v.year, v.monthIndex, 1))} ${String(
            v.year,
          ).slice(-2)}`;
          return {
            month: label,
            revenue: v.revenue,
            profit: v.profit,
            orders: v.orders,
          };
        }),
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
