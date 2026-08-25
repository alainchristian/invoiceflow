import { useState } from "react";
import { Plus, Trash2, Copy, KeyRound, Webhook } from "lucide-react";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useWebhookEndpoints,
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
} from "@/hooks/useDeveloper";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { WEBHOOK_EVENTS } from "@/types";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString();
}

export default function SettingsDeveloper() {
  const toast = useToast();

  const { data: apiKeys = [], isLoading: keysLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const { data: endpoints = [], isLoading: endpointsLoading } = useWebhookEndpoints();
  const createEndpoint = useCreateWebhookEndpoint();
  const deleteEndpoint = useDeleteWebhookEndpoint();

  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    const result = await createApiKey.mutateAsync(keyName);
    setRevealedKey(result.key);
    setKeyName("");
  }

  function closeKeyDialog() {
    setKeyDialogOpen(false);
    setRevealedKey(null);
  }

  async function handleCreateEndpoint(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEvents.length === 0) {
      toast.error("Select at least one event");
      return;
    }
    await createEndpoint.mutateAsync({ url: endpointUrl, subscribedEvents: selectedEvents });
    toast.success("Webhook endpoint created");
    setEndpointUrl("");
    setSelectedEvents([]);
    setEndpointDialogOpen(false);
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Developer" subtitle="API keys and webhook endpoints for integrating with InvoiceFlow." />

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <Button onClick={() => setKeyDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Create key
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {keysLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : apiKeys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys yet"
              description="Create a key to authenticate requests to the InvoiceFlow API."
              action={<Button onClick={() => setKeyDialogOpen(true)}>Create key</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Key</TH>
                  <TH>Last used</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {apiKeys.map((k) => (
                  <TR key={k.id}>
                    <TD>{k.name}</TD>
                    <TD className="font-mono text-xs text-fg-muted">{k.keyPrefix}…</TD>
                    <TD>{formatDate(k.lastUsedAt)}</TD>
                    <TD>
                      {k.revokedAt ? (
                        <Badge variant="danger">Revoked</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TD>
                    <TD>
                      {!k.revokedAt && (
                        <button
                          onClick={async () => {
                            await revokeApiKey.mutateAsync(k.id);
                            toast.success("API key revoked");
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

      <Card>
        <CardHeader>
          <CardTitle>Webhook endpoints</CardTitle>
          <Button onClick={() => setEndpointDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add endpoint
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {endpointsLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : endpoints.length === 0 ? (
            <EmptyState
              icon={Webhook}
              title="No webhook endpoints yet"
              description="Add an endpoint to receive real-time notifications when invoices and quotes change."
              action={<Button onClick={() => setEndpointDialogOpen(true)}>Add endpoint</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>URL</TH>
                  <TH>Events</TH>
                  <TH>Secret</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {endpoints.map((ep) => (
                  <TR key={ep.id}>
                    <TD className="max-w-xs truncate">{ep.url}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {ep.subscribedEvents.map((event) => (
                          <Badge key={event} variant="info">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ep.secret);
                          toast.success("Signing secret copied");
                        }}
                        className="flex items-center gap-1 font-mono text-xs text-fg-muted hover:text-fg"
                      >
                        {ep.secret.slice(0, 12)}… <Copy className="h-3 w-3" />
                      </button>
                    </TD>
                    <TD>
                      <button
                        onClick={async () => {
                          await deleteEndpoint.mutateAsync(ep.id);
                          toast.success("Webhook endpoint removed");
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

      <Dialog open={keyDialogOpen} onOpenChange={(open) => (open ? setKeyDialogOpen(true) : closeKeyDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{revealedKey ? "API key created" : "Create API key"}</DialogTitle>
          </DialogHeader>
          {revealedKey ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-fg-secondary">
                Copy this key now — you won't be able to see it again.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-hover p-3">
                <code className="flex-1 break-all font-mono text-xs">{revealedKey}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(revealedKey);
                    toast.success("API key copied");
                  }}
                  className="shrink-0 text-fg-muted hover:text-fg"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <Button onClick={closeKeyDialog} className="self-end">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreateKey} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="keyname">Name</Label>
                <Input
                  id="keyname"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Zapier integration"
                  required
                />
              </div>
              <Button type="submit" className="self-end" disabled={createApiKey.isPending}>
                Create key
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={endpointDialogOpen} onOpenChange={setEndpointDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add webhook endpoint</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEndpoint} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="endpointurl">URL</Label>
              <Input
                id="endpointurl"
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://example.com/webhooks/invoiceflow"
                required
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-1 flex flex-col gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm text-fg-secondary">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="h-4 w-4 rounded border-border"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="self-end" disabled={createEndpoint.isPending}>
              Add endpoint
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
