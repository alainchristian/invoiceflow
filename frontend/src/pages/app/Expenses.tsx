import { useState } from "react";
import { Banknote, Plus, Trash2 } from "lucide-react";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/hooks/useExpenses";
import { useCustomers } from "@/hooks/useCustomers";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Customer } from "@/types";

const NO_CUSTOMER = "__none__";

export default function Expenses() {
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: customers = [] } = useCustomers();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState(NO_CUSTOMER);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [billable, setBillable] = useState(true);
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (billable && customerId === NO_CUSTOMER) {
      toast.error("Select a customer for a billable expense");
      return;
    }
    try {
      await createExpense.mutateAsync({
        customerId: customerId === NO_CUSTOMER ? undefined : customerId,
        description,
        amount: Number(amount),
        billable,
        occurredAt,
      });
      toast.success("Expense logged");
      setCustomerId(NO_CUSTOMER);
      setDescription("");
      setAmount("0");
      setBillable(true);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Something went wrong");
    }
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track business costs, then pull billable ones straight into an invoice."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Log expense
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No expenses yet"
              description="Log a cost against a customer, then add it to their next invoice with one click."
              action={<Button onClick={() => setOpen(true)}>Log expense</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Customer</TH>
                  <TH>Description</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {expenses.map((expense) => (
                  <TR key={expense.id}>
                    <TD>{formatDate(expense.occurredAt)}</TD>
                    <TD>{expense.customer?.name ?? "—"}</TD>
                    <TD>{expense.description}</TD>
                    <TD>{formatCurrency(expense.amount)}</TD>
                    <TD>
                      <div className="flex gap-1.5">
                        <Badge variant={expense.billable ? "info" : "neutral"}>
                          {expense.billable ? "Billable" : "Non-billable"}
                        </Badge>
                        {expense.billable && (
                          <Badge variant={expense.billed ? "success" : "neutral"}>
                            {expense.billed ? "Billed" : "Unbilled"}
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD>
                      {!expense.billed && (
                        <button
                          onClick={async () => {
                            await deleteExpense.mutateAsync(expense.id);
                            toast.success("Expense removed");
                          }}
                          className="text-fg-muted hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="exdescription">Description</Label>
              <Input id="exdescription" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="examount">Amount</Label>
                <Input
                  id="examount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="exdate">Date</Label>
                <Input id="exdate" type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-fg-secondary">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
              Billable to a customer
            </label>
            <div>
              <Label htmlFor="excustomer">Customer{!billable && " (optional)"}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="excustomer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CUSTOMER}>No customer</SelectItem>
                  {customers.map((c: Customer) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="self-end" disabled={createExpense.isPending}>
              Save expense
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
