import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { prisma } from "../lib/db.js";

const app = createApp();

async function makeOrgWithUser(label: string) {
  const org = await prisma.organization.create({
    data: { name: `${label} Org`, slug: `${label.toLowerCase()}-org-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  });
  // platformRole intentionally left unset (defaults to null) -- requireOrgMember
  // has a platform-admin fallback that would otherwise grant cross-org access
  // and invalidate this test.
  const user = await prisma.user.create({
    data: { email: `${label.toLowerCase()}-${Date.now()}@test.local`, passwordHash: "unused", name: `${label} User` },
  });
  await prisma.organizationMember.create({ data: { userId: user.id, organizationId: org.id, role: "OWNER" } });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
  return { org, user, token };
}

describe("tenant isolation", () => {
  let orgA: Awaited<ReturnType<typeof makeOrgWithUser>>;
  let orgB: Awaited<ReturnType<typeof makeOrgWithUser>>;
  let customerA: { id: string };
  let customerB: { id: string };
  let invoiceB: { id: string };
  let timeEntryB: { id: string };

  beforeAll(async () => {
    orgA = await makeOrgWithUser("TenantIsoA");
    orgB = await makeOrgWithUser("TenantIsoB");
    customerA = await prisma.customer.create({ data: { name: "Customer A", organizationId: orgA.org.id } });
    customerB = await prisma.customer.create({ data: { name: "Customer B", organizationId: orgB.org.id } });
    invoiceB = await prisma.invoice.create({
      data: {
        organizationId: orgB.org.id,
        customerId: customerB.id,
        number: "TEST-B-0001",
        dueDate: new Date(),
        subtotal: 100,
        total: 100,
      },
    });
    timeEntryB = await prisma.timeEntry.create({
      data: {
        organizationId: orgB.org.id,
        customerId: customerB.id,
        description: "Org B's unbilled time",
        minutes: 60,
        hourlyRate: 50,
        occurredAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.timeEntry.deleteMany({ where: { organizationId: { in: [orgA.org.id, orgB.org.id] } } });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgA.org.id, orgB.org.id] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgA.org.id, orgB.org.id] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgA.org.id, orgB.org.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [orgA.user.id, orgB.user.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.org.id, orgB.org.id] } } });
  });

  it("returns 404 (not the record) when Org A requests an invoice belonging to Org B", async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceB.id}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .set("X-Organization-Id", orgA.org.id);
    expect(res.status).toBe(404);
  });

  it("positive control: Org B can fetch its own invoice", async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceB.id}`)
      .set("Authorization", `Bearer ${orgB.token}`)
      .set("X-Organization-Id", orgB.org.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(invoiceB.id);
  });

  it("rejects creating an invoice for Org A that references a customer belonging to Org B", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .set("X-Organization-Id", orgA.org.id)
      .send({
        customerId: customerB.id,
        dueDate: new Date().toISOString(),
        items: [{ description: "x", quantity: 1, unitPrice: 10 }],
      });
    expect(res.status).toBe(404);
  });

  it("rejects a request with no X-Organization-Id membership for that user (not a member, not platform staff)", async () => {
    const res = await request(app)
      .get(`/api/invoices/${invoiceB.id}`)
      .set("Authorization", `Bearer ${orgA.token}`)
      .set("X-Organization-Id", orgB.org.id);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("You are not a member of this organization");
  });

  it("does not bill Org B's time entry when Org A's invoice-create request references its id", async () => {
    // Org A creates a fully valid invoice for its own customer, but supplies
    // Org B's timeEntryId on the line item -- linkBilledTimeEntries' updateMany
    // is scoped by organizationId, so this must silently no-op rather than
    // billing (or worse, re-parenting) another tenant's time entry.
    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${orgA.token}`)
      .set("X-Organization-Id", orgA.org.id)
      .send({
        customerId: customerA.id,
        dueDate: new Date().toISOString(),
        items: [{ description: "Consulting", quantity: 1, unitPrice: 60, timeEntryId: timeEntryB.id }],
      });
    expect(res.status).toBe(201);

    const stillOrgBs = await prisma.timeEntry.findUnique({ where: { id: timeEntryB.id } });
    expect(stillOrgBs?.billed).toBe(false);
    expect(stillOrgBs?.invoiceItemId).toBeNull();
  });

  it("bills a time entry and computes the correct line-item total when the owning org invoices it", async () => {
    const ownEntry = await prisma.timeEntry.create({
      data: {
        organizationId: orgB.org.id,
        customerId: customerB.id,
        description: "Design work",
        minutes: 90,
        hourlyRate: 80,
        occurredAt: new Date(),
      },
    });

    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${orgB.token}`)
      .set("X-Organization-Id", orgB.org.id)
      .send({
        customerId: customerB.id,
        dueDate: new Date().toISOString(),
        items: [{ description: ownEntry.description, quantity: 1.5, unitPrice: 80, timeEntryId: ownEntry.id }],
      });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(120);

    const updated = await prisma.timeEntry.findUnique({ where: { id: ownEntry.id } });
    expect(updated?.billed).toBe(true);
    expect(updated?.invoiceItemId).toBe(res.body.items[0].id);

    await prisma.timeEntry.delete({ where: { id: ownEntry.id } });
  });
});
