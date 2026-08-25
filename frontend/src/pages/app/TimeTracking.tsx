import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { useTimeEntries, useCreateTimeEntry, useDeleteTimeEntry } from "@/hooks/useTimeEntries";
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

export default function TimeTracking() {
  const { data: entries = [], isLoading } = useTimeEntries();
  const { data: customers = [] } = useCustomers();
  const createEntry = useCreateTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createEntry.mutateAsync({
      customerId,
      description,
      minutes: Number(minutes),
      hourlyRate: Number(hourlyRate),
      occurredAt,
    });
    toast.success("Time entry logged");
    setCustomerId("");
    setDescription("");
    setMinutes("60");
    setHourlyRate("0");
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Time Tracking"
        subtitle="Log billable hours, then pull them straight into an invoice."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Log time
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
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No time entries yet"
              description="Log time against a customer, then add it to their next invoice with one click."
              action={<Button onClick={() => setOpen(true)}>Log time</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Customer</TH>
                  <TH>Description</TH>
                  <TH>Duration</TH>
                  <TH>Rate</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {entries.map((entry) => (
                  <TR key={entry.id}>
                    <TD>{formatDate(entry.occurredAt)}</TD>
                    <TD>{entry.customer.name}</TD>
                    <TD>{entry.description}</TD>
                    <TD>{(entry.minutes / 60).toFixed(2)}h</TD>
                    <TD>{formatCurrency(entry.hourlyRate)}/h</TD>
                    <TD>{formatCurrency((entry.minutes / 60) * entry.hourlyRate)}</TD>
                    <TD>
                      <Badge variant={entry.billed ? "success" : "neutral"}>
                        {entry.billed ? "Billed" : "Unbilled"}
                      </Badge>
                    </TD>
                    <TD>
                      {!entry.billed && (
                        <button
                          onClick={async () => {
                            await deleteEntry.mutateAsync(entry.id);
                            toast.success("Time entry removed");
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
            <DialogTitle>Log time</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="tecustomer">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="tecustomer">
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
            <div>
              <Label htmlFor="tedescription">Description</Label>
              <Input id="tedescription" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="teminutes">Minutes</Label>
                <Input
                  id="teminutes"
                  type="number"
                  min={1}
                  step="1"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="terate">Rate ($/h)</Label>
                <Input
                  id="terate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tedate">Date</Label>
                <Input
                  id="tedate"
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="self-end" disabled={!customerId || createEntry.isPending}>
              Save entry
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
