import { useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { useProducts, useCreateProduct, useDeleteProduct } from "@/hooks/useProducts";
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
import { formatCurrency } from "@/lib/utils";

export default function Products() {
  const { data: products = [], isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"PRODUCT" | "SERVICE">("SERVICE");
  const [defaultPrice, setDefaultPrice] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [sku, setSku] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createProduct.mutateAsync({
      name,
      type,
      defaultPrice: Number(defaultPrice),
      taxRate: Number(taxRate),
      sku: sku || undefined,
    });
    toast.success("Item added to catalog");
    setName("");
    setDefaultPrice("0");
    setTaxRate("0");
    setSku("");
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Products & Services"
        subtitle="Reusable items you can drop straight into an invoice."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add item
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
          ) : products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products or services yet"
              description="Save items you invoice for often so you can add them to an invoice in one click."
              action={<Button onClick={() => setOpen(true)}>Add item</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Type</TH>
                  <TH>Price</TH>
                  <TH>Tax</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {products.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <p className="font-medium">{p.name}</p>
                      {p.sku && <p className="text-xs text-fg-muted">SKU: {p.sku}</p>}
                    </TD>
                    <TD>
                      <Badge variant={p.type === "PRODUCT" ? "info" : "brand"}>{p.type.toLowerCase()}</Badge>
                    </TD>
                    <TD>{formatCurrency(p.defaultPrice)}</TD>
                    <TD>{p.taxRate}%</TD>
                    <TD>
                      <button
                        onClick={async () => {
                          await deleteProduct.mutateAsync(p.id);
                          toast.success("Item removed");
                        }}
                        className="text-fg-muted hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
            <DialogTitle>Add product or service</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="pname">Name</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ptype">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as "PRODUCT" | "SERVICE")}>
                  <SelectTrigger id="ptype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE">Service</SelectItem>
                    <SelectItem value="PRODUCT">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sku">SKU (optional)</Label>
                <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Default price</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tax">Tax rate (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  min={0}
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="self-end" disabled={createProduct.isPending}>
              Save item
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
