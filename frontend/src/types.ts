export type InvoiceStatus = "DRAFT" | "SENT" | "VIEWED" | "PAID" | "OVERDUE" | "CANCELLED";
export type ProductType = "PRODUCT" | "SERVICE";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CARD" | "MOBILE_MONEY" | "OTHER";
export type MemberRole = "OWNER" | "ADMIN" | "ACCOUNTANT" | "MEMBER";
export type QuoteStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED";
export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export type RecurringStatus = "ACTIVE" | "PAUSED" | "ENDED";
export type NotificationType = "INVOICE_OVERDUE";
export type InvoiceDiscountType = "FLAT" | "PERCENT";
export type CreditNoteStatus = "DRAFT" | "ISSUED" | "VOID";
export type PaymentType = "PAYMENT" | "REFUND";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  invoiceId?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  portalToken: string;
  createdAt: string;
  totalInvoiced?: number;
  outstanding?: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  type: ProductType;
  defaultPrice: number;
  taxRate: number;
  sku?: string | null;
  active: boolean;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

export interface Payment {
  id: string;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  paidAt: string;
  notes?: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  invoiceDiscountType: InvoiceDiscountType;
  invoiceDiscountValue: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  depositAmount?: number | null;
  poNumber?: string | null;
  notes?: string | null;
  terms?: string | null;
  publicToken: string;
  viewedAt?: string | null;
  paidAt?: string | null;
  lastReminderSentAt?: string | null;
  createdAt: string;
  customer: Customer;
  items: InvoiceItem[];
  payments?: Payment[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  invoicePrefix?: string | null;
  quotePrefix?: string | null;
  defaultCurrency?: string | null;
  defaultTaxRate?: number;
  defaultPaymentTerms?: string | null;
  defaultNotes?: string | null;
  pdfTemplate?: "classic" | "modern";
  statementsEnabled: boolean;
  statementFrequencyDays: number;
  statementRecipients: "ALL" | "OVERDUE_ONLY";
  nextStatementRunAt?: string | null;
  lateFeeEnabled: boolean;
  lateFeeType: "FLAT" | "PERCENT";
  lateFeeValue: number;
  lateFeeGraceDays: number;
  plan: "STARTER" | "PROFESSIONAL" | "BUSINESS";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

export interface Quote {
  id: string;
  number: string;
  issueDate: string;
  expiryDate?: string | null;
  currency: string;
  status: QuoteStatus;
  subtotal: number;
  discount: number;
  invoiceDiscountType: InvoiceDiscountType;
  invoiceDiscountValue: number;
  taxTotal: number;
  total: number;
  poNumber?: string | null;
  notes?: string | null;
  terms?: string | null;
  publicToken: string;
  viewedAt?: string | null;
  respondedAt?: string | null;
  convertedInvoiceId?: string | null;
  createdAt: string;
  customer: Customer;
  items: QuoteItem[];
}

export interface RecurringInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

export interface RecurringInvoice {
  id: string;
  frequency: RecurringFrequency;
  status: RecurringStatus;
  currency: string;
  dueInDays: number;
  generateAsDraft: boolean;
  notes?: string | null;
  terms?: string | null;
  startDate: string;
  nextRunDate: string;
  endDate?: string | null;
  lastRunAt?: string | null;
  createdAt: string;
  customer: Customer;
  items: RecurringInvoiceItem[];
}

export interface CreditNoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

export interface CreditNote {
  id: string;
  number: string;
  issueDate: string;
  currency: string;
  status: CreditNoteStatus;
  reason?: string | null;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  notes?: string | null;
  createdAt: string;
  customer: Customer;
  items: CreditNoteItem[];
  invoice?: { id: string; number: string } | null;
}

export interface Member {
  id: string;
  role: MemberRole;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface DashboardSummary {
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  paidThisMonth: number;
  paidLastMonth: number;
  unpaidCount: number;
  statusCounts: Record<string, number>;
  revenueByMonth: { label: string; revenue: number }[];
  recentInvoices: Invoice[];
}

export interface AnalyticsSummary {
  topCustomers: { customerId: string; name: string; revenue: number }[];
  revenueByProduct: { description: string; revenue: number }[];
  quoteConversionByMonth: { label: string; total: number; converted: number; rate: number }[];
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export const WEBHOOK_EVENTS = ["invoice.sent", "invoice.paid", "quote.accepted"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  subscribedEvents: string[];
  active: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  description: string;
  minutes: number;
  hourlyRate: number;
  billed: boolean;
  occurredAt: string;
  createdAt: string;
  customerId: string;
  customer: { id: string; name: string };
  invoiceItemId?: string | null;
}
