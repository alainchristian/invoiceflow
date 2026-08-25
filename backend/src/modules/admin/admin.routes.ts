import { Router } from "express";
import { z } from "zod";
import type { Prisma, Plan, PlatformRole } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { requireStripe, StripeNotConfiguredError, sendStripeNotConfigured } from "../../lib/stripe.js";
import { sendEmail } from "../../lib/email.js";
import { platformMessageEmail } from "../email/templates.js";
import { PLANS } from "../billing/plans.js";
import { requireAuth, requirePlatformRole, type AuthedRequest } from "../../middleware/auth.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();

router.use(requireAuth);

type TenantStatus = "ACTIVE" | "TRIAL" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

function deriveTenantStatus(org: { suspended: boolean; subscriptionStatus: string | null }): TenantStatus {
  if (org.suspended) return "SUSPENDED";
  switch (org.subscriptionStatus) {
    case "trialing":
      return "TRIAL";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELLED";
    default:
      // active, null (Starter/never subscribed), incomplete, etc. all read as usable access.
      return "ACTIVE";
  }
}

function clientMeta(req: AuthedRequest) {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const ADMIN_ACTION_LABEL: Record<string, string> = {
  cross_tenant_access: "Platform admin accessed this tenant",
  suspend_organization: "Tenant suspended",
  reactivate_organization: "Tenant reactivated",
  delete_organization: "Tenant deleted",
  impersonation_started: "Platform admin logged in as this tenant",
  tenant_notification_sent: "Platform admin sent a notification",
  admin_role_granted: "Administrator role granted",
  admin_role_changed: "Administrator role changed",
  admin_role_revoked: "Administrator role revoked",
  platform_settings_updated: "Platform settings updated",
};

// ---------------------------------------------------------------------------
// Shared tenant list query -- backs both GET /organizations and GET /subscriptions.
// ---------------------------------------------------------------------------

interface OrgListFilters {
  search?: string;
  status?: string;
  plan?: string;
  joinedFrom?: string;
  joinedTo?: string;
  renewalFrom?: string;
  renewalTo?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
}

function buildOrgWhere(filters: OrgListFilters): Prisma.OrganizationWhereInput {
  const where: Prisma.OrganizationWhereInput = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { slug: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.plan) where.plan = filters.plan as Plan;
  if (filters.joinedFrom || filters.joinedTo) {
    where.createdAt = {};
    if (filters.joinedFrom) where.createdAt.gte = new Date(filters.joinedFrom);
    if (filters.joinedTo) where.createdAt.lte = new Date(filters.joinedTo);
  }
  if (filters.renewalFrom || filters.renewalTo) {
    where.currentPeriodEnd = {};
    if (filters.renewalFrom) where.currentPeriodEnd.gte = new Date(filters.renewalFrom);
    if (filters.renewalTo) where.currentPeriodEnd.lte = new Date(filters.renewalTo);
  }
  if (filters.status) {
    switch (filters.status) {
      case "SUSPENDED":
        where.suspended = true;
        break;
      case "TRIAL":
        where.suspended = false;
        where.subscriptionStatus = "trialing";
        break;
      case "PAST_DUE":
        where.suspended = false;
        where.subscriptionStatus = { in: ["past_due", "unpaid"] };
        break;
      case "CANCELLED":
        where.suspended = false;
        where.subscriptionStatus = "canceled";
        break;
      case "ACTIVE":
        where.suspended = false;
        where.subscriptionStatus = { notIn: ["trialing", "past_due", "unpaid", "canceled"] };
        break;
    }
  }
  return where;
}

async function listOrganizations(filters: OrgListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const where = buildOrgWhere(filters);

  const sortBy = filters.sortBy ?? "createdAt";
  const sortDir: "asc" | "desc" = filters.sortDir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.OrganizationOrderByWithRelationInput =
    sortBy === "name"
      ? { name: sortDir }
      : sortBy === "members"
        ? { members: { _count: sortDir } }
        : sortBy === "invoices"
          ? { invoices: { _count: sortDir } }
          : { createdAt: sortDir };

  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        subscriptionStatus: true,
        suspended: true,
        currentPeriodEnd: true,
        createdAt: true,
        _count: { select: { members: true, invoices: true } },
        members: { where: { role: "OWNER" }, take: 1, select: { user: { select: { name: true, email: true } } } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return {
    organizations: rows.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      subscriptionStatus: org.subscriptionStatus,
      suspended: org.suspended,
      currentPeriodEnd: org.currentPeriodEnd,
      createdAt: org.createdAt,
      status: deriveTenantStatus(org),
      owner: org.members[0]?.user ?? null,
      memberCount: org._count.members,
      invoiceCount: org._count.invoices,
    })),
    total,
    page,
    pageSize,
  };
}

// ---------------------------------------------------------------------------
// Per-tenant merged activity feed -- backs the Overview tab's recent-activity
// list and the dedicated Activity tab (with type filter + pagination).
// ---------------------------------------------------------------------------

interface FeedItem {
  id: string;
  type: string;
  label: string;
  amount?: number;
  currency?: string;
  metadata?: unknown;
  timestamp: Date;
}

async function getOrgActivityFeed(organizationId: string, opts: { type?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

  const [invoices, payments, members, auditLogs] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, number: true, total: true, currency: true, createdAt: true, paidAt: true },
    }),
    prisma.payment.findMany({
      where: { invoice: { organizationId } },
      orderBy: { paidAt: "desc" },
      take: 50,
      select: { id: true, amount: true, paidAt: true, type: true, invoice: { select: { number: true, currency: true } } },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, createdAt: true, role: true, user: { select: { name: true } } },
    }),
    // cross_tenant_access is excluded here -- it fires on every single request
    // while an admin browses a tenant via "View as this tenant" and would
    // flood this feed; it's still visible in the platform-wide Activity Logs page.
    prisma.adminAuditLog.findMany({
      where: { targetOrganizationId: organizationId, action: { not: "cross_tenant_access" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const items: FeedItem[] = [];
  for (const inv of invoices) {
    items.push({ id: `invoice-${inv.id}`, type: "invoice_created", label: `Invoice ${inv.number} created`, amount: inv.total.toNumber(), currency: inv.currency, timestamp: inv.createdAt });
    if (inv.paidAt) {
      items.push({ id: `invoice-paid-${inv.id}`, type: "invoice_paid", label: `Invoice ${inv.number} paid in full`, timestamp: inv.paidAt });
    }
  }
  for (const p of payments) {
    const isRefund = p.type === "REFUND";
    items.push({
      id: `payment-${p.id}`,
      type: isRefund ? "refund" : "payment_received",
      label: isRefund ? `Refund issued for invoice ${p.invoice.number}` : `Payment received for invoice ${p.invoice.number}`,
      amount: p.amount.toNumber(),
      currency: p.invoice.currency,
      timestamp: p.paidAt,
    });
  }
  for (const m of members) {
    items.push({ id: `member-${m.id}`, type: "member_joined", label: `${m.user.name} joined as ${m.role.toLowerCase()}`, timestamp: m.createdAt });
  }
  for (const log of auditLogs) {
    items.push({
      id: `audit-${log.id}`,
      type: log.action,
      label: ADMIN_ACTION_LABEL[log.action] ?? log.action,
      metadata: log.metadata,
      timestamp: log.createdAt,
    });
  }

  const filtered = opts.type ? items.filter((i) => i.type === opts.type) : items;
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Platform-wide tenant growth series (dashboard chart).
// ---------------------------------------------------------------------------

function buildGrowthSeries(
  orgs: { createdAt: Date; suspended: boolean; subscriptionStatus: string | null }[],
  period: string
) {
  const now = new Date();

  if (period === "12m") {
    const series = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const newTenants = orgs.filter((o) => o.createdAt >= monthDate && o.createdAt < nextMonthDate).length;
      const activeTenants = orgs.filter((o) => o.createdAt < nextMonthDate && deriveTenantStatus(o) === "ACTIVE").length;
      series.push({ label: monthDate.toLocaleDateString("en-US", { month: "short" }), newTenants, activeTenants });
    }
    return series;
  }

  const bucketDays = period === "3m" ? 7 : 1;
  const bucketCount = period === "7d" ? 7 : period === "3m" ? 13 : 30;
  const series = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * bucketDays + 1);
    const bucketStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + 1) * bucketDays + 1);
    const newTenants = orgs.filter((o) => o.createdAt >= bucketStart && o.createdAt < bucketEnd).length;
    const activeTenants = orgs.filter((o) => o.createdAt < bucketEnd && deriveTenantStatus(o) === "ACTIVE").length;
    series.push({ label: bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }), newTenants, activeTenants });
  }
  return series;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

router.get("/dashboard", requirePlatformRole(), async (req: AuthedRequest, res, next) => {
  try {
    const period = ["7d", "30d", "3m", "12m"].includes(req.query.period as string) ? (req.query.period as string) : "30d";

    const [orgs, totalPlatformUsers] = await Promise.all([
      prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          suspended: true,
          createdAt: true,
          members: { where: { role: "OWNER" }, take: 1, select: { user: { select: { name: true, email: true } } } },
        },
      }),
      prisma.user.count(),
    ]);

    let activeTenants = 0;
    let trialTenants = 0;
    let suspendedTenants = 0;
    let pastDueTenants = 0;
    let mrr = 0;
    const planCounts: Record<string, number> = { STARTER: 0, PROFESSIONAL: 0, BUSINESS: 0 };
    for (const org of orgs) {
      const status = deriveTenantStatus(org);
      if (status === "ACTIVE") activeTenants++;
      else if (status === "TRIAL") trialTenants++;
      else if (status === "SUSPENDED") suspendedTenants++;
      else if (status === "PAST_DUE") pastDueTenants++;
      if (org.subscriptionStatus === "active") mrr += PLANS[org.plan].priceMonthly;
      planCounts[org.plan] = (planCounts[org.plan] ?? 0) + 1;
    }

    const sortedByCreated = [...orgs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const recentTenants = sortedByCreated.slice(0, 8).map((org) => ({
      id: org.id,
      name: org.name,
      plan: org.plan,
      status: deriveTenantStatus(org),
      createdAt: org.createdAt,
      owner: org.members[0]?.user ?? null,
    }));

    const attentionRequired = orgs
      .filter((org) => org.suspended || org.subscriptionStatus === "past_due" || org.subscriptionStatus === "unpaid")
      .slice(0, 10)
      .map((org) => ({
        id: org.id,
        name: org.name,
        status: deriveTenantStatus(org),
        reason: org.suspended ? "Suspended" : "Payment past due",
        owner: org.members[0]?.user ?? null,
      }));

    res.json({
      kpis: { totalTenants: orgs.length, activeTenants, trialTenants, suspendedTenants, pastDueTenants, totalPlatformUsers, mrr },
      tenantGrowth: buildGrowthSeries(orgs, period),
      planDistribution: Object.entries(planCounts).map(([plan, count]) => ({ plan, count })),
      recentTenants,
      attentionRequired,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Tenants (organizations)
// ---------------------------------------------------------------------------

router.get("/organizations", requirePlatformRole(), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const result = await listOrganizations({
      search: q.search,
      status: q.status,
      plan: q.plan,
      joinedFrom: q.joinedFrom,
      joinedTo: q.joinedTo,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/export/organizations.csv", requirePlatformRole("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const { organizations } = await listOrganizations({
      search: q.search,
      status: q.status,
      plan: q.plan,
      joinedFrom: q.joinedFrom,
      joinedTo: q.joinedTo,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
      page: 1,
      pageSize: 1000,
    });

    const columns: { key: string; header: string }[] = [
      { key: "name", header: "Tenant" },
      { key: "slug", header: "Slug" },
      { key: "plan", header: "Plan" },
      { key: "status", header: "Status" },
      { key: "owner", header: "Owner Email" },
      { key: "members", header: "Members" },
      { key: "invoices", header: "Invoices" },
      { key: "joined", header: "Joined" },
    ];
    const rows = organizations.map((org) => ({
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      status: org.status,
      owner: org.owner?.email ?? "",
      members: org.memberCount,
      invoices: org.invoiceCount,
      joined: org.createdAt.toISOString(),
    }));

    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      columns.map((c) => escape(c.header)).join(","),
      ...rows.map((row) => columns.map((c) => escape((row as Record<string, string | number>)[c.key])).join(",")),
    ].join("\r\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="tenants-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get("/organizations/:id", requirePlatformRole(), async (req, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true } } } },
        _count: { select: { invoices: true, customers: true, quotes: true } },
      },
    });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    const [invoiceTotals, invoicesThisMonth, feed] = await Promise.all([
      prisma.invoice.aggregate({ where: { organizationId: organization.id }, _sum: { total: true, amountPaid: true } }),
      prisma.invoice.count({ where: { organizationId: organization.id, createdAt: { gte: startOfCurrentMonth() } } }),
      getOrgActivityFeed(organization.id, { page: 1, pageSize: 10 }),
    ]);

    const owner = organization.members.find((m) => m.role === "OWNER") ?? null;
    const planDef = PLANS[organization.plan];

    res.json({
      ...toApiNumbers(organization),
      status: deriveTenantStatus(organization),
      owner: owner ? { id: owner.user.id, name: owner.user.name, email: owner.user.email, joinedAt: owner.createdAt } : null,
      totalInvoiced: invoiceTotals._sum.total?.toNumber() ?? 0,
      totalCollected: invoiceTotals._sum.amountPaid?.toNumber() ?? 0,
      // What this tenant pays InvoiceFlow -- not to be confused with totalCollected
      // above, which is revenue the tenant has collected from ITS OWN customers.
      monthlyValue: planDef.priceMonthly,
      billingInterval: "Monthly",
      usage: {
        users: { used: organization.members.length, cap: planDef.seatCap },
        invoicesThisMonth: { used: invoicesThisMonth, cap: planDef.invoiceCapPerMonth },
        customers: { used: organization._count.customers, cap: null },
      },
      recentActivity: feed.items,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/organizations/:id/activity", requirePlatformRole(), async (req, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    const feed = await getOrgActivityFeed(organization.id, {
      type: req.query.type as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
    });
    res.json(feed);
  } catch (err) {
    next(err);
  }
});

router.get("/organizations/:id/billing-history", requirePlatformRole(), async (req, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { stripeCustomerId: true } });
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (!organization.stripeCustomerId) return res.json({ invoices: [] });

    const invoices = await requireStripe().invoices.list({ customer: organization.stripeCustomerId, limit: 20 });
    res.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        amount: (inv.amount_paid || inv.amount_due || 0) / 100,
        currency: inv.currency,
        status: inv.status,
        created: new Date(inv.created * 1000),
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) return sendStripeNotConfigured(res);
    next(err);
  }
});

const notifySchema = z.object({ subject: z.string().min(1), message: z.string().min(1) });

router.post("/organizations/:id/notify", requirePlatformRole("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = notifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Subject and message are required" });

    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { members: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (organization.members.length === 0) return res.status(400).json({ error: "This tenant has no members to notify" });

    await prisma.notification.createMany({
      data: organization.members.map((m) => ({
        organizationMemberId: m.id,
        type: "PLATFORM_MESSAGE" as const,
        title: parsed.data.subject,
        message: parsed.data.message,
      })),
    });

    const owner = organization.members.find((m) => m.role === "OWNER") ?? organization.members[0];
    if (owner?.user.email) {
      const email = platformMessageEmail(owner.user.name, parsed.data.subject, parsed.data.message);
      await sendEmail({ to: owner.user.email, ...email }).catch((err) =>
        console.error("[admin] failed to send tenant notification email", err)
      );
    }

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "tenant_notification_sent",
        targetOrganizationId: organization.id,
        metadata: { organizationName: organization.name, subject: parsed.data.subject },
        ...clientMeta(req),
      },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const impersonateSchema = z.object({ reason: z.string().min(3, "Please provide a reason for accessing this tenant.") });

router.post(
  "/organizations/:id/impersonate",
  requirePlatformRole("SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_ADMIN"),
  async (req: AuthedRequest, res, next) => {
    try {
      const parsed = impersonateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "A reason is required" });

      const organization = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
      if (!organization) return res.status(404).json({ error: "Organization not found" });

      await prisma.adminAuditLog.create({
        data: {
          adminUserId: req.userId as string,
          action: "impersonation_started",
          targetOrganizationId: organization.id,
          metadata: { organizationName: organization.name, reason: parsed.data.reason },
          ...clientMeta(req),
        },
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

const suspendSchema = z.object({ reason: z.string().optional() });

router.post("/organizations/:id/suspend", requirePlatformRole("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: { suspended: true, suspendedAt: new Date(), suspendedReason: parsed.data.reason || null },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "suspend_organization",
        targetOrganizationId: organization.id,
        metadata: { organizationName: organization.name, reason: parsed.data.reason },
        ...clientMeta(req),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/organizations/:id/reactivate", requirePlatformRole("SUPER_ADMIN", "PLATFORM_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!organization) return res.status(404).json({ error: "Organization not found" });

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: { suspended: false, suspendedAt: null, suspendedReason: null },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "reactivate_organization",
        targetOrganizationId: organization.id,
        metadata: { organizationName: organization.name },
        ...clientMeta(req),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const deleteSchema = z.object({ confirmName: z.string().min(1) });

router.delete("/organizations/:id", requirePlatformRole("SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = deleteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Type the organization's name to confirm deletion" });

    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { members: { include: { user: { select: { email: true } } } } },
    });
    if (!organization) return res.status(404).json({ error: "Organization not found" });
    if (parsed.data.confirmName !== organization.name) {
      return res.status(400).json({ error: "The name you typed doesn't match this organization's name" });
    }

    // Write the audit log BEFORE deleting -- it's the only record left of the
    // org's existence afterward, so it snapshots the identifying details.
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "delete_organization",
        targetOrganizationId: organization.id,
        metadata: {
          organizationName: organization.name,
          plan: organization.plan,
          memberEmails: organization.members.map((m) => m.user.email),
        },
        ...clientMeta(req),
      },
    });

    // No onDelete cascade exists on Organization's relations (defaults to
    // Restrict), so children are deleted explicitly in dependency order.
    // Explicit timeout: this org can have many rows across several tables,
    // and Prisma's default 5s interactive-transaction timeout is too tight
    // for that many sequential round trips.
    await prisma.$transaction(
      async (tx) => {
        const invoiceIds = (await tx.invoice.findMany({ where: { organizationId: organization.id }, select: { id: true } })).map((i) => i.id);
        const quoteIds = (await tx.quote.findMany({ where: { organizationId: organization.id }, select: { id: true } })).map((q) => q.id);
        const creditNoteIds = (await tx.creditNote.findMany({ where: { organizationId: organization.id }, select: { id: true } })).map((c) => c.id);
        const recurringIds = (await tx.recurringInvoice.findMany({ where: { organizationId: organization.id }, select: { id: true } })).map((r) => r.id);
        const memberIds = organization.members.map((m) => m.id);

        await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.notification.deleteMany({ where: { organizationMemberId: { in: memberIds } } });
        await tx.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
        await tx.creditNoteItem.deleteMany({ where: { creditNoteId: { in: creditNoteIds } } });
        await tx.recurringInvoiceItem.deleteMany({ where: { recurringInvoiceId: { in: recurringIds } } });

        await tx.creditNote.deleteMany({ where: { organizationId: organization.id } });
        await tx.invoice.deleteMany({ where: { organizationId: organization.id } });
        await tx.quote.deleteMany({ where: { organizationId: organization.id } });
        await tx.recurringInvoice.deleteMany({ where: { organizationId: organization.id } });
        await tx.product.deleteMany({ where: { organizationId: organization.id } });
        await tx.customer.deleteMany({ where: { organizationId: organization.id } });
        await tx.organizationMember.deleteMany({ where: { organizationId: organization.id } });
        await tx.organization.delete({ where: { id: organization.id } });
      },
      { timeout: 20000 }
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Platform users
// ---------------------------------------------------------------------------

router.get("/users", requirePlatformRole(), async (req, res, next) => {
  try {
    const { search } = req.query as Record<string, string>;
    const users = await prisma.user.findMany({
      where: search
        ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: { select: { role: true, organization: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get("/users/:id", requirePlatformRole(), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: {
          select: { id: true, role: true, createdAt: true, organization: { select: { id: true, name: true, plan: true, suspended: true } } },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Platform-wide activity log
// ---------------------------------------------------------------------------

type AuditLogRow = Awaited<ReturnType<typeof prisma.adminAuditLog.findMany>>[number];

async function enrichAuditLogs(logs: AuditLogRow[]) {
  const adminIds = [...new Set(logs.map((l) => l.adminUserId))];
  const orgIds = [...new Set(logs.map((l) => l.targetOrganizationId).filter((id): id is string => !!id))];
  const [admins, organizations] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true } }),
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
  ]);
  const adminNames = Object.fromEntries(admins.map((a) => [a.id, `${a.name} (${a.email})`]));
  const orgNames = Object.fromEntries(organizations.map((o) => [o.id, o.name]));
  return logs.map((l) => ({
    ...l,
    adminName: adminNames[l.adminUserId] ?? l.adminUserId,
    actionLabel: ADMIN_ACTION_LABEL[l.action] ?? l.action,
    targetOrganizationName:
      (l.targetOrganizationId && orgNames[l.targetOrganizationId]) ||
      ((l.metadata as Record<string, unknown> | null)?.organizationName as string | undefined) ||
      null,
  }));
}

router.get("/activity", requirePlatformRole(), async (req, res, next) => {
  try {
    const { action, adminUserId, dateFrom, dateTo, search } = req.query as Record<string, string>;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));

    const where: Prisma.AdminAuditLogWhereInput = {};
    if (action) where.action = action;
    if (adminUserId) where.adminUserId = adminUserId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      // Search targets the joined admin/org names, which don't exist as DB
      // columns -- pull a bounded candidate set, enrich, then filter+paginate in JS.
      const candidates = await prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
      const enriched = await enrichAuditLogs(candidates);
      const s = search.toLowerCase();
      const filtered = enriched.filter(
        (l) => l.adminName.toLowerCase().includes(s) || (l.targetOrganizationName ?? "").toLowerCase().includes(s)
      );
      return res.json({ logs: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize });
    }

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.adminAuditLog.count({ where }),
    ]);
    res.json({ logs: await enrichAuditLogs(logs), total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Plans (read-only) & Subscriptions
// ---------------------------------------------------------------------------

router.get("/plans", requirePlatformRole(), async (_req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

router.get("/subscriptions", requirePlatformRole(), async (req, res, next) => {
  try {
    const q = req.query as Record<string, string>;
    const result = await listOrganizations({
      search: q.search,
      status: q.status,
      plan: q.plan,
      renewalFrom: q.renewalFrom,
      renewalTo: q.renewalTo,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    });
    res.json({
      subscriptions: result.organizations.map((org) => ({ ...org, amount: PLANS[org.plan].priceMonthly, billingInterval: "Monthly" })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Administrators (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

router.get("/administrators", requirePlatformRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const administrators = await prisma.user.findMany({
      where: { platformRole: { not: null } },
      select: { id: true, name: true, email: true, platformRole: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ administrators });
  } catch (err) {
    next(err);
  }
});

async function rejectIfLastSuperAdmin(userId: string, newRole: PlatformRole | null): Promise<boolean> {
  if (newRole === "SUPER_ADMIN") return false;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (target?.platformRole !== "SUPER_ADMIN") return false;
  const superAdminCount = await prisma.user.count({ where: { platformRole: "SUPER_ADMIN" } });
  return superAdminCount <= 1;
}

const grantAdminSchema = z.object({ email: z.string().email(), platformRole: z.enum(["SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_ADMIN"]) });

router.post("/administrators", requirePlatformRole("SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = grantAdminSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) {
      return res.status(404).json({ error: "No InvoiceFlow account exists with that email yet. They need to register first." });
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data: { platformRole: parsed.data.platformRole } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "admin_role_granted",
        targetUserId: updated.id,
        metadata: { email: updated.email, role: parsed.data.platformRole },
        ...clientMeta(req),
      },
    });
    res.status(201).json({ id: updated.id, name: updated.name, email: updated.email, platformRole: updated.platformRole });
  } catch (err) {
    next(err);
  }
});

const changeRoleSchema = z.object({ platformRole: z.enum(["SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_ADMIN"]) });

router.patch("/administrators/:id", requirePlatformRole("SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = changeRoleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A valid platform role is required" });

    if (await rejectIfLastSuperAdmin(req.params.id, parsed.data.platformRole)) {
      return res.status(400).json({ error: "You can't remove the last remaining Super Admin." });
    }

    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { platformRole: parsed.data.platformRole } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "admin_role_changed",
        targetUserId: updated.id,
        metadata: { email: updated.email, newRole: parsed.data.platformRole },
        ...clientMeta(req),
      },
    });
    res.json({ id: updated.id, name: updated.name, email: updated.email, platformRole: updated.platformRole });
  } catch (err) {
    next(err);
  }
});

router.delete("/administrators/:id", requirePlatformRole("SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    if (await rejectIfLastSuperAdmin(req.params.id, null)) {
      return res.status(400).json({ error: "You can't remove the last remaining Super Admin." });
    }

    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { platformRole: null } });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: req.userId as string,
        action: "admin_role_revoked",
        targetUserId: updated.id,
        metadata: { email: updated.email },
        ...clientMeta(req),
      },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Platform settings (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

router.get("/settings", requirePlatformRole("SUPER_ADMIN"), async (_req, res, next) => {
  try {
    const settings = await prisma.platformSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({
  registrationEnabled: z.boolean().optional(),
  platformName: z.string().min(1).optional(),
  supportEmail: z.string().email().optional().nullable(),
});

router.patch("/settings", requirePlatformRole("SUPER_ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });

    const updated = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    await prisma.adminAuditLog.create({
      data: { adminUserId: req.userId as string, action: "platform_settings_updated", metadata: parsed.data, ...clientMeta(req) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
