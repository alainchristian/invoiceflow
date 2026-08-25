import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireAdmin } from "@/components/RequireAdmin";
import { RequireSuperAdmin } from "@/components/RequireSuperAdmin";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";

import Home from "@/pages/marketing/Home";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import PublicInvoicePage from "@/pages/PublicInvoice";
import PublicQuotePage from "@/pages/PublicQuote";
import Dashboard from "@/pages/app/Dashboard";
import Analytics from "@/pages/app/Analytics";
import Invoices from "@/pages/app/Invoices";
import InvoiceForm from "@/pages/app/InvoiceForm";
import InvoiceDetail from "@/pages/app/InvoiceDetail";
import Quotes from "@/pages/app/Quotes";
import QuoteForm from "@/pages/app/QuoteForm";
import QuoteDetail from "@/pages/app/QuoteDetail";
import RecurringInvoices from "@/pages/app/RecurringInvoices";
import RecurringInvoiceForm from "@/pages/app/RecurringInvoiceForm";
import Customers from "@/pages/app/Customers";
import CustomerDetail from "@/pages/app/CustomerDetail";
import Products from "@/pages/app/Products";
import Payments from "@/pages/app/Payments";
import CreditNotes from "@/pages/app/CreditNotes";
import CreditNoteForm from "@/pages/app/CreditNoteForm";
import CreditNoteDetail from "@/pages/app/CreditNoteDetail";
import SettingsCompany from "@/pages/app/SettingsCompany";
import SettingsTeam from "@/pages/app/SettingsTeam";
import SettingsBilling from "@/pages/app/SettingsBilling";
import SettingsStatements from "@/pages/app/SettingsStatements";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminTenants from "@/pages/admin/Tenants";
import AdminTenantDetail from "@/pages/admin/TenantDetail";
import AdminUsers from "@/pages/admin/Users";
import AdminUserDetail from "@/pages/admin/UserDetail";
import AdminPlans from "@/pages/admin/Plans";
import AdminSubscriptions from "@/pages/admin/Subscriptions";
import AdminActivity from "@/pages/admin/Activity";
import AdminSupport from "@/pages/admin/Support";
import AdminAdministrators from "@/pages/admin/Administrators";
import AdminSettings from "@/pages/admin/Settings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/i/:token" element={<PublicInvoicePage />} />
                <Route path="/q/:token" element={<PublicQuotePage />} />

                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/new" element={<InvoiceForm />} />
                  <Route path="invoices/:id" element={<InvoiceDetail />} />
                  <Route path="invoices/:id/edit" element={<InvoiceForm />} />
                  <Route path="quotes" element={<Quotes />} />
                  <Route path="quotes/new" element={<QuoteForm />} />
                  <Route path="quotes/:id" element={<QuoteDetail />} />
                  <Route path="quotes/:id/edit" element={<QuoteForm />} />
                  <Route path="recurring" element={<RecurringInvoices />} />
                  <Route path="recurring/new" element={<RecurringInvoiceForm />} />
                  <Route path="recurring/:id/edit" element={<RecurringInvoiceForm />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/:id" element={<CustomerDetail />} />
                  <Route path="products" element={<Products />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="credit-notes" element={<CreditNotes />} />
                  <Route path="credit-notes/new" element={<CreditNoteForm />} />
                  <Route path="credit-notes/:id" element={<CreditNoteDetail />} />
                  <Route path="credit-notes/:id/edit" element={<CreditNoteForm />} />
                  <Route path="settings/company" element={<SettingsCompany />} />
                  <Route path="settings/team" element={<SettingsTeam />} />
                  <Route path="settings/billing" element={<SettingsBilling />} />
                  <Route path="settings/statements" element={<SettingsStatements />} />
                </Route>

                <Route
                  path="/admin"
                  element={
                    <RequireAdmin>
                      <AdminLayout />
                    </RequireAdmin>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="tenants" element={<AdminTenants />} />
                  <Route path="tenants/:id" element={<AdminTenantDetail />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="users/:id" element={<AdminUserDetail />} />
                  <Route path="plans" element={<AdminPlans />} />
                  <Route path="subscriptions" element={<AdminSubscriptions />} />
                  <Route path="activity" element={<AdminActivity />} />
                  <Route path="support" element={<AdminSupport />} />
                  <Route
                    path="administrators"
                    element={
                      <RequireSuperAdmin>
                        <AdminAdministrators />
                      </RequireSuperAdmin>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <RequireSuperAdmin>
                        <AdminSettings />
                      </RequireSuperAdmin>
                    }
                  />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
