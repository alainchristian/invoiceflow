import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

router.get("/summary", async (req: AuthedRequest, res, next) => {
  try {
    const organizationId = req.organizationId as string;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const [allInvoices, allPayments, recentInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: { organizationId },
        select: {
          id: true,
          total: true,
          amountPaid: true,
          status: true,
          createdAt: true,
          dueDate: true,
        },
      }),
      // Monthly revenue is driven by actual Payment records (not "invoice
      // reached PAID status"), so a partial payment shows up in the month
      // it was actually received rather than being invisible until the
      // invoice is fully settled.
      prisma.payment.findMany({
        where: { invoice: { organizationId } },
        select: { amount: true, paidAt: true },
      }),
      prisma.invoice.findMany({
        where: { organizationId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    const totalRevenue = allInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const outstanding = allInvoices
      .filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED")
      .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);
    const overdue = allInvoices
      .filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED" && inv.dueDate < now)
      .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);
    const paidThisMonth = allPayments
      .filter((p) => p.paidAt >= monthStart)
      .reduce((sum, p) => sum + p.amount, 0);
    const paidLastMonth = allPayments
      .filter((p) => p.paidAt >= prevMonthStart && p.paidAt < monthStart)
      .reduce((sum, p) => sum + p.amount, 0);

    const statusCounts: Record<string, number> = {};
    for (const inv of allInvoices) {
      statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
    }

    // Last 12 months of revenue actually collected, oldest first.
    const months: { label: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const revenue = allPayments
        .filter((p) => p.paidAt >= monthDate && p.paidAt < nextMonthDate)
        .reduce((sum, p) => sum + p.amount, 0);
      months.push({ label: monthDate.toLocaleDateString("en-US", { month: "short" }), revenue });
    }

    res.json({
      totalRevenue,
      outstanding,
      overdue,
      paidThisMonth,
      paidLastMonth,
      unpaidCount: allInvoices.filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED").length,
      statusCounts,
      revenueByMonth: months,
      recentInvoices,
    });
  } catch (err) {
    next(err);
  }
});

// Professional+ feature -- closes the "Advanced analytics" gap flagged during the
// billing work (that marketing-promised feature had nothing behind it before this).
router.get("/analytics", async (req: AuthedRequest, res, next) => {
  try {
    const organizationId = req.organizationId as string;
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true },
    });
    if (organization.plan === "STARTER") {
      return res.status(403).json({ error: "Analytics is available on the Professional plan and above. Upgrade to unlock it." });
    }

    const now = new Date();

    const [revenueByCustomerRows, customers, itemsByDescription, quotes] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["customerId"],
        where: { organizationId },
        _sum: { amountPaid: true },
      }),
      prisma.customer.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      prisma.invoiceItem.findMany({
        where: { invoice: { organizationId } },
        select: { description: true, total: true },
      }),
      prisma.quote.findMany({
        where: { organizationId },
        select: { status: true, createdAt: true },
      }),
    ]);

    const customerNames = new Map(customers.map((c) => [c.id, c.name]));
    const topCustomers = revenueByCustomerRows
      .map((row) => ({
        customerId: row.customerId,
        name: customerNames.get(row.customerId) ?? "Unknown customer",
        revenue: row._sum.amountPaid ?? 0,
      }))
      .filter((row) => row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Grouped by line-item description as a best-effort stand-in for a real
    // product breakdown -- line items aren't linked to a Product by ID yet.
    const revenueByProductMap = new Map<string, number>();
    for (const item of itemsByDescription) {
      revenueByProductMap.set(item.description, (revenueByProductMap.get(item.description) ?? 0) + item.total);
    }
    const revenueByProduct = Array.from(revenueByProductMap.entries())
      .map(([description, revenue]) => ({ description, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Last 12 months of quote conversion rate, oldest first.
    const quoteConversionByMonth: { label: string; total: number; converted: number; rate: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthQuotes = quotes.filter((q) => q.createdAt >= monthDate && q.createdAt < nextMonthDate);
      const converted = monthQuotes.filter((q) => q.status === "CONVERTED").length;
      quoteConversionByMonth.push({
        label: monthDate.toLocaleDateString("en-US", { month: "short" }),
        total: monthQuotes.length,
        converted,
        rate: monthQuotes.length > 0 ? Math.round((converted / monthQuotes.length) * 100) : 0,
      });
    }

    res.json({ topCustomers, revenueByProduct, quoteConversionByMonth });
  } catch (err) {
    next(err);
  }
});

export default router;
