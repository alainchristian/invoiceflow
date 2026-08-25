import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Download, Send, CheckCircle2, Copy, Pencil, Ban, Link2, Plus, Bell, Receipt, RotateCcw } from "lucide-react";
import {
  useInvoice,
  useSendInvoice,
  useDuplicateInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useRecordPayment,
  useRecordRefund,
  useSendReminder,
  downloadInvoicePdf,
} from "@/hooks/useInvoices";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: invoice, isLoading } = useInvoice(id);
  const send = useSendInvoice();
  const duplicate = useDuplicateInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const recordPayment = useRecordPayment();
  const recordRefund = useRecordRefund();
  const sendReminder = useSendReminder();

  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  if (isLoading || !invoice) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/i/${invoice.publicToken}`;
  const balanceDue = invoice.total - invoice.amountPaid;

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.number}`}
        subtitle={`Created ${formatDate(invoice.createdAt)}`}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadInvoicePdf(invoice.id, invoice.number)}
            >
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Client link copied to clipboard");
              }}
            >
              <Link2 className="h-4 w-4" /> Copy link
            </Button>
            {invoice.status === "DRAFT" && (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/app/invoices/${invoice.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            {invoice.status === "DRAFT" && (
              <Button
                size="sm"
                onClick={async () => {
                  await send.mutateAsync(invoice.id);
                  toast.success("Invoice sent");
                }}
              >
                <Send className="h-4 w-4" /> Send
              </Button>
            )}
            {invoice.status !== "DRAFT" && (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/app/credit-notes/new?invoiceId=${invoice.id}`}>
                  <Receipt className="h-4 w-4" /> Issue Credit Note
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePreview
            customer={invoice.customer}
            issueDate={invoice.issueDate}
            dueDate={invoice.dueDate}
            currency={invoice.currency}
            items={invoice.items}
            notes={invoice.notes ?? undefined}
            terms={invoice.terms ?? undefined}
            invoiceNumber={invoice.number}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <StatusBadge status={invoice.status} />
              <div className="text-sm">
                <div className="flex justify-between text-fg-secondary">
                  <span>Total</span>
                  <span className="font-medium text-fg">{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
                <div className="flex justify-between text-fg-secondary">
                  <span>Paid</span>
                  <span className="font-medium text-fg">{formatCurrency(invoice.amountPaid, invoice.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-fg-secondary">
                  <span>Balance due</span>
                  <span className="font-semibold text-fg">{formatCurrency(balanceDue, invoice.currency)}</span>
                </div>
              </div>

              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <Button size="sm" onClick={() => setShowPayment(true)}>
                  <Plus className="h-4 w-4" /> Record payment
                </Button>
              )}
              {invoice.amountPaid > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setShowRefund(true)}>
                  <RotateCcw className="h-4 w-4" /> Refund
                </Button>
              )}
              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await updateStatus.mutateAsync({ id: invoice.id, status: "PAID" });
                    toast.success("Invoice marked as paid");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark fully paid
                </Button>
              )}
              {invoice.status !== "DRAFT" && invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const result = await sendReminder.mutateAsync(invoice.id);
                    toast.success(
                      `Reminder sent to ${result.notifiedCount} team member${result.notifiedCount === 1 ? "" : "s"}`
                    );
                  }}
                >
                  <Bell className="h-4 w-4" /> Send reminder
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const dup = await duplicate.mutateAsync(invoice.id);
                  toast.success("Invoice duplicated");
                  navigate(`/app/invoices/${dup.id}`);
                }}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              {invoice.status === "DRAFT" && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await deleteInvoice.mutateAsync(invoice.id);
                    toast.success("Invoice deleted");
                    navigate("/app/invoices");
                  }}
                >
                  Delete draft
                </Button>
              )}
              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await updateStatus.mutateAsync({ id: invoice.id, status: "CANCELLED" });
                    toast.success("Invoice cancelled");
                  }}
                >
                  <Ban className="h-4 w-4" /> Cancel invoice
                </Button>
              )}
            </CardContent>
          </Card>

          {invoice.payments && invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment history</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-fg-secondary">
                      {formatDate(p.paidAt)}
                      {p.type === "REFUND" && <span className="ml-1.5 text-danger">(refund)</span>}
                    </span>
                    <span className={`font-medium ${p.type === "REFUND" ? "text-danger" : "text-fg"}`}>
                      {p.type === "REFUND" ? "-" : ""}
                      {formatCurrency(p.amount, invoice.currency)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await recordPayment.mutateAsync({ id: invoice.id, amount: Number(amount), method });
              toast.success("Payment recorded");
              setShowPayment(false);
              setAmount("");
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                max={balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-fg-muted">Balance due: {formatCurrency(balanceDue, invoice.currency)}</p>
            </div>
            <div>
              <Label htmlFor="method">Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="MOBILE_MONEY">Mobile money</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="self-end" disabled={recordPayment.isPending}>
              Record payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showRefund} onOpenChange={setShowRefund}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund a payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await recordRefund.mutateAsync({ id: invoice.id, amount: Number(refundAmount), reason: refundReason || undefined });
                toast.success("Refund recorded");
                setShowRefund(false);
                setRefundAmount("");
                setRefundReason("");
              } catch (err: any) {
                toast.error(err.response?.data?.error || "Could not process refund");
              }
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <Label htmlFor="refundAmount">Amount</Label>
              <Input
                id="refundAmount"
                type="number"
                min={0}
                step="0.01"
                max={invoice.amountPaid}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-fg-muted">
                Amount paid: {formatCurrency(invoice.amountPaid, invoice.currency)}. If the original payment was a card
                payment via Stripe, this refunds the card automatically.
              </p>
            </div>
            <div>
              <Label htmlFor="refundReason">Reason</Label>
              <Textarea
                id="refundReason"
                rows={2}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <Button type="submit" variant="danger" className="self-end" disabled={recordRefund.isPending}>
              {recordRefund.isPending ? "Processing..." : "Issue refund"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
