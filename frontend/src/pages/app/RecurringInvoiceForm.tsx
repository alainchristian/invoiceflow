import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { useCustomers } from "@/hooks/useCustomers";
import {
  useRecurringInvoice,
  useCreateRecurringInvoice,
  useUpdateRecurringInvoice,
  type RecurringInvoiceFormItem,
} from "@/hooks/useRecurringInvoices";
import { useProducts } from "@/hooks/useProducts";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { NewCustomerDialog } from "@/components/customers/NewCustomerDialog";
import { useToast } from "@/components/ui/Toast";
import type { Customer } from "@/types";

const emptyItem: RecurringInvoiceFormItem = { description: "", quantity: 1, unitPrice: 0, taxRate: 0, discount: 0 };

export default function RecurringInvoiceForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: existing } = useRecurringInvoice(id);
  const createSchedule = useCreateRecurringInvoice();
  const updateSchedule = useUpdateRecurringInvoice();

  const [customerId, setCustomerId] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [dueInDays, setDueInDays] = useState(14);
  const [currency, setCurrency] = useState("USD");
  const [generateAsDraft, setGenerateAsDraft] = useState(false);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<RecurringInvoiceFormItem[]>([{ ...emptyItem }]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  useEffect(() => {
    if (existing) {
      setCustomerId(existing.customer.id);
      setFrequency(existing.frequency);
      setStartDate(existing.startDate.slice(0, 10));
      setEndDate(existing.endDate ? existing.endDate.slice(0, 10) : "");
      setDueInDays(existing.dueInDays);
      setCurrency(existing.currency);
      setGenerateAsDraft(existing.generateAsDraft);
      setNotes(existing.notes || "");
      setTerms(existing.terms || "");
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

  function updateItem(index: number, field: keyof RecurringInvoiceFormItem, value: string | number) {
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
    if (!customerId || !startDate || items.length === 0) {
      toast.error("Please select a customer, start date, and at least one item");
      return;
    }

    const payload = {
      customerId,
      frequency,
      startDate,
      endDate: endDate || undefined,
      dueInDays: Number(dueInDays),
      currency,
      generateAsDraft,
      notes,
      terms,
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
        await updateSchedule.mutateAsync({ id, data: payload });
        toast.success("Schedule updated");
      } else {
        await createSchedule.mutateAsync(payload);
        toast.success("Schedule created");
      }
      navigate("/app/recurring");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Something went wrong");
    }
  }

  const saving = createSchedule.isPending || updateSchedule.isPending;

  return (
    <div>
      <PageHeader title={isEditing ? "Edit Recurring Invoice" : "Create Recurring Invoice"} />

      <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
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
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueInDays">Due in (days)</Label>
                <Input
                  id="dueInDays"
                  type="number"
                  min={0}
                  step="1"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="endDate">End date (optional)</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

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

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="mb-0">Generate as draft</Label>
                <p className="text-xs text-fg-muted">
                  {generateAsDraft
                    ? "New invoices land as drafts for you to review before sending."
                    : "New invoices are emailed to the customer automatically."}
                </p>
              </div>
              <Switch checked={generateAsDraft} onCheckedChange={setGenerateAsDraft} />
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
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save Schedule"}
          </Button>
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
