// Candidate-facing practice workout API.
// Actions: get_today, submit_attempt, finish_workout, get_fitness.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callLLMJson } from "../_shared/llmCallerClient.ts";

const STAPLE_SLUGS = ["communication", "hr", "english"];
const WORKOUT_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: cand } = await admin.from("candidates").select("*").eq("user_id", userRes.user.id).maybeSingle();
  if (!cand) return json({ error: "candidate not found" }, 404);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "get_today") {
      return json(await getOrBuildToday(admin, authHeader, cand, body.pillar_id || null));
    }

    if (action === "list_available_pillars") {
      return json(await listAvailablePillars(admin, cand));
    }

    if (action === "submit_attempt") {
      const { workout_id, slot_index, item_id, pillar_id, subtopic_id, kind, answer } = body;
      const { data: item } = await admin.from("practice_items").select("payload, kind").eq("id", item_id).maybeSingle();

      // Score: simple correctness for MCQ; LLM rubric otherwise (cheap heuristic for MVP).
      let score = 0, isCorrect = false, feedback: any = null;
      if ((item?.kind || kind) === "mcq") {
        const correct = item?.payload?.correct_index;
        isCorrect = typeof correct === "number" && Number(answer?.selected_index) === correct;
        score = isCorrect ? 100 : 0;
        feedback = { explanation: item?.payload?.explanation || null };
      } else if (answer?.text) {
        // ask LLM to score on a rubric
        try {
          const rubric = item?.payload?.rubric || ["clarity", "structure", "relevance"];
          const out = await callLLMJson<{ score: number; feedback: string }>(authHeader, {
            feature: `practice.score.${kind || item?.kind}`,
            messages: [
              { role: "system", content: `You are a strict but supportive coach. Score 0-100 on rubric: ${rubric.join(", ")}. Return JSON {"score":number,"feedback":string}.` },
              { role: "user", content: `Question: ${item?.payload?.prompt || ""}\n\nAnswer: ${answer.text}` },
            ],
            temperature: 0.3,
          });
          score = Math.max(0, Math.min(100, Number(out.score) || 0));
          isCorrect = score >= 60;
          feedback = { explanation: out.feedback };
        } catch (e) {
          score = 60;
          feedback = { explanation: "Auto-scored (LLM unavailable). " + String((e as Error).message) };
        }
      }

      await admin.from("practice_attempts").insert({
        candidate_id: cand.id, workout_id, pillar_id, subtopic_id, item_id, kind,
        answer, score, is_correct: isCorrect, ai_feedback: feedback,
      });

      // Update fitness score (EMA, alpha=0.2)
      if (pillar_id) {
        const { data: existing } = await admin.from("career_fitness_scores")
          .select("score, attempts_count").eq("candidate_id", cand.id).eq("pillar_id", pillar_id).maybeSingle();
        const prev = Number(existing?.score ?? 50);
        const next = Math.round((prev * 0.8 + score * 0.2) * 100) / 100;
        await admin.from("career_fitness_scores").upsert({
          candidate_id: cand.id, pillar_id, score: next,
          attempts_count: (existing?.attempts_count || 0) + 1, last_updated: new Date().toISOString(),
        });
      }

      return json({ ok: true, score, is_correct: isCorrect, feedback });
    }

    if (action === "finish_workout") {
      const { workout_id, total_xp } = body;
      await admin.from("practice_daily_workout").update({
        status: "completed", total_xp: Number(total_xp) || 0, completed_at: new Date().toISOString(),
      }).eq("id", workout_id).eq("candidate_id", cand.id);

      // Snapshot fitness
      const { data: scores } = await admin.from("career_fitness_scores")
        .select("pillar_id, score").eq("candidate_id", cand.id);
      const perPillar: Record<string, number> = {};
      let total = 0, n = 0;
      for (const s of scores || []) {
        perPillar[s.pillar_id] = Number(s.score);
        total += Number(s.score); n++;
      }
      const overall = n ? Math.round((total / n) * 100) / 100 : 0;
      const today = new Date().toISOString().slice(0, 10);
      await admin.from("career_fitness_daily").upsert({
        candidate_id: cand.id, snapshot_date: today, overall, per_pillar: perPillar,
        streak_day: cand.streak_days || 0,
      });

      // Award XP
      await admin.from("candidates").update({
        xp_total: (cand.xp_total || 0) + (Number(total_xp) || 0),
      }).eq("id", cand.id);

      return json({ ok: true, overall, per_pillar: perPillar });
    }

    if (action === "get_fitness") {
      const { data: scores } = await admin.from("career_fitness_scores")
        .select("pillar_id, score, attempts_count").eq("candidate_id", cand.id);
      const { data: pillars } = await admin.from("practice_pillars").select("id, slug, name, icon, color")
        .eq("enabled", true).order("sort_order");
      const { data: recent } = await admin.from("career_fitness_daily")
        .select("snapshot_date, overall").eq("candidate_id", cand.id)
        .order("snapshot_date", { ascending: false }).limit(14);
      const map = new Map((scores || []).map((s) => [s.pillar_id, s]));
      const enriched = (pillars || []).map((p) => ({
        ...p,
        score: Number(map.get(p.id)?.score ?? 0),
        attempts: Number(map.get(p.id)?.attempts_count ?? 0),
      }));
      const overall = enriched.length
        ? Math.round((enriched.reduce((s, p) => s + (p.score || 0), 0) / enriched.length) * 10) / 10
        : 0;
      return json({ ok: true, overall, pillars: enriched, trend: (recent || []).reverse() });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

async function getOrBuildToday(admin: any, authHeader: string, cand: any, pillarIdFilter: string | null) {
  const today = new Date().toISOString().slice(0, 10);

  // Reuse the day's cached workout only when no pillar filter is specified
  if (!pillarIdFilter) {
    const { data: existing } = await admin.from("practice_daily_workout")
      .select("*").eq("candidate_id", cand.id).eq("workout_date", today).is("pillar_id", null).maybeSingle();
    if (existing && existing.slots?.length) {
      const hydrated = await hydrateSlots(admin, existing.slots);
      return { ok: true, workout: existing, slots: hydrated };
    }
  }

  const { data: pillars } = await admin.from("practice_pillars")
    .select("id, slug, name, icon, color, is_stream_aware").eq("enabled", true).order("sort_order");
  if (!pillars?.length) return { ok: true, slots: [] };

  let picked: any[] = [];
  if (pillarIdFilter) {
    const p = (pillars || []).find((x: any) => x.id === pillarIdFilter);
    if (!p) return { ok: true, slots: [] };
    // Build multiple slots from this single pillar (up to WORKOUT_SIZE subtopics)
    picked = Array.from({ length: WORKOUT_SIZE }, () => p);
  } else {
    const { data: scores } = await admin.from("career_fitness_scores")
      .select("pillar_id, score").eq("candidate_id", cand.id);
    const scoreMap = new Map((scores || []).map((s: any) => [s.pillar_id, Number(s.score)]));
    const sorted = [...pillars].sort((a, b) => (scoreMap.get(a.id) ?? 0) - (scoreMap.get(b.id) ?? 0));
    const seen = new Set<string>();
    for (const p of sorted) { if (picked.length >= 2) break; picked.push(p); seen.add(p.id); }
    for (const slug of STAPLE_SLUGS) {
      const p = pillars.find((x: any) => x.slug === slug);
      if (p && !seen.has(p.id) && picked.length < WORKOUT_SIZE) { picked.push(p); seen.add(p.id); }
    }
    for (const p of pillars) {
      if (picked.length >= WORKOUT_SIZE) break;
      if (!seen.has(p.id)) { picked.push(p); seen.add(p.id); }
    }
  }

  const slots: any[] = [];
  const usedItemIds = new Set<string>();
  const usedSubIds = new Set<string>();

  for (const p of picked) {
    const { data: subtopics } = await admin.from("practice_subtopics")
      .select("id, name, default_kind, time_budget_seconds").eq("pillar_id", p.id).eq("enabled", true).order("sort_order");
    if (!subtopics?.length) continue;

    // Prefer unused subtopic in single-pillar mode; otherwise random
    let sub: any;
    if (pillarIdFilter) {
      const remaining = subtopics.filter((s: any) => !usedSubIds.has(s.id));
      sub = (remaining.length ? remaining : subtopics)[Math.floor(Math.random() * (remaining.length || subtopics.length))];
    } else {
      sub = subtopics[Math.floor(Math.random() * subtopics.length)];
    }

    let itemsQ = admin.from("practice_items").select("id, kind, payload, stream_tag")
      .eq("subtopic_id", sub.id).eq("status", "approved").limit(20);
    if (p.is_stream_aware && cand.stream) itemsQ = itemsQ.or(`stream_tag.is.null,stream_tag.eq.${cand.stream}`);
    const { data: items } = await itemsQ;

    const pool = (items || []).filter((it: any) => !usedItemIds.has(it.id));
    const itemId: string | null = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;

    if (!itemId) continue;
    usedItemIds.add(itemId);
    usedSubIds.add(sub.id);
    slots.push({
      pillar_id: p.id, pillar_slug: p.slug, pillar_name: p.name, pillar_icon: p.icon, pillar_color: p.color,
      subtopic_id: sub.id, subtopic_name: sub.name,
      kind: sub.default_kind, time_budget: sub.time_budget_seconds || 180,
      item_ids: [itemId],
    });
  }

  if (!slots.length) return { ok: true, slots: [] };

  const { data: workout } = await admin.from("practice_daily_workout").insert({
    candidate_id: cand.id, workout_date: today, slots, status: "in_progress",
    pillar_id: pillarIdFilter,
  }).select("*").single();

  const hydrated = await hydrateSlots(admin, slots);
  return { ok: true, workout, slots: hydrated };
}

async function listAvailablePillars(admin: any, cand: any) {
  const { data: pillars } = await admin.from("practice_pillars")
    .select("id, slug, name, icon, color, is_stream_aware, sort_order")
    .eq("enabled", true).order("sort_order");
  if (!pillars?.length) return { ok: true, pillars: [], today_attempts: 0, daily_limit: 2 };

  const today = new Date().toISOString().slice(0, 10);
  const { count: todayAttempts } = await admin.from("practice_daily_workout")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", cand.id).eq("workout_date", today);

  // For each pillar, count approved items via its subtopics
  const enriched: any[] = [];
  for (const p of pillars) {
    const { data: subs } = await admin.from("practice_subtopics")
      .select("id").eq("pillar_id", p.id).eq("enabled", true);
    const subIds = (subs || []).map((s: any) => s.id);
    if (!subIds.length) continue;
    const { count } = await admin.from("practice_items")
      .select("id", { count: "exact", head: true })
      .in("subtopic_id", subIds).eq("status", "approved");
    if ((count || 0) > 0) {
      enriched.push({ ...p, item_count: count || 0 });
    }
  }
  return { ok: true, pillars: enriched, today_attempts: todayAttempts || 0, daily_limit: 2 };
}

async function hydrateSlots(admin: any, slots: any[]) {
  const ids = slots.flatMap((s) => s.item_ids || []);
  if (!ids.length) return slots;
  const { data: items } = await admin.from("practice_items").select("id, kind, payload").in("id", ids);
  const m = new Map((items || []).map((i: any) => [i.id, i]));
  return slots.map((s) => ({ ...s, items: (s.item_ids || []).map((id: string) => m.get(id)).filter(Boolean) }));
}

function json(p: unknown, status = 200) {
  return new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
