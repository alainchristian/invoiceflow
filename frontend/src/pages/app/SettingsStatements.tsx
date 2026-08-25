import { useEffect, useState } from "react";
import { useCurrentOrganization, useUpdateOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";

export default function SettingsStatements() {
  const { data: org } = useCurrentOrganization();
  const updateOrg = useUpdateOrganization();
  const toast = useToast();

  const [enabled, setEnabled] = useState(false);
  const [frequencyDays, setFrequencyDays] = useState(30);
  const [recipients, setRecipients] = useState<"ALL" | "OVERDUE_ONLY">("OVERDUE_ONLY");

  useEffect(() => {
    if (org) {
      setEnabled(org.statementsEnabled);
      setFrequencyDays(org.statementFrequencyDays);
      setRecipients(org.statementRecipients);
    }
  }, [org]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await updateOrg.mutateAsync({
      statementsEnabled: enabled,
      statementFrequencyDays: Number(frequencyDays),
      statementRecipients: recipients,
    });
    toast.success("Statement settings saved");
  }

  return (
    <div>
      <PageHeader
        title="Customer Statements"
        subtitle="Automatically email customers a summary of their open invoices on a schedule."
      />

      <form onSubmit={handleSubmit} className="grid max-w-2xl grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Automated statements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="mb-0">Send statements automatically</Label>
                <p className="text-xs text-fg-muted">
                  {enabled
                    ? "Customers with open invoices will be emailed a statement on this schedule."
                    : "Statements will not be sent automatically."}
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Send every (days)</Label>
                <Input
                  id="frequency"
                  type="number"
                  min={1}
                  step="1"
                  value={frequencyDays}
                  onChange={(e) => setFrequencyDays(Number(e.target.value))}
                  disabled={!enabled}
                />
              </div>
              <div>
                <Label htmlFor="recipients">Send to</Label>
                <Select value={recipients} onValueChange={(v) => setRecipients(v as "ALL" | "OVERDUE_ONLY")}>
                  <SelectTrigger id="recipients" disabled={!enabled}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OVERDUE_ONLY">Customers with an overdue balance</SelectItem>
                    <SelectItem value="ALL">All customers with an open balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {org?.nextStatementRunAt && (
              <p className="text-xs text-fg-muted">Next run: {formatDate(org.nextStatementRunAt)}</p>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="self-start" disabled={updateOrg.isPending}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
