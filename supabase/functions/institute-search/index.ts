// Institute typeahead: DB trigram search first, LLM fallback for unseen queries.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Institute = {
  id?: string;
  name: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  type?: string | null;
  suggested?: boolean;
};

async function llmSuggest(q: string): Promise<Institute[]> {
  if (!LOVABLE_API_KEY) return [];
  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content:
          "You return real, currently-operating higher-education institutes (colleges/universities) that match a partial query. Bias toward Indian institutes unless the query clearly implies another country. If uncertain, return fewer. Never invent institutes.",
      },
      {
        role: "user",
        content: `Query: "${q}"\nReturn up to 5 matches as strict JSON with shape:\n{"institutes":[{"name":string,"city":string?,"state":string?,"country":string?,"type":"iit"|"nit"|"iiit"|"iim"|"university"|"college"|"medical"|"other"}]}\nOnly the JSON object, no prose.`,
      },
    ],
    response_format: { type: "json_object" },
  };
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed?.institutes) ? parsed.institutes : [];
    return arr
      .filter((x: any) => x && typeof x.name === "string" && x.name.trim().length > 2)
      .slice(0, 5)
      .map((x: any) => ({
        name: String(x.name).trim(),
        city: x.city ? String(x.city).trim() : null,
        state: x.state ? String(x.state).trim() : null,
        country: x.country ? String(x.country).trim() : "India",
        type: x.type ? String(x.type).trim() : null,
      }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let q = "";
    let limit = 8;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      q = String(body?.q ?? "").trim();
      if (typeof body?.limit === "number") limit = Math.min(20, Math.max(1, body.limit));
    } else {
      q = String(url.searchParams.get("q") ?? "").trim();
      const l = Number(url.searchParams.get("limit") ?? "8");
      if (Number.isFinite(l)) limit = Math.min(20, Math.max(1, l));
    }

    if (q.length < 2) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1) DB search: trigram similarity on name OR alias exact/contains.
    const pattern = `%${q.replace(/[%_]/g, "")}%`;
    const { data: dbRows } = await admin
      .from("institutes")
      .select("id,name,city,state,country,type,aliases,usage_count")
      .or(`name.ilike.${pattern},aliases.cs.{${q}}`)
      .order("usage_count", { ascending: false })
      .limit(limit);

    const items: Institute[] = (dbRows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      state: r.state,
      country: r.country,
      type: r.type,
      suggested: false,
    }));

    // 2) LLM fallback if empty and query is meaningful.
    if (items.length === 0 && q.length >= 4) {
      const llm = await llmSuggest(q);
      if (llm.length) {
        // Best-effort insert; unique index on (lower(name), country) will reject dupes.
        // Insert one-by-one so a single dupe doesn't drop the whole batch.
        for (const i of llm) {
          const { data: ins } = await admin
            .from("institutes")
            .insert({
              name: i.name,
              city: i.city,
              state: i.state,
              country: i.country || "India",
              type: i.type,
              source: "llm",
              verified: false,
            })
            .select("id,name,city,state,country,type")
            .maybeSingle();
          if (ins) items.push({ ...(ins as any), suggested: true });
          else items.push({ ...i, suggested: true });
        }
      }
    }


    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ items: [], error: String((e as Error).message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
