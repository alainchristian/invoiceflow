# ServicePilot

ServicePilot is a client and invoice management tool for freelance consultants
and small service agencies. It replaces juggling separate tools for proposals,
invoicing, and client tracking with one app: manage clients, track projects
and tasks per client, send proposals, and issue polished, branded invoices with
Stripe-backed payment collection.

## Stack

- **Backend**: Node.js (ESM) + Express + Prisma ORM + SQLite for dev
- **Frontend**: React (Vite) + React Router v6 + Tailwind CSS v4 + Axios
- **Auth**: Email/password with bcrypt hashing, JWT (7-day expiry) stored in `localStorage`
- **PDFs**: PDFKit, rendered in a worker thread with a hard timeout so a
  malformed logo image can't hang the server for other tenants
- **Payments**: Stripe PaymentIntents — a real integration when `STRIPE_SECRET_KEY`
  is configured, falling back to a simulated response (matching Stripe's shape)
  when it isn't, so the frontend integration path never has to change

Plain JavaScript throughout — no TypeScript.

## Folder structure

```
servicepilot/
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.js
│       ├── db.js
│       ├── pdf.js                 # PDF layout (runs inside pdfWorker.js)
│       ├── pdfWorker.js
│       ├── renderInvoicePdf.js    # worker-thread wrapper with a timeout
│       ├── middleware/auth.js
│       └── routes/{auth,clients,projects,proposals,invoices,settings}.js
└── frontend/
    └── src/
        ├── api.js
        ├── App.jsx
        ├── context/AuthContext.jsx
        ├── components/{Layout,ProtectedRoute}.jsx
        └── pages/{Login,Register,Dashboard,Clients,ClientDetail,Proposals,Invoices,Settings,PublicInvoice}.jsx
```

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in a real JWT_SECRET
npx prisma generate
npx prisma migrate dev --name init
npm run dev             # starts on http://localhost:4000
```

Verify with `GET http://localhost:4000/health` → `{ "status": "ok" }`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev              # starts on http://localhost:5173
```

## What's implemented

- Registration/login with hashed passwords and JWT auth
- Full client CRUD, all scoped to the logged-in user (`ownerId`)
- Projects and tasks nested under a client, with status/completion toggles
- Proposals with a draft → sent → signed/declined lifecycle
- Invoices with line items, tax rate, flat discount, and notes/payment terms,
  server-computed totals, a draft → sent → paid / overdue lifecycle, and a
  "collect payment" action that creates a Stripe PaymentIntent (or a simulated
  one without a Stripe key)
- A business profile (logo, brand color, name, address, phone) used to brand
  every invoice — set it under Settings
- Branded PDF invoice generation (`GET /api/invoices/:id/pdf`), rendered off
  the main thread with a timeout so a corrupt logo can't hang the server
- A no-login, shareable "client view" link per invoice (`/invoices/public/:token`)
  with its own PDF download, for sending straight to a client
- A dashboard with client/proposal/invoice counts and outstanding balance
- Every mutation is scoped to the authenticated user, directly or through the
  owning client/project, so one user's data is never visible or editable by another

## Next steps

- Stripe Checkout UI on the frontend to actually confirm PaymentIntents
- Real payment collection on the public client-facing invoice page (it's
  currently read-only — "pay now" isn't wired up there yet)
- Stripe Billing for ServicePilot's own subscription revenue (distinct from
  the client-facing invoice payments above)
- Move from SQLite to Postgres for production (a one-line `provider` change
  in `schema.prisma` — no other code changes needed)
- Multiple invoice PDF templates/themes beyond the single default layout
- Transactional email for proposal delivery and payment reminders
- Multi-tenancy is already handled throughout via `ownerId` scoping on every
  query and mutation — no additional isolation work needed as features are added
