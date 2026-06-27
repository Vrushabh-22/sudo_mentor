import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Settings = Record<string, any>;

const KEYS = ["azure_openai", "llm_default", "google_oauth", "branding"] as const;

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("key,value").in("key", KEYS as any);
      const map: Settings = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value || {}; });
      setSettings(map);
      setLoading(false);
    })();
  }, []);

  const setField = (key: string, field: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
  };

  const save = async (key: string) => {
    setSavingKey(key);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: settings[key] || {}, updated_by: session?.user?.id || null });
    setSavingKey(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `${key} updated.` });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const azure = settings.azure_openai || {};
  const llm = settings.llm_default || {};
  const google = settings.google_oauth || {};
  const branding = settings.branding || {};

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Azure OpenAI</CardTitle>
          <CardDescription>Non-secret connection details. API key is stored as an edge-function secret.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Endpoint</Label><Input value={azure.endpoint || ""} onChange={(e) => setField("azure_openai", "endpoint", e.target.value)} placeholder="https://my-resource.openai.azure.com" /></div>
          <div><Label>Deployment</Label><Input value={azure.deployment || ""} onChange={(e) => setField("azure_openai", "deployment", e.target.value)} placeholder="gpt-4o-mini" /></div>
          <div><Label>API version</Label><Input value={azure.api_version || ""} onChange={(e) => setField("azure_openai", "api_version", e.target.value)} /></div>
          <Button onClick={() => save("azure_openai")} disabled={savingKey === "azure_openai"}>
            {savingKey === "azure_openai" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
          </Button>
          <p className="text-xs text-muted-foreground">
            API key: ask the developer to store <code>AZURE_OPENAI_API_KEY</code> as an edge-function secret.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default LLM</CardTitle>
          <CardDescription>Used by Mentor, Practice and Project evaluation when no per-feature override is set.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Provider</Label><Input value={llm.provider || ""} onChange={(e) => setField("llm_default", "provider", e.target.value)} placeholder="azure_openai | openai | lovable" /></div>
          <div><Label>Model</Label><Input value={llm.model || ""} onChange={(e) => setField("llm_default", "model", e.target.value)} placeholder="gpt-4o-mini" /></div>
          <div><Label>Temperature</Label><Input type="number" step="0.1" value={llm.temperature ?? 0.3} onChange={(e) => setField("llm_default", "temperature", Number(e.target.value))} /></div>
          <Button onClick={() => save("llm_default")} disabled={savingKey === "llm_default"}>
            {savingKey === "llm_default" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google OAuth</CardTitle>
          <CardDescription>Client ID for candidate Google sign-in. Secret is configured in Supabase dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Client ID</Label><Input value={google.client_id || ""} onChange={(e) => setField("google_oauth", "client_id", e.target.value)} /></div>
          <Button onClick={() => save("google_oauth")} disabled={savingKey === "google_oauth"}>
            {savingKey === "google_oauth" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>App name and logo shown to candidates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={branding.name || ""} onChange={(e) => setField("branding", "name", e.target.value)} /></div>
          <div><Label>Logo URL</Label><Input value={branding.logo_url || ""} onChange={(e) => setField("branding", "logo_url", e.target.value)} /></div>
          <Button onClick={() => save("branding")} disabled={savingKey === "branding"}>
            {savingKey === "branding" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
