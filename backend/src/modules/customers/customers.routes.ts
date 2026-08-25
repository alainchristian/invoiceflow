import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { toApiNumbers } from "../../lib/serialize.js";
import { toCsv, sendCsv } from "../../lib/csv.js";

const router = Router();
const publicRouter = Router();
router.use(requireAuth, requireOrgMember);

// Shared by GET / and GET /export.csv so the totalInvoiced/outstanding
// aggregation logic isn't duplicated between the two.
async function getCustomersWithTotals(organizationId: string) {
  const customers = await prisma.customer.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  const invoiceAggregates: { customerId: string; status: string; _sum: { total: number | null; amountPaid: number | null } }[] =
    toApiNumbers(
      await prisma.invoice.groupBy({
        by: ["customerId", "status"],
        where: { organizationId },
        _sum: { total: true, amountPaid: true },
      })
    );

  const summaryByCustomer = new Map<string, { totalInvoiced: number; outstanding: number }>();
  for (const row of invoiceAggregates) {
    const entry = summaryByCustomer.get(row.customerId) ?? { totalInvoiced: 0, outstanding: 0 };
    entry.totalInvoiced += row._sum.total ?? 0;
    if (row.status !== "PAID" && row.status !== "CANCELLED") {
      entry.outstanding += (row._sum.total ?? 0) - (row._sum.amountPaid ?? 0);
    }
    summaryByCustomer.set(row.customerId, entry);
  }

  return customers.map((c) => ({
    ...c,
    totalInvoiced: summaryByCustomer.get(c.id)?.totalInvoiced ?? 0,
    outstanding: summaryByCustomer.get(c.id)?.outstanding ?? 0,
  }));
}

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getCustomersWithTotals(req.organizationId as string));
  } catch (err) {
    next(err);
  }
});

// Must be registered before GET /:id -- otherwise Express matches
// "export.csv" as the :id param and this route is never reached.
router.get("/export.csv", async (req: AuthedRequest, res, next) => {
  try {
    const customers = await getCustomersWithTotals(req.organizationId as string);
    const csv = toCsv(
      [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
        { key: "phone", header: "Phone" },
        { key: "company", header: "Company" },
        { key: "totalInvoiced", header: "Total Invoiced" },
        { key: "outstanding", header: "Outstanding" },
        { key: "created", header: "Created" },
      ],
      customers.map((c) => ({
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        company: c.company ?? "",
        totalInvoiced: c.totalInvoiced,
        outstanding: c.outstanding,
        created: c.createdAt.toISOString().slice(0, 10),
      }))
    );
    sendCsv(res, "customers", csv);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: {
        invoices: { include: { payments: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(toApiNumbers(customer));
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "name is required" });

    const customer = await prisma.customer.create({
      data: { ...parsed.data, organizationId: req.organizationId as string },
    });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Customer not found" });

    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const customer = await prisma.customer.update({ where: { id: existing.id }, data: parsed.data });
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Customer not found" });

    await prisma.customer.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Unauthenticated route for the client-facing multi-invoice portal link.
// DRAFT invoices/quotes are deliberately excluded -- they haven't been sent
// yet, so they must never appear on a customer-facing surface (same
// principle already applied to the automated customer-statement emails).
publicRouter.get("/:portalToken", async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { portalToken: req.params.portalToken },
      include: {
        organization: { select: { name: true, logoUrl: true, brandColor: true } },
        invoices: {
          where: { status: { not: "DRAFT" } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
            currency: true,
            total: true,
            amountPaid: true,
            dueDate: true,
            issueDate: true,
            publicToken: true,
          },
        },
        quotes: {
          where: { status: { not: "DRAFT" } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
            currency: true,
            total: true,
            expiryDate: true,
            issueDate: true,
            publicToken: true,
          },
        },
      },
    });
    if (!customer) return res.status(404).json({ error: "Portal link not found" });
    res.json(toApiNumbers(customer));
  } catch (err) {
    next(err);
  }
});

export default router;
export { publicRouter };
