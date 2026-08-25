import { useEffect, useState } from "react";
import { useAdminSettings, useUpdateAdminSettings } from "@/hooks/useAdmin";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Settings() {
  const { data: settings, isLoading } = useAdminSettings();
  const update = useUpdateAdminSettings();
  const toast = useToast();

  const [platformName, setPlatformName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => {
    if (settings) {
      setPlatformName(settings.platformName);
      setSupportEmail(settings.supportEmail ?? "");
      setRegistrationEnabled(settings.registrationEnabled);
    }
  }, [settings]);

  async function handleSaveGeneral() {
    try {
      await update.mutateAsync({ platformName, supportEmail: supportEmail || null });
      toast.success("General settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    }
  }

  async function handleToggleRegistration(enabled: boolean) {
    setRegistrationEnabled(enabled);
    try {
      await update.mutateAsync({ registrationEnabled: enabled });
      toast.success(enabled ? "New tenant registration is now open." : "New tenant registration is now closed.");
    } catch {
      setRegistrationEnabled(!enabled);
      toast.error("Failed to update registration setting.");
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Platform Settings</h1>
        <p className="mt-1 text-sm text-fg-secondary">Platform-wide configuration for InvoiceFlow.</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="platform-name">Platform name</Label>
              <Input id="platform-name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="support-email">Support email</Label>
              <Input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@invoiceflow.com"
              />
            </div>
            <Button onClick={handleSaveGeneral} disabled={update.isPending}>
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-fg">Allow new tenant registration</p>
                <p className="text-xs text-fg-muted">When off, new sign-ups at /register are blocked. Existing tenants are unaffected.</p>
              </div>
              <Switch checked={registrationEnabled} onCheckedChange={handleToggleRegistration} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>More settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-fg-muted">
              Security, notification, and tenant-default configuration aren't editable from here yet — they're managed directly in the
              application environment.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
