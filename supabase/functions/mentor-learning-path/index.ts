// Mentor Learning Paths — reusable LP catalog with YouTube curation.
// All AI calls go through the central llm-caller (json mode).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callLLMJson } from "../_shared/llmCallerClient.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

const svc = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ALLOWED_CHANNELS: { id: string; name: string; weight: number }[] = [
  { id: "UCKWaEZ-_VweaEx1j62do_vQ", name: "IBM Technology", weight: 5 },
  { id: "UC8butISFwT-Wl7EV0hUK0BQ", name: "freeCodeCamp", weight: 4 },
  { id: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship", weight: 3 },
  { id: "UCJS9pqu9BzkAMNTmzNMNhvg", name: "Google Cloud Tech", weight: 4 },
  { id: "UCsMica-v34Irf9KVTh6xx-g", name: "Microsoft Developer", weight: 3 },
  { id: "UCEBb1b_L6zDS3xTUrIALZOw", name: "MIT OpenCourseWare", weight: 4 },
  { id: "UC4a-Gbdw7vOaccHmFo40b9g", name: "Khan Academy", weight: 2 },
  { id: "UCGwu0nbY2wSkW8N-cghnLpA", name: "CrashCourse", weight: 2 },
];

async function resolveCandidate(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  const sb = svc();
  const { data: u } = await sb.auth.getUser(token);
  const email = u?.user?.email;
  if (!email) return null;
  const { data: c } = await sb.from("candidates").select("*").ilike("email", email)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return c;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

interface YTVideo {
  youtube_id: string; title: string; channel: string; channel_id: string;
  duration_sec: number; thumbnail: string; description: string;
}

function parseDurationISO(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

async function fetchYouTubeForSkill(skill: string): Promise<YTVideo[]> {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY not configured");
  const collected: YTVideo[] = [];
  for (const ch of ALLOWED_CHANNELS) {
    try {
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", `${skill} tutorial`);
      searchUrl.searchParams.set("channelId", ch.id);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("videoEmbeddable", "true");
      searchUrl.searchParams.set("relevanceLanguage", "en");
      searchUrl.searchParams.set("maxResults", String(ch.weight + 2));
      const sresp = await fetch(searchUrl.toString());
      if (!sresp.ok) { console.warn("YT search fail", ch.name, sresp.status); continue; }
      const sjson = await sresp.json();
      const ids: string[] = (sjson.items || []).map((it: any) => it.id?.videoId).filter(Boolean);
      if (ids.length === 0) continue;

      const detUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detUrl.searchParams.set("key", YOUTUBE_API_KEY);
      detUrl.searchParams.set("part", "snippet,contentDetails,status");
      detUrl.searchParams.set("id", ids.join(","));
      const dresp = await fetch(detUrl.toString());
      if (!dresp.ok) continue;
      const djson = await dresp.json();
      for (const v of djson.items || []) {
        if (v.status?.embeddable === false) continue;
        const dur = parseDurationISO(v.contentDetails?.duration || "");
        if (dur < 180) continue;
        collected.push({
          youtube_id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle,
          channel_id: v.snippet.channelId, duration_sec: dur,
          thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
          description: (v.snippet.description || "").slice(0, 400),
        });
      }
    } catch (e) { console.warn("YT channel error", ch.name, e); }
  }
  return collected;
}

type CuratedLP = {
  title: string; description: string; level: "beginner" | "intermediate" | "advanced";
  tags: string[]; related_skills: string[]; applicable_streams: string[];
  modules: Array<{ title: string; summary: string; video_idx: number[] }>;
};

async function curateLPWithLLM(authHeader: string, skill: string, candidate: any, videos: YTVideo[]): Promise<CuratedLP> {
  const compactVideos = videos.map((v, i) => ({
    idx: i, id: v.youtube_id, title: v.title, channel: v.channel,
    duration_min: Math.round(v.duration_sec / 60), description: v.description.slice(0, 200),
  }));

  const sys = `You are a curriculum designer. Build a focused learning path for a campus student.
Pick 4-6 best videos from the candidate pool, group into 3-5 modules ordered from beginner to advanced.
Prefer IBM Technology, MIT OpenCourseWare, Google Cloud Tech, freeCodeCamp where applicable.
Skip duplicates. Each module: title (3-6 words) + 1-line summary + 1-3 video idx values.

Return ONLY a JSON object with EXACTLY these keys:
{
  "title": string,
  "description": string,
  "level": "beginner" | "intermediate" | "advanced",
  "tags": string[],
  "related_skills": string[],
  "applicable_streams": string[],
  "modules": [ { "title": string, "summary": string, "video_idx": number[] } ]
}
No markdown, no commentary.`;

  return await callLLMJson<CuratedLP>(authHeader, {
    feature: "mentor_lp_curate",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `Skill: ${skill}\nCandidate stream: ${candidate.stream || "unknown"}, year: ${candidate.graduation_year || "unknown"}\n\nVideo pool:\n${JSON.stringify(compactVideos)}` },
    ],
    temperature: 0.4,
    max_tokens: 1500,
  });
}

function buildModulesWithVideos(curated: CuratedLP, videos: YTVideo[]) {
  return (curated.modules || []).map((m) => ({
    title: m.title, summary: m.summary,
    videos: (m.video_idx || []).map((idx) => videos[idx]).filter(Boolean),
  })).filter((m) => m.videos.length > 0);
}

async function findMatchingLP(sb: ReturnType<typeof svc>, authHeader: string, skill: string, tags: string[]) {
  const skillKey = slugify(skill);
  const { data: exact } = await sb.from("learning_paths_catalog")
    .select("*").eq("skill_primary", skillKey).eq("is_published", true)
    .order("rating_avg", { ascending: false }).order("usage_count", { ascending: false }).limit(1);
  if (exact && exact.length) return exact[0];

  const { data: pool } = await sb.from("learning_paths_catalog")
    .select("id, title, skill_primary, tags")
    .eq("is_published", true)
    .order("usage_count", { ascending: false })
    .limit(25);
  if (!pool || pool.length === 0) return null;

  const tokens = Array.from(new Set([
    skillKey,
    ...skill.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    ...tags.map((t) => t.toLowerCase()),
  ]));

  const trimmed = pool.filter((p: any) => {
    const hay = [p.skill_primary || "", ...(Array.isArray(p.tags) ? p.tags : [])].join(" ").toLowerCase();
    return tokens.some((t) => hay.includes(t));
  });
  if (trimmed.length === 0) return null;

  const compact = trimmed.map((p: any) => ({
    id: p.id, title: p.title, skill: p.skill_primary,
    tags: (Array.isArray(p.tags) ? p.tags : []).slice(0, 6),
  }));

  try {
    const judged = await callLLMJson<{ path_id: string | null; reason: string }>(authHeader, {
      feature: "mentor_lp_judge",
      messages: [
        { role: "system", content: 'Match a learner request to an existing learning path. Reuse ONLY if the path clearly teaches the requested topic. Generic tag overlap (e.g. both mention "data" or "ai") is NOT enough. When unsure, return null. Output JSON: {"path_id": string|null, "reason": string} only.' },
        { role: "user", content: `Requested: "${skill}"\nTags: ${tags.join(", ") || "(none)"}\n\nCandidates:\n${JSON.stringify(compact)}` },
      ],
      temperature: 0,
      max_tokens: 200,
    });
    const picked = judged?.path_id || null;
    if (!picked || !trimmed.find((p: any) => p.id === picked)) return null;
    const { data: full } = await sb.from("learning_paths_catalog").select("*").eq("id", picked).maybeSingle();
    return full || null;
  } catch (e) {
    console.warn("[lp-match] judge error", e);
    return null;
  }
}

async function awardXP(sb: ReturnType<typeof svc>, candidateId: string, eventType: string, xp: number, meta: any = {}) {
  await sb.from("candidate_xp_events").insert({ candidate_id: candidateId, event_type: eventType, xp, meta });
  const { data: cur } = await sb.from("candidates").select("xp_total").eq("id", candidateId).maybeSingle();
  await sb.from("candidates").update({
    xp_total: (cur?.xp_total || 0) + xp,
    last_active_on: new Date().toISOString().slice(0, 10),
  }).eq("id", candidateId);
}

const j = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action } = body;
    const sb = svc();
    const authHeader = req.headers.get("Authorization") || "";
    const cand = await resolveCandidate(req);
    if (!cand) return j({ error: "unauthorized" }, 401);

    if (action === "find_or_create") {
      const skill = String(body.skill || "").trim();
      if (!skill) return j({ error: "skill required" }, 400);
      const tags: string[] = Array.isArray(body.tags) ? body.tags.map((t: string) => t.toLowerCase()) : [];

      const existing = await findMatchingLP(sb, authHeader, skill, tags);
      if (existing) {
        await sb.from("candidate_lp_enrollments").upsert(
          { candidate_id: cand.id, path_id: existing.id },
          { onConflict: "candidate_id,path_id" },
        );
        await sb.from("learning_paths_catalog").update({ usage_count: (existing.usage_count || 0) + 1 }).eq("id", existing.id);
        return j({ path: existing, reused: true });
      }

      if (!YOUTUBE_API_KEY) return j({ error: "youtube_key_missing", message: "YouTube curation is not configured yet." }, 503);
      const videos = await fetchYouTubeForSkill(skill);
      if (videos.length < 3) return j({ error: "Not enough quality videos found for this topic." }, 404);

      const curated = await curateLPWithLLM(authHeader, skill, cand, videos);
      const modules = buildModulesWithVideos(curated, videos);
      if (modules.length === 0) return j({ error: "Failed to build learning path" }, 500);

      const totalSec = modules.reduce((s, m) => s + m.videos.reduce((a, v) => a + (v.duration_sec || 0), 0), 0);
      const skillKey = slugify(skill);
      const slug = `${slugify(curated.title)}-${Math.random().toString(36).slice(2, 7)}`;
      const tagsAll = Array.from(new Set([...(curated.tags || []), ...tags, skillKey].map((t) => t.toLowerCase())));
      const skillsAll = Array.from(new Set([skillKey, skill.toLowerCase(), ...(curated.related_skills || []).map((s) => s.toLowerCase())]));

      const { data: created, error: insErr } = await sb.from("learning_paths_catalog").insert({
        title: curated.title, slug, description: curated.description,
        skill_primary: skillKey, skills: skillsAll, tags: tagsAll,
        stream: curated.applicable_streams || [],
        level: curated.level || "beginner",
        estimated_hours: Math.round((totalSec / 3600) * 10) / 10,
        modules, source: "youtube_curated",
        created_by: cand.id, usage_count: 1,
      }).select("*").single();
      if (insErr) throw insErr;

      await sb.from("candidate_lp_enrollments").insert({ candidate_id: cand.id, path_id: created.id });
      await awardXP(sb, cand.id, "lp_first_enroll", 25, { path_id: created.id });

      return j({ path: created, reused: false });
    }

    if (action === "list_my_paths") {
      const { data: enrolls } = await sb.from("candidate_lp_enrollments")
        .select("*, learning_paths_catalog(*)")
        .eq("candidate_id", cand.id)
        .order("last_activity_at", { ascending: false });
      const ids = (enrolls || []).map((e: any) => e.path_id);
      const progressByPath: Record<string, { completed: number }> = {};
      if (ids.length) {
        const { data: prog } = await sb.from("candidate_lp_video_progress")
          .select("path_id, video_id, completed").eq("candidate_id", cand.id).in("path_id", ids);
        for (const p of prog || []) {
          if (!progressByPath[p.path_id]) progressByPath[p.path_id] = { completed: 0 };
          if (p.completed) progressByPath[p.path_id].completed += 1;
        }
      }
      const result = (enrolls || []).map((e: any) => {
        const path = e.learning_paths_catalog;
        const totalVideos = (path?.modules || []).reduce((s: number, m: any) => s + (m.videos?.length || 0), 0);
        const completed = progressByPath[e.path_id]?.completed || 0;
        return {
          enrollment_id: e.id, path,
          total_videos: totalVideos, completed_videos: completed,
          progress_pct: totalVideos ? Math.round((completed / totalVideos) * 100) : 0,
          completed_at: e.completed_at, last_activity_at: e.last_activity_at,
        };
      });
      return j({ paths: result });
    }

    if (action === "get_path") {
      const { path_id } = body;
      const { data: path } = await sb.from("learning_paths_catalog").select("*").eq("id", path_id).maybeSingle();
      if (!path) return j({ error: "not_found" }, 404);
      const { data: prog } = await sb.from("candidate_lp_video_progress")
        .select("video_id, watched_sec, completed").eq("candidate_id", cand.id).eq("path_id", path_id);
      return j({ path, progress: prog || [] });
    }

    if (action === "mark_progress") {
      const { path_id, video_id, watched_sec, duration_sec } = body;
      const completed = duration_sec && watched_sec >= duration_sec * 0.9;
      const { data: prev } = await sb.from("candidate_lp_video_progress")
        .select("*").eq("candidate_id", cand.id).eq("path_id", path_id).eq("video_id", video_id).maybeSingle();
      const wasCompleted = prev?.completed || false;
      await sb.from("candidate_lp_video_progress").upsert({
        candidate_id: cand.id, path_id, video_id,
        watched_sec: Math.max(prev?.watched_sec || 0, watched_sec),
        duration_sec, completed: !!completed,
        completed_at: completed && !wasCompleted ? new Date().toISOString() : prev?.completed_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: "candidate_id,path_id,video_id" });
      await sb.from("candidate_lp_enrollments").update({
        last_video_id: video_id, last_activity_at: new Date().toISOString(),
      }).eq("candidate_id", cand.id).eq("path_id", path_id);
      if (completed && !wasCompleted) {
        await awardXP(sb, cand.id, "lp_video_complete", 15, { path_id, video_id });
        const { data: path } = await sb.from("learning_paths_catalog").select("modules").eq("id", path_id).maybeSingle();
        const total = (path?.modules || []).reduce((s: number, m: any) => s + (m.videos?.length || 0), 0);
        const { count } = await sb.from("candidate_lp_video_progress")
          .select("id", { count: "exact", head: true })
          .eq("candidate_id", cand.id).eq("path_id", path_id).eq("completed", true);
        if (total > 0 && (count || 0) >= total) {
          await sb.from("candidate_lp_enrollments").update({ completed_at: new Date().toISOString() })
            .eq("candidate_id", cand.id).eq("path_id", path_id);
          await awardXP(sb, cand.id, "lp_path_complete", 100, { path_id });
        }
      }
      return j({ ok: true, completed });
    }

    if (action === "rate") {
      const { path_id, rating } = body;
      if (!rating || rating < 1 || rating > 5) return j({ error: "rating 1-5" }, 400);
      const { data: p } = await sb.from("learning_paths_catalog").select("rating_avg, rating_count").eq("id", path_id).maybeSingle();
      const newCount = (p?.rating_count || 0) + 1;
      const newAvg = (((p?.rating_avg || 0) * (p?.rating_count || 0)) + rating) / newCount;
      await sb.from("learning_paths_catalog").update({ rating_avg: newAvg, rating_count: newCount }).eq("id", path_id);
      return j({ ok: true });
    }

    return j({ error: "unknown_action" }, 400);
  } catch (e: any) {
    console.error("[mentor-learning-path]", e);
    return j({ error: e?.message || "internal" }, 500);
  }
});
