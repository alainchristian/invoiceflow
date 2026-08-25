import { useEffect, useState } from "react";
import { useCurrentOrganization, useUpdateOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

const MAX_LOGO_DIMENSION = 300;

// Re-encodes the uploaded logo through a canvas rather than storing the raw
// file bytes -- guarantees the browser itself successfully decoded the image
// (a corrupt file just fails to load here) and caps its size.
function reencodeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsCompany() {
  const { data: org } = useCurrentOrganization();
  const updateOrg = useUpdateOrganization();
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    brandColor: "#4f46e5",
    address: "",
    phone: "",
    email: "",
    taxId: "",
    invoicePrefix: "INV",
    quotePrefix: "QUO",
    defaultCurrency: "USD",
    defaultTaxRate: 0,
    defaultPaymentTerms: "",
    defaultNotes: "",
    pdfTemplate: "classic" as "classic" | "modern",
    lateFeeEnabled: false,
    lateFeeType: "FLAT" as "FLAT" | "PERCENT",
    lateFeeValue: 0,
    lateFeeGraceDays: 0,
  });

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || "",
        logoUrl: org.logoUrl || "",
        brandColor: org.brandColor || "#4f46e5",
        address: org.address || "",
        phone: org.phone || "",
        email: org.email || "",
        taxId: org.taxId || "",
        invoicePrefix: org.invoicePrefix || "INV",
        quotePrefix: org.quotePrefix || "QUO",
        defaultCurrency: org.defaultCurrency || "USD",
        defaultTaxRate: org.defaultTaxRate || 0,
        defaultPaymentTerms: org.defaultPaymentTerms || "",
        defaultNotes: org.defaultNotes || "",
        pdfTemplate: org.pdfTemplate || "classic",
        lateFeeEnabled: org.lateFeeEnabled ?? false,
        lateFeeType: org.lateFeeType ?? "FLAT",
        lateFeeValue: org.lateFeeValue ?? 0,
        lateFeeGraceDays: org.lateFeeGraceDays ?? 0,
      });
    }
  }, [org]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await reencodeImageFile(file);
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    } catch (err: any) {
      toast.error(err.message || "Could not process that image.");
    } finally {
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await updateOrg.mutateAsync(form);
    toast.success("Company settings saved");
  }

  return (
    <div>
      <PageHeader title="Company" subtitle="This information appears on every invoice you send." />

      <form onSubmit={handleSubmit} className="grid max-w-3xl grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label htmlFor="name">Company name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {form.logoUrl && <img src={form.logoUrl} alt="" className="h-12 w-auto rounded border border-border" />}
                <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="text-sm" />
              </div>
            </div>
            <div>
              <Label htmlFor="brandColor">Brand color</Label>
              <input
                id="brandColor"
                type="color"
                value={form.brandColor}
                onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                className="h-9 w-16 rounded border border-border"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice template</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setForm({ ...form, pdfTemplate: "classic" })}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  form.pdfTemplate === "classic" ? "border-brand-600" : "border-border hover:border-border-strong"
                }`}
              >
                <div className="mb-2 rounded border border-border bg-surface-hover p-2">
                  <div className="mb-1.5 h-2 w-10 rounded" style={{ backgroundColor: form.brandColor }} />
                  <div className="mb-1 h-1 w-full rounded bg-border-strong" />
                  <div className="mb-0.5 h-1 w-3/4 rounded bg-border" />
                  <div className="h-1 w-2/3 rounded bg-border" />
                </div>
                <p className="text-sm font-medium text-fg">Classic</p>
                <p className="text-xs text-fg-muted">Centered rule, shaded item rows</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, pdfTemplate: "modern" })}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  form.pdfTemplate === "modern" ? "border-brand-600" : "border-border hover:border-border-strong"
                }`}
              >
                <div className="mb-2 flex overflow-hidden rounded border border-border bg-surface-hover p-2">
                  <div className="mr-2 w-1 shrink-0 rounded" style={{ backgroundColor: form.brandColor }} />
                  <div className="flex-1">
                    <div className="mb-1 h-1 w-full rounded bg-border-strong" />
                    <div className="mb-0.5 h-1 w-3/4 rounded bg-border" />
                    <div className="h-1 w-2/3 rounded bg-border" />
                  </div>
                </div>
                <p className="text-sm font-medium text-fg">Modern</p>
                <p className="text-xs text-fg-muted">Accent bar, boxed totals panel</p>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="taxId">Tax ID</Label>
              <Input id="taxId" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prefix">Invoice number prefix</Label>
              <Input
                id="prefix"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="quotePrefix">Quote number prefix</Label>
              <Input
                id="quotePrefix"
                value={form.quotePrefix}
                onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="taxRate">Default tax rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                step="0.01"
                value={form.defaultTaxRate}
                onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="paymentTerms">Default payment terms</Label>
              <Input
                id="paymentTerms"
                placeholder="e.g. Net 30"
                value={form.defaultPaymentTerms}
                onChange={(e) => setForm({ ...form, defaultPaymentTerms: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Default notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.defaultNotes}
                onChange={(e) => setForm({ ...form, defaultNotes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Late fees</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="mb-0">Charge a fee on overdue invoices</Label>
                <p className="text-xs text-fg-muted">
                  {form.lateFeeEnabled
                    ? "A late fee line item is added automatically once an invoice has been overdue past the grace period."
                    : "Overdue invoices will not be charged a late fee."}
                </p>
              </div>
              <Switch
                checked={form.lateFeeEnabled}
                onCheckedChange={(checked) => setForm({ ...form, lateFeeEnabled: checked })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="lateFeeType">Fee type</Label>
                <Select
                  value={form.lateFeeType}
                  onValueChange={(v) => setForm({ ...form, lateFeeType: v as "FLAT" | "PERCENT" })}
                >
                  <SelectTrigger id="lateFeeType" disabled={!form.lateFeeEnabled}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAT">Flat amount ($)</SelectItem>
                    <SelectItem value="PERCENT">Percent of subtotal (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lateFeeValue">{form.lateFeeType === "PERCENT" ? "Fee (%)" : "Fee ($)"}</Label>
                <Input
                  id="lateFeeValue"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.lateFeeValue}
                  onChange={(e) => setForm({ ...form, lateFeeValue: Number(e.target.value) })}
                  disabled={!form.lateFeeEnabled}
                />
              </div>
              <div>
                <Label htmlFor="lateFeeGraceDays">Grace period (days)</Label>
                <Input
                  id="lateFeeGraceDays"
                  type="number"
                  min={0}
                  step="1"
                  value={form.lateFeeGraceDays}
                  onChange={(e) => setForm({ ...form, lateFeeGraceDays: Number(e.target.value) })}
                  disabled={!form.lateFeeEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="self-start" disabled={updateOrg.isPending}>
          Save changes
        </Button>
      </form>
    </div>
  );
}
