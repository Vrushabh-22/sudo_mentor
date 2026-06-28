import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Cloud, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Account = {
  id: string;
  label: string;
  account_name: string;
  connection_last4: string;
  is_active: boolean;
  enabled: boolean;
};
type Container = {
  id: string;
  account_id: string;
  purpose: string;
  container_name: string;
  public_read: boolean;
  enabled: boolean;
};

const KNOWN_PURPOSES = [
  "resume_upload",
  "note_cover",
  "project_artifact",
  "interview_audio",
  "profile_avatar",
];

export function AzureStorageSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);

  // account form
  const [label, setLabel] = useState("Primary");
  const [connStr, setConnStr] = useState("");
  const [saving, setSaving] = useState(false);

  // container dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Container | null>(null);
  const [cPurpose, setCPurpose] = useState(KNOWN_PURPOSES[0]);
  const [cName, setCName] = useState("");
  const [cPublic, setCPublic] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-azure-storage", { body: { action: "list" } });
    setLoading(false);
    if (error) { toast({ title: "Failed to load", description: error.message, variant: "destructive" }); return; }
    setAccount(data?.account || null);
    setContainers(data?.containers || []);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const saveAccount = async () => {
    if (!connStr) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-azure-storage", {
      body: { action: "set_account", label, connection_string: connStr },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast({ title: "Save failed", description: error?.message || data?.error || "error", variant: "destructive" });
      return;
    }
    setConnStr("");
    toast({ title: "Azure account saved", description: data.account_name });
    load();
  };

  const openAdd = () => { setEditing(null); setCPurpose(KNOWN_PURPOSES[0]); setCName(""); setCPublic(false); setOpen(true); };
  const openEdit = (c: Container) => { setEditing(c); setCPurpose(c.purpose); setCName(c.container_name); setCPublic(c.public_read); setOpen(true); };

  const saveContainer = async () => {
    if (!account) return;
    if (editing) {
      const { error } = await supabase.functions.invoke("admin-azure-storage", {
        body: { action: "update_container", id: editing.id, container_name: cName, public_read: cPublic },
      });
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.functions.invoke("admin-azure-storage", {
        body: { action: "upsert_container", account_id: account.id, purpose: cPurpose, container_name: cName, public_read: cPublic },
      });
      if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    }
    setOpen(false);
    toast({ title: "Container saved" });
    load();
  };

  const toggleContainer = async (c: Container, enabled: boolean) => {
    setContainers((p) => p.map((x) => x.id === c.id ? { ...x, enabled } : x));
    await supabase.functions.invoke("admin-azure-storage", { body: { action: "update_container", id: c.id, enabled } });
  };

  const deleteContainer = async (id: string) => {
    if (!confirm("Delete this container mapping?")) return;
    await supabase.functions.invoke("admin-azure-storage", { body: { action: "delete_container", id } });
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" /> Azure Blob Storage</CardTitle>
          <CardDescription>
            One active storage account, many containers per purpose. Edge functions resolve & cache settings in-process (60s TTL) so candidate uploads don't hit the DB on every request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{account.label} · {account.account_name}</div>
                  <div className="text-xs text-muted-foreground">Connection ••••{account.connection_last4}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">active</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No account configured yet.</p>
          )}

          <div className="grid gap-3 md:grid-cols-3 pt-1">
            <div>
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Primary" />
            </div>
            <div className="md:col-span-2">
              <Label>Connection string</Label>
              <Input type="password" autoComplete="off" value={connStr} onChange={(e) => setConnStr(e.target.value)} placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net" />
              <p className="text-xs text-muted-foreground mt-1">Encrypted server-side. Replacing it deactivates the previous account.</p>
            </div>
          </div>
          <Button onClick={saveAccount} disabled={!connStr || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {account ? "Replace account" : "Save account"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Container mappings</CardTitle>
            <CardDescription>One container per purpose (e.g. <code>resume_upload</code>). Edge functions request a purpose, get a container.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={openAdd} disabled={!account}><Plus className="h-4 w-4 mr-2" /> Add container</Button>
          </div>
        </CardHeader>
        <CardContent>
          {containers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No containers yet — add one for <code>resume_upload</code> to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Purpose</th>
                    <th className="text-left py-2 px-2">Container</th>
                    <th className="text-left py-2 px-2">Public read</th>
                    <th className="text-left py-2 px-2">On</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 px-2 font-mono">{c.purpose}</td>
                      <td className="py-2 px-2">{c.container_name}</td>
                      <td className="py-2 px-2">{c.public_read ? "yes" : "no"}</td>
                      <td className="py-2 px-2"><Switch checked={c.enabled} onCheckedChange={(v) => toggleContainer(c, v)} /></td>
                      <td className="py-2 px-2 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteContainer(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit container" : "Add container"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Purpose</Label>
              {editing ? (
                <Input value={cPurpose} disabled />
              ) : (
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={cPurpose} onChange={(e) => setCPurpose(e.target.value)}>
                  {KNOWN_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </div>
            <div>
              <Label>Container name</Label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="resumes" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={cPublic} onCheckedChange={setCPublic} id="pubread" />
              <Label htmlFor="pubread" className="!mt-0">Public read</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveContainer} disabled={!cName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
