import { useEffect, useState, useCallback } from "react";
import { practiceAdmin } from "@/lib/practiceClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Sparkles, CheckCircle2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Pillar = { id: string; slug: string; name: string; icon: string | null; color: string | null; sort_order: number; enabled: boolean; is_stream_aware: boolean; description: string | null };
type Subtopic = { id: string; pillar_id: string; slug: string; name: string; sort_order: number; default_difficulty: string; default_kind: string; time_budget_seconds: number; enabled: boolean; description: string | null };
type Prompt = { id?: string; subtopic_id: string; kind: string; system_prompt: string; user_prompt_template: string; few_shot: any; temperature: number; is_active: boolean; model_override?: string | null; schema_json?: any };
type Item = { id: string; subtopic_id: string; kind: string; payload: any; status: string; source: string; difficulty: string; stream_tag: string | null };

export function PracticeContentSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [activeSub, setActiveSub] = useState<Subtopic | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [sample, setSample] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

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
    setSubtopics(data?.subtopics || []);
    setActiveSub(null); setPrompt(null); setItems([]); setSample(null);
  }, []);

  useEffect(() => { if (activePillar) loadSubtopics(activePillar.id); }, [activePillar, loadSubtopics]);

  const loadPromptAndItems = useCallback(async (s: Subtopic) => {
    setActiveSub(s); setSample(null);
    const [{ data: pData }, { data: iData }] = await Promise.all([
      practiceAdmin<{ prompts: Prompt[] }>({ action: "list_prompts", subtopic_id: s.id }),
      practiceAdmin<{ items: Item[] }>({ action: "list_items", subtopic_id: s.id }),
    ]);
    const existing = pData?.prompts?.[0];
    setPrompt(existing || {
      subtopic_id: s.id, kind: s.default_kind, system_prompt: "", user_prompt_template: "",
      few_shot: [], temperature: 0.7, is_active: true,
    });
    setItems(iData?.items || []);
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
      subtopic: { pillar_id: activePillar.id, name: n, slug, sort_order: subtopics.length * 10, default_kind: "mcq", default_difficulty: "medium", time_budget_seconds: 180, enabled: true },
    });
    if (data?.subtopic) setSubtopics((xs) => [...xs, data.subtopic]);
  };

  const updateSub = async (s: Subtopic, patch: Partial<Subtopic>) => {
    const { data } = await practiceAdmin<{ subtopic: Subtopic }>({ action: "upsert_subtopic", subtopic: { ...s, ...patch } });
    if (data?.subtopic) {
      setSubtopics((xs) => xs.map((x) => x.id === s.id ? data.subtopic : x));
      if (activeSub?.id === s.id) setActiveSub(data.subtopic);
    }
  };

  const delSub = async (id: string) => {
    if (!confirm("Delete subtopic and all its items?")) return;
    await practiceAdmin({ action: "delete_subtopic", id });
    setSubtopics((xs) => xs.filter((x) => x.id !== id));
    if (activeSub?.id === id) { setActiveSub(null); setPrompt(null); setItems([]); }
  };

  const savePrompt = async () => {
    if (!prompt) return;
    setSavingPrompt(true);
    const { data, error } = await practiceAdmin<{ prompt: Prompt }>({ action: "upsert_prompt", prompt });
    setSavingPrompt(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    if (data?.prompt) { setPrompt(data.prompt); toast({ title: "Prompt saved" }); }
  };

  const generate = async () => {
    if (!prompt?.id) { toast({ title: "Save prompt first", variant: "destructive" }); return; }
    setGenerating(true); setSample(null);
    const { data, error } = await practiceAdmin<{ payload: any }>({ action: "generate_sample", prompt_id: prompt.id });
    setGenerating(false);
    if (error) { toast({ title: "Generation failed", description: error.message, variant: "destructive" }); return; }
    setSample(data?.payload);
  };

  const promote = async () => {
    if (!activeSub || !sample) return;
    const { data } = await practiceAdmin<{ item: Item }>({
      action: "upsert_item",
      item: { subtopic_id: activeSub.id, prompt_id: prompt?.id, kind: prompt?.kind || "mcq", payload: sample, status: "draft", source: "llm", difficulty: "medium" },
    });
    if (data?.item) { setItems((xs) => [data.item, ...xs]); setSample(null); toast({ title: "Added to bank as draft" }); }
  };

  const approve = async (it: Item) => {
    await practiceAdmin({ action: "set_item_status", id: it.id, status: "approved" });
    setItems((xs) => xs.map((x) => x.id === it.id ? { ...x, status: "approved" } : x));
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
        <p className="text-sm text-muted-foreground">Pillars → Subtopics → LLM Prompt Studio → Item bank. Approved items are served in the daily workout.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_260px_1fr]">
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
                    <button onClick={() => loadPromptAndItems(s)} className="flex-1 text-left text-sm py-1.5 truncate">{s.name}</button>
                    <button onClick={() => delSub(s.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            {activeSub && (
              <div className="border-t mt-2 pt-2 space-y-2 px-1 text-xs">
                <div><Label className="text-xs">Kind</Label>
                  <select value={activeSub.default_kind} onChange={(e) => updateSub(activeSub, { default_kind: e.target.value })} className="w-full mt-0.5 text-xs border rounded px-2 py-1 bg-background">
                    {["mcq","speech","scenario","writing","mock"].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Time budget (s)</Label>
                  <Input type="number" value={activeSub.time_budget_seconds} className="h-7 text-xs" onChange={(e) => updateSub(activeSub, { time_budget_seconds: Number(e.target.value) || 180 })} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prompt Studio + Items */}
        <div className="space-y-4 min-w-0">
          {!activeSub ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a subtopic to edit its prompt and review items.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Prompt Studio · {activeSub.name}</CardTitle>
                  <CardDescription>Template runs through the central <code>llm-caller</code>. Use <code>{"{candidate_stream}"}</code>, <code>{"{difficulty}"}</code> as placeholders.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {prompt && <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Kind</Label>
                        <select value={prompt.kind} onChange={(e) => setPrompt({ ...prompt, kind: e.target.value })} className="w-full text-sm border rounded px-2 py-1.5 bg-background">
                          {["mcq","speech","scenario","writing","mock"].map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Temperature</Label>
                        <Input type="number" step="0.1" min={0} max={2} value={prompt.temperature} onChange={(e) => setPrompt({ ...prompt, temperature: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div>
                      <Label>System prompt</Label>
                      <Textarea rows={3} value={prompt.system_prompt} onChange={(e) => setPrompt({ ...prompt, system_prompt: e.target.value })} placeholder="You are an expert quiz writer..." />
                    </div>
                    <div>
                      <Label>User prompt template</Label>
                      <Textarea rows={4} value={prompt.user_prompt_template} onChange={(e) => setPrompt({ ...prompt, user_prompt_template: e.target.value })} placeholder="Generate one medium-difficulty {kind} question on percentages for a {candidate_stream} student." />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={savePrompt} disabled={savingPrompt}>
                        {savingPrompt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save prompt
                      </Button>
                      <Button variant="secondary" onClick={generate} disabled={generating || !prompt.id}>
                        {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} Generate sample
                      </Button>
                    </div>
                    {sample && (
                      <div className="mt-2 border rounded-lg p-3 bg-muted/40">
                        <div className="text-xs uppercase text-muted-foreground mb-1">Sample preview</div>
                        <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(sample, null, 2)}</pre>
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" onClick={promote}><Plus className="h-3.5 w-3.5 mr-1" /> Add to bank (draft)</Button>
                        </div>
                      </div>
                    )}
                  </>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Item bank ({items.length})</CardTitle></CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No items yet. Generate one above, then approve.</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((it) => (
                        <li key={it.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">{it.kind} · {it.source} · {it.status}</span>
                            <div className="flex gap-1">
                              {it.status !== "approved" && <Button size="sm" variant="secondary" onClick={() => approve(it)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve</Button>}
                              <Button size="sm" variant="ghost" onClick={() => delItem(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          <div className="text-sm font-medium">{it.payload?.question || it.payload?.prompt || "(no preview)"}</div>
                          {Array.isArray(it.payload?.options) && (
                            <ul className="mt-1 text-xs text-muted-foreground list-decimal list-inside">
                              {it.payload.options.map((o: string, i: number) => (
                                <li key={i} className={i === it.payload.correct_index ? "text-emerald-600 font-medium" : ""}>{o}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
