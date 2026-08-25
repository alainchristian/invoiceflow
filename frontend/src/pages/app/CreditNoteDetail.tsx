import { useNavigate, useParams, Link } from "react-router-dom";
import { Download, Send, Ban, Pencil, Trash2 } from "lucide-react";
import {
  useCreditNote,
  useIssueCreditNote,
  useVoidCreditNote,
  useDeleteCreditNote,
  downloadCreditNotePdf,
} from "@/hooks/useCreditNotes";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function CreditNoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: creditNote, isLoading } = useCreditNote(id);
  const issue = useIssueCreditNote();
  const voidNote = useVoidCreditNote();
  const deleteNote = useDeleteCreditNote();

  if (isLoading || !creditNote) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Credit Note ${creditNote.number}`}
        subtitle={`Created ${formatDate(creditNote.createdAt)}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadCreditNotePdf(creditNote.id, creditNote.number)}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            {creditNote.status === "DRAFT" && (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/app/credit-notes/${creditNote.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            {creditNote.status === "DRAFT" && (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await issue.mutateAsync(creditNote.id);
                    toast.success("Credit note issued");
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || "Could not issue credit note");
                  }
                }}
              >
                <Send className="h-4 w-4" /> Issue
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePreview
            customer={creditNote.customer}
            currency={creditNote.currency}
            items={creditNote.items}
            notes={creditNote.notes ?? undefined}
            invoiceNumber={creditNote.number}
            kind="CREDIT NOTE"
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <StatusBadge status={creditNote.status} />
              <div className="text-sm">
                <div className="flex justify-between border-t border-border pt-2 text-fg-secondary">
                  <span>Total</span>
                  <span className="font-semibold text-fg">{formatCurrency(creditNote.total, creditNote.currency)}</span>
                </div>
              </div>
              {creditNote.invoice && (
                <p className="text-sm text-fg-secondary">
                  Linked to invoice{" "}
                  <Link to={`/app/invoices/${creditNote.invoice.id}`} className="font-medium text-brand-600 hover:underline">
                    {creditNote.invoice.number}
                  </Link>
                </p>
              )}
              {creditNote.reason && (
                <p className="text-sm text-fg-secondary">
                  <span className="text-fg-muted">Reason: </span>
                  {creditNote.reason}
                </p>
              )}

              {creditNote.status === "ISSUED" && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await voidNote.mutateAsync(creditNote.id);
                    toast.success("Credit note voided");
                  }}
                >
                  <Ban className="h-4 w-4" /> Void
                </Button>
              )}
              {creditNote.status === "DRAFT" && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await deleteNote.mutateAsync(creditNote.id);
                    toast.success("Credit note deleted");
                    navigate("/app/credit-notes");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete draft
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
