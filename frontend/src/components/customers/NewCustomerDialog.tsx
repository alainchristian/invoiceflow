import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useCreateCustomer } from "@/hooks/useCustomers";
import type { Customer } from "@/types";

export function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const createCustomer = useCreateCustomer();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const customer = await createCustomer.mutateAsync({ name, email, phone });
    onCreated(customer);
    setName("");
    setEmail("");
    setPhone("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="cname">Customer name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cemail">Email</Label>
            <Input id="cemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cphone">Phone</Label>
            <Input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={createCustomer.isPending} className="mt-2 self-end">
            Add customer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
