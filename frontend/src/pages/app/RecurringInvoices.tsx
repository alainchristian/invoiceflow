import { Link } from "react-router-dom";
import { Plus, Repeat, MoreHorizontal, Pause, Play, Zap, Pencil, Trash2 } from "lucide-react";
import {
  useRecurringInvoices,
  useUpdateRecurringInvoiceStatus,
  useRunRecurringInvoiceNow,
  useDeleteRecurringInvoice,
} from "@/hooks/useRecurringInvoices";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export default function RecurringInvoices() {
  const { data, isLoading } = useRecurringInvoices();
  const updateStatus = useUpdateRecurringInvoiceStatus();
  const runNow = useRunRecurringInvoiceNow();
  const deleteSchedule = useDeleteRecurringInvoice();
  const toast = useToast();

  return (
    <div>
      <PageHeader
        title="Recurring Invoices"
        subtitle="Automatically generate invoices on a schedule."
        actions={
          <Button asChild>
            <Link to="/app/recurring/new">
              <Plus className="h-4 w-4" /> Create Schedule
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data || data.schedules.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No recurring invoices yet"
              description="Set up a schedule to automatically bill a customer on a regular cadence."
              action={
                <Button asChild size="sm">
                  <Link to="/app/recurring/new">Create Schedule</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Frequency</TH>
                  <TH>Next Run</TH>
                  <TH>Last Run</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data.schedules.map((schedule) => (
                  <TR key={schedule.id}>
                    <TD>{schedule.customer.name}</TD>
                    <TD>{FREQUENCY_LABEL[schedule.frequency] ?? schedule.frequency}</TD>
                    <TD>{schedule.status === "ACTIVE" ? formatDate(schedule.nextRunDate) : "-"}</TD>
                    <TD>{schedule.lastRunAt ? formatDate(schedule.lastRunAt) : "Never"}</TD>
                    <TD>
                      <StatusBadge status={schedule.status} />
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {schedule.status === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await runNow.mutateAsync(schedule.id);
                                toast.success("Invoice generated");
                              }}
                            >
                              <Zap className="mr-2 h-4 w-4" /> Run now
                            </DropdownMenuItem>
                          )}
                          {schedule.status === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateStatus.mutateAsync({ id: schedule.id, status: "PAUSED" });
                                toast.success("Schedule paused");
                              }}
                            >
                              <Pause className="mr-2 h-4 w-4" /> Pause
                            </DropdownMenuItem>
                          )}
                          {schedule.status === "PAUSED" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateStatus.mutateAsync({ id: schedule.id, status: "ACTIVE" });
                                toast.success("Schedule resumed");
                              }}
                            >
                              <Play className="mr-2 h-4 w-4" /> Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link to={`/app/recurring/${schedule.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              await deleteSchedule.mutateAsync(schedule.id);
                              toast.success("Schedule deleted");
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
