import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoice, useCreateInvoice, useUpdateInvoice, type InvoiceFormItem } from "@/hooks/useInvoices";
import { useProducts } from "@/hooks/useProducts";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { NewCustomerDialog } from "@/components/customers/NewCustomerDialog";
import { useToast } from "@/components/ui/Toast";
import type { Customer } from "@/types";

const emptyItem: InvoiceFormItem = { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 };

export default function InvoiceForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: existingInvoice } = useInvoice(id);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState(0);
  const [items, setItems] = useState<InvoiceFormItem[]>([{ ...emptyItem }]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  useEffect(() => {
    if (existingInvoice) {
      setCustomerId(existingInvoice.customer.id);
      setIssueDate(existingInvoice.issueDate.slice(0, 10));
      setDueDate(existingInvoice.dueDate.slice(0, 10));
      setCurrency(existingInvoice.currency);
      setPoNumber(existingInvoice.poNumber || "");
      setNotes(existingInvoice.notes || "");
      setTerms(existingInvoice.terms || "");
      setInvoiceDiscountType(existingInvoice.invoiceDiscountType || "FLAT");
      setInvoiceDiscountValue(existingInvoice.invoiceDiscountValue || 0);
      setItems(
        existingInvoice.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          discount: i.discount,
        }))
      );
    }
  }, [existingInvoice]);

  const selectedCustomer = customers.find((c: Customer) => c.id === customerId) ?? null;

  function updateItem(index: number, field: keyof InvoiceFormItem, value: string | number) {
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
    if (!customerId || !dueDate || items.length === 0) {
      toast.error("Please select a customer, due date, and at least one item");
      return;
    }

    const payload = {
      customerId,
      issueDate,
      dueDate,
      currency,
      poNumber,
      notes,
      terms,
      invoiceDiscountType,
      invoiceDiscountValue: Number(invoiceDiscountValue || 0),
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
        await updateInvoice.mutateAsync({ id, data: payload });
        toast.success("Invoice updated");
        navigate(`/app/invoices/${id}`);
      } else {
        const invoice = await createInvoice.mutateAsync(payload);
        toast.success("Invoice created");
        navigate(`/app/invoices/${invoice.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Something went wrong");
    }
  }

  const saving = createInvoice.isPending || updateInvoice.isPending;

  return (
    <div>
      <PageHeader title={isEditing ? "Edit Invoice" : "Create Invoice"} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Customer</Label>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add new customer
                </button>
              </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issueDate">Issue date</Label>
                  <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due date</Label>
                  <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </div>
              </div>

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
                  <Label htmlFor="poNumber">PO number</Label>
                  <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
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

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <Label className="mb-0 whitespace-nowrap text-xs text-fg-muted">Invoice discount</Label>
                <Select value={invoiceDiscountType} onValueChange={(v) => setInvoiceDiscountType(v as "FLAT" | "PERCENT")}>
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">$</SelectItem>
                    <SelectItem value="PERCENT">%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8 w-24 text-xs"
                  value={invoiceDiscountValue}
                  onChange={(e) => setInvoiceDiscountValue(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="terms">Terms and conditions</Label>
                <Textarea id="terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Save changes" : "Save Invoice"}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <InvoicePreview
            customer={selectedCustomer}
            issueDate={issueDate}
            dueDate={dueDate}
            currency={currency}
            items={items}
            notes={notes}
            terms={terms}
            invoiceNumber={existingInvoice?.number}
            poNumber={poNumber}
            invoiceDiscountType={invoiceDiscountType}
            invoiceDiscountValue={invoiceDiscountValue}
          />
        </div>
      </form>

      <NewCustomerDialog
        open={showNewCustomer}
        onOpenChange={setShowNewCustomer}
        onCreated={(customer) => setCustomerId(customer.id)}
      />
    </div>
  );
}
