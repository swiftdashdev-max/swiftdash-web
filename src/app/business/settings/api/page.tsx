'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserContext } from '@/lib/supabase/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Key, Plus, Trash2, Copy, CheckCheck, Webhook, Eye, EyeOff,
  RefreshCw, ShieldCheck, Loader2, ExternalLink, Clock, AlertTriangle, BookOpen,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  created_at: string;
}

const ALL_EVENTS = [
  'delivery.created',
  'delivery.driver_assigned',
  'delivery.pickup_arrived',
  'delivery.package_collected',
  'delivery.in_transit',
  'delivery.delivered',
  'delivery.cancelled',
  'delivery.failed',
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApiSettingsPage() {
  const { user, loading: userLoading } = useUserContext();
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);

  // New key dialog
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [newKeyRevealOpen, setNewKeyRevealOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Revoke confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null);

  // New webhook dialog
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookDesc, setNewWebhookDesc] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([...ALL_EVENTS]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookSecretOpen, setWebhookSecretOpen] = useState(false);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    const res = await fetch('/api/v1/keys');
    if (res.ok) {
      const { data } = await res.json();
      setApiKeys(data ?? []);
    }
    setLoadingKeys(false);
  }, []);

  const fetchWebhooks = useCallback(async () => {
    setLoadingWebhooks(true);
    const res = await fetch('/api/v1/webhooks');
    if (res.ok) {
      const { data } = await res.json();
      setWebhooks(data ?? []);
    }
    setLoadingWebhooks(false);
  }, []);

  useEffect(() => {
    if (!userLoading && user) {
      fetchKeys();
      fetchWebhooks();
    }
  }, [userLoading, user, fetchKeys, fetchWebhooks]);

  // ── API Key actions ─────────────────────────────────────────────────────────

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const json = await res.json();
    setCreatingKey(false);

    if (!res.ok) {
      toast({ title: 'Error', description: json.error, variant: 'destructive' });
      return;
    }

    setNewKeyName('');
    setNewKeyDialogOpen(false);
    setNewKeyValue(json.data.key);
    setNewKeyRevealOpen(true);
    fetchKeys();
  };

  const handleRevokeKey = async (id: string) => {
    const res = await fetch(`/api/v1/keys/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'API key revoked' });
      fetchKeys();
    } else {
      const json = await res.json();
      toast({ title: 'Error', description: json.error, variant: 'destructive' });
    }
    setRevokeId(null);
  };

  const copyKey = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // ── Webhook actions ─────────────────────────────────────────────────────────

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0) return;
    setCreatingWebhook(true);
    const res = await fetch('/api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: newWebhookUrl.trim(),
        events: newWebhookEvents,
        description: newWebhookDesc.trim() || undefined,
      }),
    });
    const json = await res.json();
    setCreatingWebhook(false);

    if (!res.ok) {
      toast({ title: 'Error', description: json.error, variant: 'destructive' });
      return;
    }

    setWebhookDialogOpen(false);
    setNewWebhookUrl('');
    setNewWebhookDesc('');
    setNewWebhookEvents([...ALL_EVENTS]);
    setWebhookSecret(json.data.secret);
    setWebhookSecretOpen(true);
    fetchWebhooks();
  };

  const handleToggleWebhook = async (id: string, is_active: boolean) => {
    const res = await fetch(`/api/v1/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    if (res.ok) fetchWebhooks();
  };

  const handleDeleteWebhook = async (id: string) => {
    const res = await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Webhook removed' });
      fetchWebhooks();
    }
    setDeleteWebhookId(null);
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          API & Webhooks
        </h1>
        <p className="text-muted-foreground mt-1">
          Integrate SwiftDash into your own systems using API keys and webhook events.
        </p>
      </div>

      {/* Quick-start banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">Getting started</p>
            <p className="text-muted-foreground">
              Add <code className="bg-muted px-1 rounded text-xs">x-api-key: YOUR_KEY</code> to every request.
              Base URL: <code className="bg-muted px-1 rounded text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1</code>
            </p>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-primary hover:underline font-medium"
            >
              View full API documentation
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── API Keys section ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4" /> API Keys
            </CardTitle>
            <CardDescription>Keys are hashed — the raw value is shown once at creation.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setNewKeyDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Key
          </Button>
        </CardHeader>

        <CardContent>
          {loadingKeys ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No API keys yet.</p>
          ) : (
            <ul className="divide-y">
              {apiKeys.map((k) => (
                <li key={k.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {k.key_prefix}••••••••••••••••
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {k.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-500 border-red-300 text-xs">Revoked</Badge>
                      )}
                      {k.last_used_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last used {formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  {k.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRevokeId(k.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Webhooks section ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4 w-4" /> Webhooks
            </CardTitle>
            <CardDescription>
              Receive real-time POST requests when delivery statuses change.
              Payloads are signed with <code className="text-xs bg-muted px-1 rounded">HMAC-SHA256</code>.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setWebhookDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Endpoint
          </Button>
        </CardHeader>

        <CardContent>
          {loadingWebhooks ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No webhooks configured.</p>
          ) : (
            <ul className="divide-y">
              {webhooks.map((wh) => (
                <li key={wh.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm truncate">{wh.url}</p>
                    {wh.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{wh.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {wh.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={wh.is_active}
                      onCheckedChange={(v) => handleToggleWebhook(wh.id, v)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteWebhookId(wh.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Endpoint reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" /> Endpoint Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th className="text-left pb-2 pr-4">Method</th>
                  <th className="text-left pb-2 pr-4">Path</th>
                  <th className="text-left pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['GET',    '/api/v1/vehicles',        'List available vehicle types & pricing'],
                  ['GET',    '/api/v1/deliveries',      'List your deliveries (supports ?status, ?limit, ?offset, ?from, ?to)'],
                  ['POST',   '/api/v1/deliveries',      'Create a new delivery'],
                  ['GET',    '/api/v1/deliveries/:id',  'Get delivery details'],
                  ['DELETE', '/api/v1/deliveries/:id',  'Cancel a delivery'],
                  ['GET',    '/api/v1/webhooks',        'List registered webhooks'],
                  ['POST',   '/api/v1/webhooks',        'Register a new webhook'],
                  ['PATCH',  '/api/v1/webhooks/:id',    'Update webhook (url / events / is_active)'],
                  ['DELETE', '/api/v1/webhooks/:id',    'Remove a webhook'],
                ].map(([method, path, desc]) => (
                  <tr key={path! + method}>
                    <td className="py-2 pr-4">
                      <Badge
                        variant="outline"
                        className={
                          method === 'GET'    ? 'border-blue-300 text-blue-600' :
                          method === 'POST'   ? 'border-green-300 text-green-600' :
                          method === 'PATCH'  ? 'border-yellow-400 text-yellow-600' :
                          'border-red-300 text-red-600'
                        }
                      >
                        {method}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{path}</td>
                    <td className="py-2 text-muted-foreground text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Create API key */}
      <Dialog open={newKeyDialogOpen} onOpenChange={setNewKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Give this key a memorable name (e.g. "Production", "Test").</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="keyname">Key name</Label>
            <Input
              id="keyname"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Production"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewKeyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
              {creatingKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show raw key once */}
      <Dialog open={newKeyRevealOpen} onOpenChange={setNewKeyRevealOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCheck className="h-5 w-5" /> API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy this key now — it will <strong>not</strong> be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 flex items-center gap-2 font-mono text-xs break-all">
            <span className="flex-1">{newKeyValue}</span>
            <Button variant="ghost" size="sm" onClick={() => newKeyValue && copyKey(newKeyValue)}>
              {copiedKey ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setNewKeyRevealOpen(false); setNewKeyValue(null); }}>
              I've saved it, close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Revoke API Key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Any systems using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeId && handleRevokeKey(revokeId)}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add webhook */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>
              SwiftDash will POST signed JSON to this URL when selected events occur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>HTTPS URL</Label>
              <Input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://yourapp.com/webhooks/swiftdash"
              />
            </div>
            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={newWebhookDesc}
                onChange={(e) => setNewWebhookDesc(e.target.value)}
                placeholder="Production order updates"
              />
            </div>
            <div className="space-y-2">
              <Label>Events to subscribe</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newWebhookEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    <span className="font-mono text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={creatingWebhook || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
            >
              {creatingWebhook && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show webhook secret once */}
      <Dialog open={webhookSecretOpen} onOpenChange={setWebhookSecretOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCheck className="h-5 w-5" /> Webhook Registered
            </DialogTitle>
            <DialogDescription>
              Use this secret to verify the <code className="text-xs bg-muted px-1 rounded">x-swiftdash-signature</code> header.
              It will <strong>not</strong> be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 font-mono text-xs break-all">
            {webhookSecret}
          </div>
          <DialogFooter>
            <Button onClick={() => { setWebhookSecretOpen(false); setWebhookSecret(null); }}>
              I've saved it, close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete webhook confirmation */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={(o) => !o && setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This endpoint will stop receiving events immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteWebhookId && handleDeleteWebhook(deleteWebhookId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
