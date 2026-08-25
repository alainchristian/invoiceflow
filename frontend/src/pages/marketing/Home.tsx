import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  PlayCircle,
  Zap,
  Repeat,
  TrendingUp,
  Receipt,
  BarChart3,
  ShieldCheck,
  Globe2,
  Check,
  Moon,
  Sun,
  Quote,
  Lock,
  Menu,
  X,
  Clock,
  Search,
  FileWarning,
  AlarmClock,
  Users,
  LineChart,
  Mail,
  Palette,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Accordion } from "@/components/ui/Accordion";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/components/ui/Toast";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { InvoiceBuilderPreview } from "@/components/marketing/InvoiceBuilderPreview";
import { PaymentTrackingPreview } from "@/components/marketing/PaymentTrackingPreview";
import { CustomerProfilePreview } from "@/components/marketing/CustomerProfilePreview";
import { Reveal } from "@/components/marketing/Reveal";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { useSeo, SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/hooks/useSeo";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const trustPoints = [
  { icon: Zap, label: "Professional invoices" },
  { icon: TrendingUp, label: "Smart payment tracking" },
  { icon: Users, label: "Customer management" },
  { icon: BarChart3, label: "Business insights" },
  { icon: ShieldCheck, label: "Secure & reliable" },
];

const painPoints = [
  { icon: Clock, title: "Time consuming", description: "Creating invoices manually takes too much time." },
  { icon: Search, title: "Hard to track", description: "Difficult to know who has paid and who still owes you." },
  { icon: FileWarning, title: "Unprofessional", description: "Word or Excel templates don't create the right impression." },
  { icon: AlarmClock, title: "Late payments", description: "Chasing customers for unpaid invoices is frustrating." },
  { icon: LineChart, title: "No insights", description: "Hard to understand your business performance." },
];

const features = [
  { icon: Zap, title: "Professional invoices", description: "Beautiful templates that make you look professional." },
  { icon: Repeat, title: "Recurring invoices", description: "Automate regular billing and send invoices on autopilot." },
  { icon: AlarmClock, title: "Payment reminders", description: "Send automated reminders and get paid faster." },
  { icon: Globe2, title: "Multiple currencies", description: "Invoice in different currencies and get paid globally." },
  { icon: ShieldCheck, title: "Secure & reliable", description: "Your data is safe with enterprise-grade security." },
  { icon: BarChart3, title: "Reports & insights", description: "Understand your business with powerful reports." },
  { icon: Receipt, title: "Credit notes & refunds", description: "Issue credits and process refunds, automatically via Stripe." },
  { icon: Mail, title: "Automated statements", description: "Scheduled account statements keep customers in the loop." },
  { icon: Palette, title: "Professional branding", description: "Your logo, brand color, and business info on every invoice." },
];

const steps = [
  { step: "1", title: "Create your account", description: "Sign up for free and set up your business profile in minutes." },
  { step: "2", title: "Create & send invoice", description: "Add your items, customize, and send professional invoices." },
  { step: "3", title: "Track & get paid", description: "Track invoice status and get paid faster from your customers." },
];

// Placeholder quotes -- swap these for real customer testimonials before launch.
const testimonials = [
  {
    quote: "InvoiceFlow helps me create professional invoices in minutes instead of wasting time formatting documents.",
    name: "Sarah Johnson",
    role: "Freelance Designer",
  },
  {
    quote: "The best invoicing tool I've used. Clean, simple, and everything I need to run my business.",
    name: "David Smith",
    role: "Marketing Consultant",
  },
  {
    quote: "Great platform for small businesses. My cash flow has improved a lot since I started using InvoiceFlow.",
    name: "Emily Davis",
    role: "Small Business Owner",
  },
];

const faqs = [
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The Starter plan is free forever — up to 5 invoices a month for a single user, no credit card required.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer: "Yes, anytime from your billing settings, including managing or canceling through the secure billing portal.",
  },
  {
    question: "Is my data secure?",
    answer: "Every organization's data is isolated, and all card payments are processed directly by Stripe.",
  },
  {
    question: "Can I use my own logo and branding?",
    answer: "Yes. Upload your logo and pick a brand color once, and every invoice and PDF uses it automatically.",
  },
  {
    question: "Do you offer customer support?",
    answer: "Yes — every plan includes support, with priority support on Professional and Business.",
  },
  {
    question: "What payment methods can my customers use?",
    answer: "Customers pay by card through a secure, hosted Stripe payment page linked from every invoice.",
  },
  {
    question: "Do you support recurring billing?",
    answer: "Yes, on the Professional and Business plans. Set a schedule once and invoices generate and send automatically.",
  },
  {
    question: "Can I create quotes as well as invoices?",
    answer: "Yes. Send a quote for approval, then convert it to an invoice in one click once your customer accepts.",
  },
  {
    question: "Can customers pay a partial amount or deposit?",
    answer: "Yes. The customer payment page lets someone pay the full balance or a custom partial amount online.",
  },
  {
    question: "Can I add team members to my account?",
    answer: "Yes, with role-based permissions (Owner, Admin, Accountant, Member). The Starter plan supports one user; Professional and Business support a full team.",
  },
  {
    question: "What happens if a customer doesn't pay on time?",
    answer: "Overdue invoices are flagged automatically, and you can send a payment reminder email straight from the invoice.",
  },
  {
    question: "Can I download my invoices as a PDF?",
    answer: "Yes. Every invoice, quote, and credit note can be downloaded or emailed as a branded PDF at any time.",
  },
];

const plans = PLAN_ORDER.map((id) => ({
  id,
  name: PLANS[id].name,
  price: PLANS[id].priceMonthly,
  description: PLANS[id].description,
  features: PLANS[id].features,
  highlighted: id === "PROFESSIONAL",
}));

function ThemeToggleMini() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-md p-2 text-fg-secondary hover:bg-surface-hover hover:text-fg"
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg-secondary">
      {children}
    </span>
  );
}

// A compact card used for the three product showcases -- flat (no shadow),
// tinted background, mock + copy side by side within one bordered container.
function ShowcaseCard({
  eyebrow,
  title,
  description,
  bullets,
  cta,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-brand-50/40 p-5 dark:bg-brand-950/10 sm:p-6">
      <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center ${reverse ? "" : ""}`}>
        <div className={reverse ? "md:order-2" : undefined}>
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</span>
          <h3 className="mt-2 text-xl font-semibold text-fg">{title}</h3>
          <p className="mt-2 text-sm text-fg-secondary">{description}</p>
          <ul className="mt-4 flex flex-col gap-1.5 text-sm text-fg-secondary">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {b}
              </li>
            ))}
          </ul>
          <Link to="/register" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className={reverse ? "md:order-1" : undefined}>{visual}</div>
      </div>
    </div>
  );
}

export default function Home() {
  useSeo({
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: DEFAULT_DESCRIPTION,
      url: SITE_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  });

  const toast = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");

  return (
    <div className="bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
              I
            </div>
            <span className="font-semibold text-fg">InvoiceFlow</span>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-fg-secondary md:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggleMini />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Start for Free</Link>
            </Button>
          </div>
          <button
            className="rounded-md p-2 text-fg-secondary hover:bg-surface-hover md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-border bg-surface px-4 py-4 sm:px-6 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-2 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-hover hover:text-fg"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <Button variant="secondary" size="sm" className="flex-1" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link to="/register">Start for Free</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-[1400px] px-4 pb-12 pt-10 sm:px-6 lg:pt-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <Badge>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Smart invoicing for modern businesses
            </Badge>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-fg sm:text-5xl">
              Create invoices.
              <br />
              Get paid.
              <br />
              <span className="text-brand-600">Stay in control.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-fg-secondary">
              Everything you need to create professional invoices, track payments, manage customers, and understand
              your business — all from one simple platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Start for Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#how-it-works">
                  <PlayCircle className="h-4 w-4" /> See how it works
                </a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-fg-muted">
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-success" /> No credit card required
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-success" /> Setup in minutes
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-success" /> Cancel anytime
              </span>
            </div>
          </div>
          <Reveal>
            <DashboardPreview />
          </Reveal>
        </div>
      </section>

      {/* Trust / value bar */}
      <Reveal>
        <section className="border-y border-border bg-surface py-6">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
            <p className="mb-4 text-center text-xs text-fg-muted">
              Trusted by freelancers, startups, and growing businesses
            </p>
            <div className="grid grid-cols-2 divide-y divide-border rounded-xl border border-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
              {trustPoints.map((t) => (
                <div key={t.label} className="flex items-center justify-center gap-2 px-3 py-3 text-center">
                  <t.icon className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="text-xs font-medium text-fg-secondary sm:text-sm">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* Two-column body: left = product story, right = supporting content */}
      <section className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-10">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-12">
            <Reveal>
              <div>
                <h2 className="text-2xl font-semibold text-fg">Still wasting time on invoicing?</h2>
                <p className="mt-1 text-sm text-fg-secondary">
                  You're not alone. Most businesses face the same challenges.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {painPoints.map((p) => (
                    <div key={p.title} className="rounded-lg border border-danger/20 bg-danger-bg/40 p-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-danger-bg text-danger">
                        <p.icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-fg">{p.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-fg-secondary">{p.description}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-fg">
                  InvoiceFlow brings everything together. <ArrowRight className="h-4 w-4" />
                </p>
              </div>
            </Reveal>

            <Reveal>
              <ShowcaseCard
                eyebrow="Create"
                title="Create professional invoices in seconds."
                description="Create beautiful invoices without complicated spreadsheets or manual calculations."
                bullets={[
                  "Add products or services instantly",
                  "Automatic tax and total calculations",
                  "Preview before you send",
                ]}
                cta="Learn more"
                visual={<InvoiceBuilderPreview />}
              />
            </Reveal>

            <Reveal>
              <ShowcaseCard
                eyebrow="Track"
                title="Know what's paid, pending, and overdue."
                description="Get a real-time overview of your business finances so you can make smarter decisions."
                bullets={["Track invoice status", "See outstanding and overdue invoices", "Get paid faster"]}
                cta="Explore analytics"
                visual={<PaymentTrackingPreview />}
                reverse
              />
            </Reveal>

            <Reveal>
              <ShowcaseCard
                eyebrow="Organize"
                title="Everything about your customers in one place."
                description="Keep customer details, invoices, and payment history organized in one simple workspace."
                bullets={["Complete customer history", "Track outstanding balances", "Access invoices quickly"]}
                cta="Learn more"
                visual={<CustomerProfilePreview />}
              />
            </Reveal>

            <Reveal>
              <div id="how-it-works">
                <h2 className="text-2xl font-semibold text-fg">How it works</h2>
                <p className="mt-1 text-sm text-fg-secondary">Get started in just a few simple steps.</p>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {steps.map((s) => (
                    <div key={s.step} className="rounded-xl border border-border bg-surface p-4 text-center">
                      <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                        {s.step}
                      </div>
                      <h3 className="text-sm font-semibold text-fg">{s.title}</h3>
                      <p className="mt-1 text-xs text-fg-secondary">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-12">
            <Reveal>
              <div id="features">
                <h2 className="text-xl font-semibold text-fg">Everything you need to run your invoicing like a pro</h2>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {features.map((f) => (
                    <div key={f.title} className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40">
                        <f.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-fg">{f.title}</p>
                        <p className="text-xs text-fg-secondary">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/register" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                  Explore all features <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>

            <Reveal>
              <div>
                <h2 className="text-xl font-semibold text-fg">Loved by businesses like yours</h2>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {testimonials.map((t) => (
                    <div key={t.name} className="rounded-xl border border-border bg-surface p-4">
                      <Quote className="h-4 w-4 text-brand-600" />
                      <p className="mt-2 text-xs text-fg-secondary">"{t.quote}"</p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                          {t.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-fg">{t.name}</p>
                          <p className="text-[10px] text-fg-muted">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="text-xs text-fg-secondary">Payments secured by Stripe</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="text-xs text-fg-secondary">Data isolated per organization</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="text-xs text-fg-secondary">Built for teams of any size</span>
                </div>
              </div>
            </Reveal>

            <Reveal>
              <div id="pricing">
                <h2 className="text-xl font-semibold text-fg">Simple, transparent pricing</h2>
                <p className="mt-1 text-sm text-fg-secondary">Billed monthly, in USD.</p>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`relative rounded-xl border p-4 ${
                        plan.highlighted ? "border-brand-600 bg-surface" : "border-border bg-surface"
                      }`}
                    >
                      {plan.highlighted && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">
                          Most Popular
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-fg">{plan.name}</h3>
                      <p className="mt-2 text-2xl font-bold text-fg">
                        ${plan.price}
                        <span className="text-xs font-normal text-fg-secondary">/mo</span>
                      </p>
                      <ul className="mt-3 flex flex-col gap-1 text-xs text-fg-secondary">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 shrink-0 text-success" /> {f}
                          </li>
                        ))}
                      </ul>
                      <Button asChild size="sm" className="mt-4 w-full" variant={plan.highlighted ? "primary" : "secondary"}>
                        <Link to="/register">{plan.id === "STARTER" ? "Get Started Free" : "Start for Free"}</Link>
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" /> Secure payments via Stripe
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Cancel anytime
                  </span>
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div id="faq">
                <h2 className="text-xl font-semibold text-fg">Frequently asked questions</h2>
                <div className="mt-6">
                  <Accordion items={faqs} />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <Reveal>
        <section className="bg-gradient-to-br from-brand-600 to-brand-900 py-14">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to make invoicing effortless?</h2>
            <p className="mt-2 text-brand-100">
              Join InvoiceFlow and spend less time managing paperwork and more time growing your business.
            </p>
            <form
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!ctaEmail.trim()) {
                  toast.error("Enter your email to get started");
                  return;
                }
                window.location.href = `/register?email=${encodeURIComponent(ctaEmail.trim())}`;
              }}
            >
              <Input
                type="email"
                required
                value={ctaEmail}
                onChange={(e) => setCtaEmail(e.target.value)}
                placeholder="Enter your email address"
                className="border-white/20 bg-white/10 text-white placeholder:text-brand-100 focus-visible:ring-white"
              />
              <Button type="submit" size="lg" variant="secondary" className="shrink-0">
                Start for Free
              </Button>
            </form>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-brand-100">
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> No credit card required
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Setup in minutes
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Cancel anytime
              </span>
            </p>
          </div>
        </section>
      </Reveal>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
                  I
                </div>
                <span className="font-semibold text-fg">InvoiceFlow</span>
              </div>
              <p className="mt-3 max-w-xs text-sm text-fg-secondary">Professional invoicing made simple.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Product</p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-fg-secondary">
                <a href="#features" className="hover:text-fg">Features</a>
                <a href="#pricing" className="hover:text-fg">Pricing</a>
                <a href="#faq" className="hover:text-fg">FAQ</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Account</p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-fg-secondary">
                <Link to="/login" className="hover:text-fg">Sign in</Link>
                <Link to="/register" className="hover:text-fg">Start for Free</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-border pt-6 text-center text-sm text-fg-muted">
            © {new Date().getFullYear()} InvoiceFlow. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
