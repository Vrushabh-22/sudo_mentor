import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Plus, Trash2, RefreshCw, KeyRound, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AzureStorageSettings } from "./AzureStorageSettings";

type Provider = {
  id: string;
  slug: string;
  display_name: string;
  base_url: string | null;
  default_model: string | null;
  config: Record<string, any>;
  enabled: boolean;
  is_active: boolean;
};

type ApiKey = {
  id: string;
  provider_id: string;
  label: string;
  key_last4: string;
  enabled: boolean;
  weight: number;
  last_used_at: string | null;
  use_count: number;
  fail_count: number;
  cooldown_until: string | null;
};

const APP_SETTINGS_KEYS = ["google_oauth", "branding"] as const;

export function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newWeight, setNewWeight] = useState(1);
  const [testing, setTesting] = useState(false);
  const [appSettings, setAppSettings] = useState<Record<string, any>>({});
  const [savingAppKey, setSavingAppKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: provs }, { data: appData }] = await Promise.all([
      supabase.from("llm_providers").select("*").order("display_name"),
      supabase.from("app_settings").select("key,value").in("key", APP_SETTINGS_KEYS as any),
    ]);
    const list = (provs || []) as Provider[];
    setProviders(list);
    const active = list.find((p) => p.is_active);
    setActiveId(active?.id || list[0]?.id || null);
    const map: Record<string, any> = {};
    (appData || []).forEach((r: any) => { map[r.key] = r.value || {}; });
    setAppSettings(map);
    await refreshKeys();
    setLoading(false);
  }, []);

  const refreshKeys = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-llm-keys", { body: { action: "list" } });
    if (error) { toast({ title: "Failed to load keys", description: error.message, variant: "destructive" }); return; }
    setKeys((data?.keys || []) as ApiKey[]);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const active = providers.find((p) => p.id === activeId);
  const activeKeys = keys.filter((k) => k.provider_id === activeId);

  const setActive = async (id: string) => {
    setActiveId(id);
    const { error } = await supabase.rpc("llm_set_active_provider", { _provider_id: id });
    if (error) toast({ title: "Failed to switch provider", description: error.message, variant: "destructive" });
    else { toast({ title: "Active provider updated" }); load(); }
  };

  const updateActive = (patch: Partial<Provider>) => {
    if (!active) return;
    setProviders((prev) => prev.map((p) => (p.id === active.id ? { ...p, ...patch } : p)));
  };

  const updateActiveConfig = (field: string, value: any) => {
    if (!active) return;
    updateActive({ config: { ...(active.config || {}), [field]: value } });
  };

  const saveProvider = async () => {
    if (!active) return;
    setSavingProvider(true);
    const { error } = await supabase.from("llm_providers").update({
      base_url: active.base_url,
      default_model: active.default_model,
      config: active.config,
    }).eq("id", active.id);
    setSavingProvider(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Provider settings saved" });
  };

  const addKey = async () => {
    if (!active || !newLabel || !newKey) return;
    const { data, error } = await supabase.functions.invoke("admin-llm-keys", {
      body: { action: "create", provider_id: active.id, label: newLabel, api_key: newKey, weight: newWeight },
    });
    if (error || !data?.ok) {
      toast({ title: "Add failed", description: error?.message || data?.error || "error", variant: "destructive" });
      return;
    }
    setAddOpen(false); setNewLabel(""); setNewKey(""); setNewWeight(1);
    toast({ title: "Key added" });
    refreshKeys();
  };

  const toggleKey = async (k: ApiKey, enabled: boolean) => {
    setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, enabled } : x)));
    await supabase.functions.invoke("admin-llm-keys", { body: { action: "update", id: k.id, enabled } });
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this key?")) return;
    await supabase.functions.invoke("admin-llm-keys", { body: { action: "delete", id } });
    refreshKeys();
  };

  const clearCooldown = async (id: string) => {
    await supabase.functions.invoke("admin-llm-keys", { body: { action: "clear_cooldown", id } });
    refreshKeys();
  };

  const testCall = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("llm-caller", {
      body: {
        feature: "admin.test", mode: "chat",
        messages: [{ role: "user", content: "Reply with the single word: pong" }],
        max_tokens: 10,
      },
    });
    setTesting(false);
    if (error || !data?.ok) {
      toast({ title: "Test failed", description: error?.message || data?.error || "error", variant: "destructive" });
    } else {
      toast({ title: `OK (${data.provider} / ${data.model})`, description: data.text });
      refreshKeys();
    }
  };

  const saveAppSetting = async (key: string) => {
    setSavingAppKey(key);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("app_settings").upsert({
      key, value: appSettings[key] || {}, updated_by: session?.user?.id || null,
    });
    setSavingAppKey(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  };

  const setAppField = (key: string, field: string, value: any) =>
    setAppSettings((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> LLM Provider</CardTitle>
          <CardDescription>
            Select one active provider. All AI calls across the portal route through it via the central <code>llm-caller</code> function with round-robin across the key pool below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  p.id === activeId ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                }`}
              >
                {p.display_name}{p.is_active ? " • active" : ""}
              </button>
            ))}
          </div>

          {active && (
            <div className="grid gap-3 md:grid-cols-2 pt-2">
              <div>
                <Label>Base URL</Label>
                <Input value={active.base_url || ""} onChange={(e) => updateActive({ base_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Default model</Label>
                <Input value={active.default_model || ""} onChange={(e) => updateActive({ default_model: e.target.value })} placeholder="gpt-4o-mini" />
              </div>
              {active.slug === "azure_openai" && (
                <>
                  <div>
                    <Label>Deployment</Label>
                    <Input value={active.config?.deployment || ""} onChange={(e) => updateActiveConfig("deployment", e.target.value)} placeholder="my-deployment" />
                  </div>
                  <div>
                    <Label>API version</Label>
                    <Input value={active.config?.api_version || ""} onChange={(e) => updateActiveConfig("api_version", e.target.value)} placeholder="2024-08-01-preview" />
                  </div>
                </>
              )}
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={saveProvider} disabled={savingProvider}>
                  {savingProvider ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save provider
                </Button>
                <Button variant="secondary" onClick={testCall} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />} Test call
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API Key Pool</CardTitle>
            <CardDescription>
              Multiple keys for the selected provider. The gateway picks one per request via least-recently-used round-robin, auto-cools failing keys, and retries the next.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={refreshKeys}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add key</Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No keys yet for this provider — add one to start serving AI calls.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Label</th>
                    <th className="text-left py-2 px-2">Key</th>
                    <th className="text-left py-2 px-2">On</th>
                    <th className="text-left py-2 px-2">Used</th>
                    <th className="text-left py-2 px-2">Fails</th>
                    <th className="text-left py-2 px-2">Last used</th>
                    <th className="text-left py-2 px-2">Cooldown</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((k) => {
                    const cooling = k.cooldown_until && new Date(k.cooldown_until) > new Date();
                    return (
                      <tr key={k.id} className="border-b last:border-0">
                        <td className="py-2 px-2 font-medium">{k.label}</td>
                        <td className="py-2 px-2 font-mono">••••{k.key_last4}</td>
                        <td className="py-2 px-2"><Switch checked={k.enabled} onCheckedChange={(v) => toggleKey(k, v)} /></td>
                        <td className="py-2 px-2">{k.use_count}</td>
                        <td className="py-2 px-2">{k.fail_count}</td>
                        <td className="py-2 px-2 text-xs">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</td>
                        <td className="py-2 px-2">
                          {cooling ? (
                            <button onClick={() => clearCooldown(k.id)} className="text-xs text-amber-600 underline">
                              until {new Date(k.cooldown_until!).toLocaleTimeString()} (clear)
                            </button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)}><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AzureStorageSettings />

      <div className="grid gap-6 md:grid-cols-2">

        <Card>
          <CardHeader>
            <CardTitle>Google OAuth</CardTitle>
            <CardDescription>Client ID for candidate Google sign-in. Secret is configured in Supabase dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Client ID</Label>
              <Input value={appSettings.google_oauth?.client_id || ""} onChange={(e) => setAppField("google_oauth", "client_id", e.target.value)} />
            </div>
            <Button onClick={() => saveAppSetting("google_oauth")} disabled={savingAppKey === "google_oauth"}>
              {savingAppKey === "google_oauth" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>App name and logo shown to candidates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={appSettings.branding?.name || ""} onChange={(e) => setAppField("branding", "name", e.target.value)} />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={appSettings.branding?.logo_url || ""} onChange={(e) => setAppField("branding", "logo_url", e.target.value)} />
            </div>
            <Button onClick={() => saveAppSetting("branding")} disabled={savingAppKey === "branding"}>
              {savingAppKey === "branding" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add API key for {active?.display_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Label</Label><Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="prod-key-1" /></div>
            <div>
              <Label>API key</Label>
              <Input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="sk-..." autoComplete="off" />
              <p className="text-xs text-muted-foreground mt-1">Encrypted server-side. Only the last 4 chars are shown after saving.</p>
            </div>
            <div><Label>Weight</Label><Input type="number" min={1} value={newWeight} onChange={(e) => setNewWeight(Number(e.target.value) || 1)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addKey} disabled={!newLabel || !newKey}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
