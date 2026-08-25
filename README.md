# InvoiceFlow

InvoiceFlow is a multi-tenant SaaS invoicing platform for freelancers, consultants,
and small businesses. Create branded, professional invoices for services and
goods, track customers, manage a product/service catalog, record payments, and
see revenue at a glance from a single dashboard.

> This replaces the earlier single-tenant `ServicePilot` skeleton, which has been
> archived unchanged at `legacy-servicepilot-v1/` for reference.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma ORM + PostgreSQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4 + Radix UI primitives
  (a small hand-built component set in the shadcn/ui style) + TanStack Query +
  React Router + Recharts + Lucide icons
- **Auth**: Email/password with bcrypt hashing, JWT (7-day expiry). The active
  organization is sent as an `X-Organization-Id` header on every request and
  verified against real membership server-side on every call.
- **PDFs**: PDFKit, rendered in a worker thread with a hard timeout so a
  malformed logo image can't hang the server for other tenants (see
  `backend/src/modules/invoices/renderInvoicePdf.ts`)
- **Multi-tenancy**: every business record (customers, products, invoices,
  payments) hangs off an `Organization`, never a `User` directly. A `User` can
  belong to multiple organizations via `OrganizationMember`, each with a role
  (Owner / Admin / Accountant / Member).

Plain TypeScript throughout on both ends — no separate validation DSL beyond
Zod on the backend and native HTML form state on the frontend.

## Folder structure

```
servicepilot/
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.ts
│       ├── lib/{db,slug}.ts
│       ├── middleware/auth.ts        # requireAuth, requireOrgMember, requireRole
│       └── modules/
│           ├── auth/                 # register, login, /me
│           ├── organizations/        # org settings, team management
│           ├── customers/
│           ├── products/
│           ├── invoices/             # CRUD, status, payments, PDF, public share link
│           ├── payments/
│           └── dashboard/            # KPI + revenue/status aggregation
└── frontend/
    └── src/
        ├── components/
        │   ├── ui/                   # Button, Card, Badge, Dialog, Select, Table, ...
        │   ├── layout/                # Sidebar, Topbar, AppLayout
        │   ├── dashboard/             # KpiCard, RevenueChart, StatusDonut
        │   ├── invoices/InvoicePreview.tsx
        │   └── customers/NewCustomerDialog.tsx
        ├── context/{AuthContext,ThemeContext}.tsx
        ├── hooks/                    # one file per resource, TanStack Query
        ├── pages/
        │   ├── marketing/Home.tsx
        │   ├── auth/{Login,Register}.tsx
        │   ├── PublicInvoice.tsx      # no-login client-facing invoice view
        │   └── app/                  # Dashboard, Invoices, InvoiceForm, InvoiceDetail,
        │                             # Customers, CustomerDetail, Products, Payments,
        │                             # SettingsCompany, SettingsTeam, SettingsBilling
        └── types.ts
```

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL (Postgres) and a real JWT_SECRET
npx prisma migrate dev --name init
npm run dev             # http://localhost:4000, via nodemon + tsx
```

`DATABASE_URL` must point at a real PostgreSQL instance — a free one from
[neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) works
fine for development; no local Postgres/Docker install is required.

**Why `nodemon` and not `node --watch`**: PDF generation runs in a worker
thread so a corrupt logo image can only stall that one request. Node's
built-in `--watch` mode breaks `worker_threads` outright (workers fail
instantly rather than running) — `nodemon` spawns a genuinely separate process
per restart and doesn't have that problem.

Verify with `GET http://localhost:4000/health` → `{ "status": "ok" }`.

**Breaking change (2026-08-25)**: every monetary column (`Invoice.total`,
`Payment.amount`, etc.) was migrated from `Float` to `Decimal(14,2)` to
eliminate binary floating-point rounding error in tax/discount math. If you
have an existing local database, run `npx prisma migrate deploy` to pick up
migration `20260825090405_convert_money_fields_to_decimal` — it's a lossless
in-place cast, no data is lost. The API still returns plain JSON numbers (not
strings) for money fields; conversion happens server-side via
`backend/src/lib/serialize.ts`.

### Running tests

The backend has a Vitest suite (`invoice-math`, multi-tenant isolation, Stripe
webhook idempotency). It needs its own **disposable** database — never point
it at the same `DATABASE_URL` as `.env`, since tests create and delete real
rows.

```bash
cd backend
# 1. Provision a separate database -- e.g. a second Neon branch/project.
cp .env.test.example .env.test   # fill in the disposable DATABASE_URL
npx prisma migrate deploy         # apply the schema to it (reads .env.test)
npm test
```

`src/test/setup.ts` loads `.env.test` before anything else and fails loudly
if `DATABASE_URL` isn't set from it, specifically to prevent a missing
`.env.test` from silently falling back to your real dev database.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

## What's implemented

- Marketing landing page (hero, features, how-it-works, pricing, final CTA),
  light/dark/system theme support throughout the whole app
- Registration creates a `User` + `Organization` + `OrganizationMember` (Owner)
  together; login returns every organization the user belongs to
- Organization switcher, team management (invite by email, change role, remove
  — with a guard against removing the last Owner)
- Customers, and a Products & Services catalog (services and physical goods)
  that can be dropped straight into an invoice line item
- Invoice creation with a live split-screen preview: per-line tax rate and
  discount, auto-generated invoice numbers (`INV-2026-0001`), server-computed
  totals
- Invoice lifecycle: draft → send → (client opens the link → auto-marked
  viewed) → paid/overdue/cancelled; duplicate; partial and full payment
  recording with running balance-due
- Branded PDF generation and a no-login shareable client link
  (`/i/:publicToken`) that mirrors the PDF layout
- Dashboard: revenue/outstanding/overdue/paid-this-month KPIs, a 12-month
  revenue chart and invoice-status donut (both driven by actual `Payment`
  records, so partial payments show up in the month they were received), and
  a recent-invoices table
- Every query and mutation is scoped through `requireOrgMember`, which
  verifies real membership server-side — a user can never read or write
  another organization's data by guessing an ID or forging a header
- CSV export for invoices (respects the current status/search filter),
  customers, and payments (`GET /api/{invoices,customers,payments}/export.csv`)
- No-login client portal per customer (`/portal/:portalToken`, "Copy portal
  link" on the customer page) listing all their non-draft invoices and quotes
  in one place
- Configurable late fees (flat $ or %, with a grace period) auto-applied as a
  line item once an invoice has been overdue past the grace period, checked
  hourly alongside the existing overdue-status scheduler
- Optional deposit (flat $ or %) on an invoice — the public payment page
  defaults to "pay deposit" instead of full balance until it's been paid
- Outbound developer API: revocable `X-Api-Key` keys (one-time reveal on
  creation) authenticate a v1 REST API (`/api/v1/{customers,invoices}`,
  read + create); outbound webhooks (`invoice.sent`, `invoice.paid`,
  `quote.accepted`) delivered with a Stripe-style HMAC-SHA256 signature
  header, managed from Settings → Developer
- Two invoice/quote PDF templates ("Classic" and "Modern"), switchable per
  organization from Settings → Company; the live split-screen preview
  matches the PDF layout for whichever template is active
- Time tracking: log billable hours per customer, then pull unbilled entries
  straight into an invoice as priced line items with one click (entries are
  locked once billed and unlinked, not un-billed, if that invoice is later
  edited)
- Expense tracking: log business costs (optionally tied to a customer and
  marked billable), then pull unbilled billable expenses into an invoice the
  same one-click way as time entries; non-billable expenses (no customer
  required) are for internal cost tracking only

## Next steps

- Quotes/estimates and converting an accepted quote into an invoice
- Recurring invoices and automated payment reminders
- In-app notifications (invoice viewed/paid, quote accepted, etc.)
- Real payment collection on the public client-facing invoice page (Stripe/etc
  checkout — it's currently a read-only "view and download" page)
- Stripe Billing for InvoiceFlow's own subscription plans (the pricing page
  and Billing settings tab are UI-only right now)
- Reports/analytics beyond the dashboard (per-customer and per-product
  revenue breakdowns)
- SSO/SAML (Phase 2.1 — deferred; recommended approach is a drop-in provider
  like WorkOS rather than hand-rolled SAML, needs an external account)
- Tax compliance beyond a flat rate (Phase 2.3 — deferred; recommended
  approach is Stripe Tax on the existing checkout flow, needs Stripe Tax
  enabled on the account)
- File storage abstraction (S3/R2/Supabase) for logos and PDFs instead of
  inline data URLs and on-the-fly generation
- Email delivery abstraction (Resend/SendGrid/SES) for actually sending
  invoices and reminders
