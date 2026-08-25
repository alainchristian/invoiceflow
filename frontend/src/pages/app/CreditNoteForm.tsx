import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoice } from "@/hooks/useInvoices";
import {
  useCreditNote,
  useCreateCreditNote,
  useUpdateCreditNote,
  type CreditNoteFormItem,
} from "@/hooks/useCreditNotes";
import { useProducts } from "@/hooks/useProducts";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { useToast } from "@/components/ui/Toast";
import type { Customer } from "@/types";

const emptyItem: CreditNoteFormItem = { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 };

export default function CreditNoteForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const [searchParams] = useSearchParams();
  const prefillInvoiceId = searchParams.get("invoiceId") || undefined;
  const navigate = useNavigate();
  const toast = useToast();

  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: existing } = useCreditNote(id);
  const { data: sourceInvoice } = useInvoice(prefillInvoiceId);
  const createCreditNote = useCreateCreditNote();
  const updateCreditNote = useUpdateCreditNote();

  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState<string | undefined>(prefillInvoiceId);
  const [currency, setCurrency] = useState("USD");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<CreditNoteFormItem[]>([{ ...emptyItem }]);

  useEffect(() => {
    if (existing) {
      setCustomerId(existing.customer.id);
      setInvoiceId(existing.invoice?.id);
      setCurrency(existing.currency);
      setReason(existing.reason || "");
      setNotes(existing.notes || "");
      setItems(
        existing.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          discount: i.discount,
        }))
      );
    }
  }, [existing]);

  // Pre-fill from the source invoice only on first load of a brand-new credit note.
  useEffect(() => {
    if (!isEditing && sourceInvoice) {
      setCustomerId(sourceInvoice.customer.id);
      setCurrency(sourceInvoice.currency);
      setItems(
        sourceInvoice.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          discount: i.discount,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceInvoice, isEditing]);

  const selectedCustomer = customers.find((c: Customer) => c.id === customerId) ?? null;

  function updateItem(index: number, field: keyof CreditNoteFormItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function applyProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, description: product.name, unitPrice: product.defaultPrice, taxRate: product.taxRate }
          : item
      )
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId || items.length === 0) {
      toast.error("Please select a customer and at least one item");
      return;
    }

    const payload = {
      customerId,
      invoiceId,
      currency,
      reason,
      notes,
      items: items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate || 0),
        discount: Number(item.discount || 0),
      })),
    };

    try {
      if (isEditing && id) {
        await updateCreditNote.mutateAsync({ id, data: payload });
        toast.success("Credit note updated");
        navigate(`/app/credit-notes/${id}`);
      } else {
        const creditNote = await createCreditNote.mutateAsync(payload);
        toast.success("Credit note created");
        navigate(`/app/credit-notes/${creditNote.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Something went wrong");
    }
  }

  const saving = createCreditNote.isPending || updateCreditNote.isPending;

  return (
    <div>
      <PageHeader title={isEditing ? "Edit Credit Note" : "New Credit Note"} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: Customer) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(sourceInvoice || existing?.invoice) && (
                <p className="text-xs text-fg-muted">
                  Linked to invoice <span className="font-medium text-fg">{sourceInvoice?.number || existing?.invoice?.number}</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Line items</Label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add row
                </button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    {products.length > 0 && (
                      <Select onValueChange={(v) => applyProduct(index, v)}>
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue placeholder="From catalog" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      required
                      className="flex-1"
                    />
                    <button type="button" onClick={() => removeItem(index)} className="text-fg-muted hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Price</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tax %</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.taxRate}
                        onChange={(e) => updateItem(index, "taxRate", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Discount $</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.discount}
                        onChange={(e) => updateItem(index, "discount", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Save changes" : "Save Credit Note"}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <InvoicePreview
            customer={selectedCustomer}
            currency={currency}
            items={items}
            notes={notes}
            invoiceNumber={existing?.number}
            kind="CREDIT NOTE"
          />
        </div>
      </form>
    </div>
  );
}
