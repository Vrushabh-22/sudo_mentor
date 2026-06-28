import { useEffect, useState, useCallback, useRef } from "react";
import { practiceAdmin } from "@/lib/practiceClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Trash2, Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Kind, KIND_LABELS, TEMPLATES, downloadTemplate, parseRows, readWorkbook, ParsedRow,
} from "./practice/QuestionTemplates";

type Pillar = { id: string; slug: string; name: string; icon: string | null; color: string | null; sort_order: number; enabled: boolean; is_stream_aware: boolean; description: string | null };
type Subtopic = {
  id: string; pillar_id: string; slug: string; name: string; sort_order: number;
  default_difficulty: string; default_kind: string; time_budget_seconds: number;
  enabled: boolean; description: string | null;
  enabled_kinds: string[]; target_counts: Record<string, number>;
};
type Item = { id: string; subtopic_id: string; kind: string; payload: any; status: string; source: string; difficulty: string; stream_tag: string | null };

const ALL_KINDS: Kind[] = ["mcq", "scenario", "true_false", "fill_blanks", "subjective", "speech", "ordering"];

export function PracticeContentSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [activeSub, setActiveSub] = useState<Subtopic | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const loadPillars = useCallback(async () => {
    setLoading(true);
    const { data } = await practiceAdmin<{ pillars: Pillar[] }>({ action: "list_pillars" });
    setPillars(data?.pillars || []);
    if (data?.pillars?.length && !activePillar) setActivePillar(data.pillars[0]);
    setLoading(false);
  }, [activePillar]);

  useEffect(() => { loadPillars(); }, []); // eslint-disable-line

  const loadSubtopics = useCallback(async (pid: string) => {
    const { data } = await practiceAdmin<{ subtopics: Subtopic[] }>({ action: "list_subtopics", pillar_id: pid });
    setSubtopics((data?.subtopics || []).map((s) => ({ ...s, enabled_kinds: s.enabled_kinds || [], target_counts: s.target_counts || {} })));
    setActiveSub(null); setItems([]);
  }, []);

  useEffect(() => { if (activePillar) loadSubtopics(activePillar.id); }, [activePillar, loadSubtopics]);

  const loadItems = useCallback(async (s: Subtopic) => {
    setActiveSub(s);
    const { data } = await practiceAdmin<{ items: Item[] }>({ action: "list_items", subtopic_id: s.id });
    setItems(data?.items || []);
  }, []);

  const upsertPillar = async (patch: Partial<Pillar>) => {
    if (!activePillar) return;
    const merged = { ...activePillar, ...patch };
    const { data } = await practiceAdmin<{ pillar: Pillar }>({ action: "upsert_pillar", pillar: merged });
    if (data?.pillar) { setActivePillar(data.pillar); setPillars((ps) => ps.map((p) => p.id === data.pillar.id ? data.pillar : p)); }
  };

  const addSubtopic = async () => {
    if (!activePillar) return;
    const n = window.prompt("Subtopic name?", "New subtopic"); if (!n) return;
    const slug = n.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const { data } = await practiceAdmin<{ subtopic: Subtopic }>({
      action: "upsert_subtopic",
      subtopic: { pillar_id: activePillar.id, name: n, slug, sort_order: subtopics.length * 10, default_kind: "mcq", default_difficulty: "medium", time_budget_seconds: 180, enabled: true, enabled_kinds: ["mcq"], target_counts: { mcq: 20 } },
    });
    if (data?.subtopic) setSubtopics((xs) => [...xs, { ...data.subtopic, enabled_kinds: data.subtopic.enabled_kinds || [], target_counts: data.subtopic.target_counts || {} }]);
  };

  const updateSub = async (s: Subtopic, patch: Partial<Subtopic>) => {
    const { data } = await practiceAdmin<{ subtopic: Subtopic }>({ action: "upsert_subtopic", subtopic: { ...s, ...patch } });
    if (data?.subtopic) {
      const merged = { ...data.subtopic, enabled_kinds: data.subtopic.enabled_kinds || [], target_counts: data.subtopic.target_counts || {} };
      setSubtopics((xs) => xs.map((x) => x.id === s.id ? merged : x));
      if (activeSub?.id === s.id) setActiveSub(merged);
    }
  };

  const delSub = async (id: string) => {
    if (!confirm("Delete subtopic and all its items?")) return;
    await practiceAdmin({ action: "delete_subtopic", id });
    setSubtopics((xs) => xs.filter((x) => x.id !== id));
    if (activeSub?.id === id) { setActiveSub(null); setItems([]); }
  };

  const reloadItems = async () => { if (activeSub) await loadItems(activeSub); };

  const toggleStatus = async (it: Item) => {
    const next = it.status === "approved" ? "draft" : "approved";
    await practiceAdmin({ action: "set_item_status", id: it.id, status: next });
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, status: next } : x));
  };

  const delItem = async (id: string) => {
    if (!confirm("Delete item?")) return;
    await practiceAdmin({ action: "delete_item", id });
    setItems((xs) => xs.filter((x) => x.id !== id));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Practice Content</h2>
        <p className="text-sm text-muted-foreground">Pillars → Subtopics → Question Bank. Approved items power the daily workout.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_240px_1fr]">
        {/* Pillars */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pillars</CardTitle></CardHeader>
          <CardContent className="p-2">
            <ul className="space-y-1">
              {pillars.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setActivePillar(p)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm ${activePillar?.id === p.id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                  >
                    <span>{p.icon || "•"}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    {!p.enabled && <span className="text-[10px] text-muted-foreground">off</span>}
                  </button>
                </li>
              ))}
            </ul>
            {activePillar && (
              <div className="border-t mt-2 pt-2 space-y-2 px-1">
                <div className="flex items-center justify-between text-xs">
                  <span>Enabled</span>
                  <Switch checked={activePillar.enabled} onCheckedChange={(v) => upsertPillar({ enabled: v })} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Stream-aware</span>
                  <Switch checked={activePillar.is_stream_aware} onCheckedChange={(v) => upsertPillar({ is_stream_aware: v })} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subtopics */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Subtopics</CardTitle>
            <Button size="sm" variant="ghost" onClick={addSubtopic} disabled={!activePillar}><Plus className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-2">
            {subtopics.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No subtopics yet. Add one →</p>
            ) : (
              <ul className="space-y-1">
                {subtopics.map((s) => (
                  <li key={s.id} className={`flex items-center gap-1 px-1 rounded ${activeSub?.id === s.id ? "bg-muted" : ""}`}>
                    <button onClick={() => loadItems(s)} className="flex-1 text-left text-sm py-1.5 truncate">{s.name}</button>
                    <button onClick={() => delSub(s.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right pane */}
        <div className="space-y-4 min-w-0">
          {!activeSub ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a subtopic to configure question types and upload questions.</CardContent></Card>
          ) : (
            <>
              <QuestionTypesCard subtopic={activeSub} onSave={(patch) => updateSub(activeSub, patch)} items={items} />
              <UploadCard subtopic={activeSub} onImported={reloadItems} />
              <ItemBankCard items={items} subtopic={activeSub} onToggle={toggleStatus} onDelete={delItem} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Question Types card ------------------------- */
function QuestionTypesCard({ subtopic, onSave, items }: {
  subtopic: Subtopic; onSave: (p: Partial<Subtopic>) => Promise<void>; items: Item[];
}) {
  const [enabled, setEnabled] = useState<string[]>(subtopic.enabled_kinds || []);
  const [targets, setTargets] = useState<Record<string, number>>(subtopic.target_counts || {});
  const [budget, setBudget] = useState<number>(subtopic.time_budget_seconds || 180);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setEnabled(subtopic.enabled_kinds || []);
    setTargets(subtopic.target_counts || {});
    setBudget(subtopic.time_budget_seconds || 180);
  }, [subtopic.id]); // eslint-disable-line

  const toggle = (k: Kind) => {
    setEnabled((xs) => xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]);
    setTargets((t) => ({ ...t, [k]: t[k] ?? 20 }));
  };

  const save = async () => {
    setSaving(true);
    await onSave({ enabled_kinds: enabled, target_counts: targets, time_budget_seconds: budget });
    setSaving(false);
    toast({ title: "Saved" });
  };

  const counts = (k: string) => items.filter((i) => i.kind === k && i.status === "approved").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Question types · {subtopic.name}</CardTitle>
        <CardDescription>Pick which question types this subtopic accepts and how many you aim to bank.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          {ALL_KINDS.map((k) => {
            const on = enabled.includes(k);
            const tgt = targets[k] ?? 0;
            const cur = counts(k);
            const pct = tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
            return (
              <div key={k} className={`border rounded-lg p-3 ${on ? "bg-muted/40" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" checked={on} onChange={() => toggle(k)} />
                    {KIND_LABELS[k]}
                  </label>
                  {on && (
                    <Input
                      type="number" min={0} className="h-7 w-20 text-xs"
                      value={tgt}
                      onChange={(e) => setTargets((t) => ({ ...t, [k]: Number(e.target.value) || 0 }))}
                    />
                  )}
                </div>
                {on && (
                  <>
                    <Progress value={pct} className="h-1.5 mt-1" />
                    <div className="text-[11px] text-muted-foreground mt-1">{cur} of {tgt} approved</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">Time budget per item (sec)</Label>
            <Input type="number" className="h-8 w-28" value={budget} onChange={(e) => setBudget(Number(e.target.value) || 180)} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------- Upload card ------------------------- */
function UploadCard({ subtopic, onImported }: { subtopic: Subtopic; onImported: () => Promise<void> }) {
  const { toast } = useToast();
  const enabledKinds = (subtopic.enabled_kinds || []) as Kind[];
  const [kind, setKind] = useState<Kind>(enabledKinds[0] || "mcq");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importStatus, setImportStatus] = useState<"draft" | "approved">("approved");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!enabledKinds.includes(kind) && enabledKinds[0]) setKind(enabledKinds[0]); }, [subtopic.id]); // eslint-disable-line

  if (enabledKinds.length === 0) {
    return (
      <Card><CardContent className="py-6 text-sm text-muted-foreground text-center">
        Enable at least one question type above to upload questions.
      </CardContent></Card>
    );
  }

  const onFile = async (f: File) => {
    try {
      const rows = await readWorkbook(f);
      const result = parseRows(kind, rows);
      setParsed(result);
      toast({ title: `Parsed ${result.length} rows`, description: `${result.filter((r) => r.valid).length} valid` });
    } catch (e: any) {
      toast({ title: "Parse failed", description: e.message, variant: "destructive" });
    }
  };

  const doImport = async () => {
    const valid = parsed.filter((r) => r.valid);
    if (valid.length === 0) { toast({ title: "Nothing to import" }); return; }
    setImporting(true);
    const { data, error } = await practiceAdmin<{ inserted: number; failed: number; errors: string[] }>({
      action: "bulk_insert_items",
      subtopic_id: subtopic.id,
      kind,
      status: importStatus,
      items: valid.map((r) => ({ payload: r.payload, difficulty: r.difficulty, stream_tag: r.stream_tag })),
    });
    setImporting(false);
    if (error) { toast({ title: "Import failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Imported ${data?.inserted ?? 0}`, description: data?.failed ? `${data.failed} failed` : undefined });
    setParsed([]);
    if (fileRef.current) fileRef.current.value = "";
    await onImported();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Upload questions</CardTitle>
        <CardDescription>{TEMPLATES[kind].help}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Question type</Label>
            <select
              value={kind}
              onChange={(e) => { setKind(e.target.value as Kind); setParsed([]); }}
              className="block h-9 text-sm border rounded px-2 bg-background"
            >
              {enabledKinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </div>
          <Button variant="secondary" onClick={() => downloadTemplate(kind, subtopic.name)}>
            <Download className="h-4 w-4 mr-2" /> Download template
          </Button>
          <div>
            <Label className="text-xs">Import as</Label>
            <select
              value={importStatus} onChange={(e) => setImportStatus(e.target.value as any)}
              className="block h-9 text-sm border rounded px-2 bg-background"
            >
              <option value="approved">Approved (live)</option>
              <option value="draft">Draft (review later)</option>
            </select>
          </div>
          <div className="flex-1">
            <Label className="text-xs">Upload .xlsx</Label>
            <Input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>
        </div>

        {parsed.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-xs">
              <span>
                {parsed.filter((r) => r.valid).length} valid · {parsed.filter((r) => !r.valid).length} invalid
              </span>
              <Button size="sm" onClick={doImport} disabled={importing}>
                {importing ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                Import valid rows
              </Button>
            </div>
            <div className="max-h-72 overflow-auto divide-y">
              {parsed.map((r) => (
                <div key={r.rowIndex} className="px-3 py-2 text-xs flex items-start gap-2">
                  {r.valid
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    : <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate">Row {r.rowIndex}: {r.preview || "(empty)"}</div>
                    {!r.valid && <div className="text-destructive">{r.errors.join("; ")}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------- Item bank card ------------------------- */
function ItemBankCard({ items, subtopic, onToggle, onDelete }: {
  items: Item[]; subtopic: Subtopic; onToggle: (it: Item) => void; onDelete: (id: string) => void;
}) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = items.filter((it) =>
    (kindFilter === "all" || it.kind === kindFilter) &&
    (statusFilter === "all" || it.status === statusFilter)
  );

  const kindsInBank = Array.from(new Set(items.map((i) => i.kind)));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Item bank ({items.length})</CardTitle>
        <CardDescription>Approved items are served in the daily workout. Toggle to draft to hide from candidates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 text-xs">
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="h-8 border rounded px-2 bg-background">
            <option value="all">All types</option>
            {kindsInBank.map((k) => <option key={k} value={k}>{KIND_LABELS[k as Kind] || k}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 border rounded px-2 bg-background">
            <option value="all">All status</option>
            <option value="approved">Approved</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No items match.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-auto">
            {filtered.map((it) => (
              <li key={it.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{it.kind}</Badge>
                    <Badge variant={it.status === "approved" ? "default" : "secondary"} className="text-[10px]">{it.status}</Badge>
                    <span className="text-[10px] text-muted-foreground">{it.source} · {it.difficulty}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onToggle(it)}>
                      {it.status === "approved" ? "→ Draft" : "→ Approve"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="text-sm">{it.payload?.question || it.payload?.prompt || it.payload?.reference_text || "(no preview)"}</div>
                {Array.isArray(it.payload?.options) && (
                  <ul className="mt-1 text-xs text-muted-foreground list-decimal list-inside">
                    {it.payload.options.map((o: string, i: number) => {
                      const correct = i === it.payload.correct_index || (Array.isArray(it.payload.correct_indices) && it.payload.correct_indices.includes(i));
                      return <li key={i} className={correct ? "text-emerald-600 font-medium" : ""}>{o}</li>;
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
