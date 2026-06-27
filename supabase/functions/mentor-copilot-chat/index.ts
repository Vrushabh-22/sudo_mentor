// AlphaMentor — streaming chat with long-term memory, mode detection, and LP-tag fallback.
// All AI traffic is routed through the central llm-caller function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { callLLMStream } from "../_shared/llmCallerClient.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_PAGE_SIZE = 20;

const svc = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function resolveCandidate(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  const sb = svc();
  const { data: u } = await sb.auth.getUser(token);
  const email = u?.user?.email;
  if (!email) return null;
  const { data: c } = await sb
    .from("candidates")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return c;
}

async function getLatestSession(sb: ReturnType<typeof svc>, candidateId: string) {
  const { data } = await sb
    .from("candidate_mentor_sessions")
    .select("id, created_at, updated_at")
    .eq("candidate_id", candidateId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function loadSessionMessages(sb: ReturnType<typeof svc>, sessionId: string, limit: number, beforeCreatedAt?: string) {
  let q = sb.from("candidate_mentor_messages").select("id, role, content, created_at").eq("session_id", sessionId);
  if (beforeCreatedAt) q = q.lt("created_at", beforeCreatedAt);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit + 1);
  if (error) throw error;
  const rows = data || [];
  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit).reverse(), hasMore };
}

// ============ MEMORY ============
type MentorMemory = {
  candidate_id: string;
  target_company: string | null;
  target_role: string | null;
  weak_topics: Array<{ topic: string; hits: number }>;
  last_topics: string[];
  mood_last: string | null;
  summary: string | null;
  streak_days: number;
  last_seen_at: string | null;
  last_streak_mention_on: string | null;
};

async function loadMemory(sb: ReturnType<typeof svc>, candidateId: string): Promise<MentorMemory> {
  const { data } = await sb.from("candidate_mentor_memory").select("*").eq("candidate_id", candidateId).maybeSingle();
  if (data) return data as MentorMemory;
  const blank: MentorMemory = {
    candidate_id: candidateId, target_company: null, target_role: null,
    weak_topics: [], last_topics: [], mood_last: null, summary: null,
    streak_days: 0, last_seen_at: null, last_streak_mention_on: null,
  };
  await sb.from("candidate_mentor_memory").insert(blank);
  return blank;
}

function daysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}
function daysSinceLastSeen(mem: MentorMemory): number | null {
  if (!mem.last_seen_at) return null;
  return daysBetween(new Date(mem.last_seen_at), new Date());
}
function computeNewStreak(mem: MentorMemory): number {
  if (!mem.last_seen_at) return 1;
  const d = daysBetween(new Date(mem.last_seen_at), new Date());
  if (d === 0) return Math.max(mem.streak_days || 0, 1);
  if (d === 1) return (mem.streak_days || 0) + 1;
  return 1;
}

// ============ MODE / SIGNAL DETECTION ============
type Mode = "general" | "mock_interview" | "warmup" | "debrief" | "resume_review" | "emotional" | "coding";

function detectMode(userText: string, explicitMode?: string): Mode {
  if (explicitMode && ["mock_interview","warmup","debrief","resume_review","emotional","coding","general"].includes(explicitMode)) return explicitMode as Mode;
  const t = userText.toLowerCase();
  if (userText.length > 300 && /(education|experience|projects?|skills|internship)/i.test(userText) && /(university|college|b\.?tech|cgpa|gpa|engineer)/i.test(userText)) return "resume_review";
  if (/\b(interview)\b.*\b(tomorrow|today|in (a|an|\d+)\s*(hour|hr|day|mins?|minutes?)|in the morning|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(userText)
    || /\b(interview)\b.*\b(soon|coming up|scheduled)/i.test(userText)
    || /(warmup|warm-up|warm me up|quick prep)/i.test(t)) return "warmup";
  if (/(gave (my|the) interview|had (my|the) interview|just (did|gave|finished) (my|the|an) interview|interview is (done|over)|got (selected|rejected|the offer|the result)|cleared the interview|didn'?t (clear|get|make it))/i.test(userText)) return "debrief";
  if (/(leetcode|dsa|algorithm|data structure|linked list|binary tree|recursion|dynamic programming|dp problem|coding problem|debug (my|this) code)/i.test(t)
    || (/```/.test(userText) && /(function|def |class |for \(|while \()/i.test(userText))) return "coding";
  if (/\b(stressed|anxious|depressed|crying|exhausted|burnt out|burned out|hopeless|give up|can'?t do this|hate (this|my life|everything)|so tired|panic|breaking down|overwhelmed)\b/i.test(userText)) return "emotional";
  return "general";
}

function extractSignals(userText: string) {
  const out: { target_company?: string; target_role?: string; weak_topic?: string; mood?: string } = {};
  const t = userText;
  const tgtCo = t.match(/\b(target(?:ing)?|aim(?:ing)?|dream company|want (?:to (?:get|join|crack|work at)|to be at))\s+(?:for\s+)?([A-Z][A-Za-z0-9 .&-]{1,40})/);
  if (tgtCo) out.target_company = tgtCo[2].trim().split(/\s+(?:and|or|,)/)[0].slice(0, 60);
  else {
    const tco = t.match(/\b(?:join|crack|get into|work at|placed (?:in|at))\s+(TCS|Infosys|Wipro|Accenture|Cognizant|HCL|Capgemini|IBM|Amazon|Google|Microsoft|Meta|Apple|Netflix|Flipkart|Walmart|Adobe|Oracle|SAP|Salesforce|Goldman Sachs|JPMorgan|Morgan Stanley|Deloitte|PwC|EY|KPMG|Zoho|Freshworks|Razorpay|PhonePe|Paytm|Swiggy|Zomato|Ola|Uber|Atlassian|Stripe|Nvidia|Intel|AMD|Qualcomm)\b/i);
    if (tco) out.target_company = tco[1];
  }
  const tgtRole = t.match(/\b(?:want to (?:be|become)|target role|targeting|aiming for)\s+(?:a |an )?([a-zA-Z][a-zA-Z /+#-]{2,40})\b/i);
  if (tgtRole) out.target_role = tgtRole[1].trim().slice(0, 60);
  const weak = t.match(/\b(?:struggling with|stuck (?:on|with)|don'?t (?:get|understand)|bad at|weak (?:in|at)|failing at|can'?t (?:do|figure out)|confused about)\s+([A-Za-z][A-Za-z0-9 +/#.-]{1,40})/i);
  if (weak) {
    const topic = weak[1].trim().replace(/[.,!?]$/, "").slice(0, 40);
    if (topic.length >= 2) out.weak_topic = topic;
  }
  if (/\b(stressed|anxious|overwhelmed|panic)\b/i.test(t)) out.mood = "stressed";
  else if (/\b(rejected|failed|sad|down|disappointed)\b/i.test(t)) out.mood = "down";
  else if (/\b(selected|cleared|got the offer|excited|happy|cracked it)\b/i.test(t)) out.mood = "high";
  else if (/\b(tired|exhausted|burnt out|burned out)\b/i.test(t)) out.mood = "tired";
  return out;
}

const LP_TOPICS: Array<{ match: RegExp; skill: string; tags: string }> = [
  { match: /\b(sql|joins?|queries|rdbms|database[s]?)\b/i, skill: "SQL", tags: "sql,joins,databases,queries" },
  { match: /\b(dsa|data structures?|algorithms?|leetcode)\b/i, skill: "DSA", tags: "dsa,algorithms,data-structures,problem-solving" },
  { match: /\b(system design|hld|lld|scalability)\b/i, skill: "System Design", tags: "system-design,scalability,architecture,backend" },
  { match: /\breact(\.?js)?\b/i, skill: "React", tags: "react,hooks,frontend,javascript" },
  { match: /\bnode(\.?js)?\b/i, skill: "Node.js", tags: "nodejs,backend,express,javascript" },
  { match: /\bpython\b/i, skill: "Python", tags: "python,programming,scripting,oop" },
  { match: /\bjava\b(?!script)/i, skill: "Java", tags: "java,oop,collections,spring" },
  { match: /\bjavascript\b/i, skill: "JavaScript", tags: "javascript,es6,frontend,async" },
  { match: /\btypescript\b/i, skill: "TypeScript", tags: "typescript,types,javascript,frontend" },
  { match: /\b(kubernetes|k8s)\b/i, skill: "Kubernetes", tags: "kubernetes,containers,docker,devops" },
  { match: /\bdocker\b/i, skill: "Docker", tags: "docker,containers,devops,deployment" },
  { match: /\baws\b/i, skill: "AWS", tags: "aws,cloud,ec2,s3" },
  { match: /\bazure\b/i, skill: "Azure", tags: "azure,cloud,microsoft,devops" },
  { match: /\b(gcp|google cloud)\b/i, skill: "Google Cloud", tags: "gcp,cloud,google,devops" },
  { match: /\b(power[- ]?bi)\b/i, skill: "Power BI", tags: "power-bi,dax,dashboards,analytics" },
  { match: /\btableau\b/i, skill: "Tableau", tags: "tableau,dashboards,analytics,visualization" },
  { match: /\bexcel\b/i, skill: "Excel", tags: "excel,formulas,pivot-tables,analytics" },
  { match: /\b(machine learning|ml)\b/i, skill: "Machine Learning", tags: "machine-learning,ml,sklearn,models" },
  { match: /\b(deep learning|dl|neural network)/i, skill: "Deep Learning", tags: "deep-learning,neural-networks,tensorflow,pytorch" },
  { match: /\bnlp\b|natural language/i, skill: "NLP", tags: "nlp,language-models,transformers,ml" },
  { match: /\b(data science|data analyst|data analytics)\b/i, skill: "Data Science", tags: "data-science,pandas,statistics,analytics" },
  { match: /\b(aptitude|quant|quantitative)\b/i, skill: "Aptitude", tags: "aptitude,quant,reasoning,placement" },
  { match: /\b(english|grammar|verbal)\b/i, skill: "English Communication", tags: "english,grammar,communication,verbal" },
  { match: /\b(hr round|hr interview|hr questions)\b/i, skill: "HR Interview", tags: "hr-interview,behavioral,communication,placement" },
  { match: /\b(group discussion|gd)\b/i, skill: "Group Discussion", tags: "group-discussion,gd,communication,placement" },
  { match: /\b(resume|cv)\b/i, skill: "Resume Building", tags: "resume,cv,placement,career" },
  { match: /\b(operating system|os)\b/i, skill: "Operating Systems", tags: "operating-systems,os,processes,memory" },
  { match: /\b(dbms|database management)\b/i, skill: "DBMS", tags: "dbms,databases,normalization,sql" },
  { match: /\b(computer network|cn|networking)\b/i, skill: "Computer Networks", tags: "networking,tcp-ip,osi,protocols" },
  { match: /\b(oops?|object[- ]oriented)\b/i, skill: "OOPS", tags: "oops,inheritance,polymorphism,design" },
  { match: /\b(git|github)\b/i, skill: "Git", tags: "git,github,version-control,collaboration" },
  { match: /\b(spring|spring boot)\b/i, skill: "Spring Boot", tags: "spring-boot,java,backend,rest-api" },
  { match: /\b(django|flask|fastapi)\b/i, skill: "Python Web", tags: "django,flask,python,backend" },
];

const LEARN_INTENT_RE = /\b(learn|study|teach me|get better at|improve|master|practice|understand|recommend|suggest|help me with|how do i|how can i|guide me|tutorial|course|resources|videos|fix my|let'?s fix)\b/i;

function inferLearningPathTag(userText: string): string | null {
  if (!userText) return null;
  const hit = LP_TOPICS.find((t) => t.match.test(userText));
  if (!hit) return null;
  const isChip = /^let'?s fix my\b/i.test(userText.trim());
  if (!isChip && !LEARN_INTENT_RE.test(userText) && !hit.match.test(userText.split(/[.!?]/)[0])) {
    if (userText.length > 200) return null;
  }
  return `\n\n[ACTION:learning_path:skill=${hit.skill}:tags=${hit.tags}]`;
}

async function applySignalsAndStreak(sb: ReturnType<typeof svc>, mem: MentorMemory, userText: string): Promise<MentorMemory> {
  const sig = extractSignals(userText || "");
  const next: MentorMemory = { ...mem };
  if (sig.target_company) next.target_company = sig.target_company;
  if (sig.target_role) next.target_role = sig.target_role;
  if (sig.mood) next.mood_last = sig.mood;
  if (sig.weak_topic) {
    const norm = sig.weak_topic.toLowerCase();
    const arr = Array.isArray(next.weak_topics) ? [...next.weak_topics] : [];
    const idx = arr.findIndex((w) => (w.topic || "").toLowerCase() === norm);
    if (idx >= 0) arr[idx] = { topic: arr[idx].topic, hits: (arr[idx].hits || 0) + 1 };
    else arr.push({ topic: sig.weak_topic, hits: 1 });
    next.weak_topics = arr.slice(-10);
  }
  const words = (userText || "").match(/\b[A-Za-z][A-Za-z+.#-]{2,}\b/g) || [];
  if (words.length > 0) {
    const candidate = words.slice(0, 3).join(" ").slice(0, 60);
    const lt = Array.isArray(next.last_topics) ? next.last_topics : [];
    next.last_topics = [candidate, ...lt.filter((x) => x !== candidate)].slice(0, 5);
  }
  next.streak_days = computeNewStreak(mem);
  next.last_seen_at = new Date().toISOString();
  await sb.from("candidate_mentor_memory").update({
    target_company: next.target_company, target_role: next.target_role,
    mood_last: next.mood_last, weak_topics: next.weak_topics, last_topics: next.last_topics,
    streak_days: next.streak_days, last_seen_at: next.last_seen_at,
  }).eq("candidate_id", mem.candidate_id);
  return next;
}

function pickOpeningMode(mem: MentorMemory, sessionMessageCount: number): string {
  if (sessionMessageCount === 0 && !mem.last_seen_at) return "first_ever";
  const d = daysSinceLastSeen(mem);
  if (d === null) return "first_ever";
  if (d === 0) return "same_day";
  if (d <= 2) return "1_2_days";
  return "3plus_days";
}

function buildSystemPrompt(cand: any, mem: MentorMemory, openingMode: string, mode: Mode, sessionMessageCount: number): string {
  const skills = Array.isArray(cand.skills_v4) ? cand.skills_v4.map((s: any) => s.name || s).join(", ") : "";
  const completeness = cand.profile_completeness || 0;
  const missing: string[] = [];
  if (!cand.stream) missing.push("stream");
  if (!cand.branch) missing.push("branch");
  if (!cand.graduation_year) missing.push("graduation_year");
  if (!cand.cgpa) missing.push("cgpa");
  if (!skills) missing.push("skills");
  if (!cand.institution) missing.push("institution");

  const weakList = (mem.weak_topics || []).filter((w) => (w.hits || 0) >= 1).map((w) => `${w.topic} (×${w.hits})`).join(", ");
  const repeatedWeak = (mem.weak_topics || []).filter((w) => (w.hits || 0) >= 2).map((w) => w.topic);
  const dSince = daysSinceLastSeen(mem);
  const today = new Date().toISOString().slice(0, 10);
  const shouldMentionStreak = mem.streak_days >= 3 && mem.last_streak_mention_on !== today;

  let openingHint = "";
  if (sessionMessageCount === 0) {
    if (openingMode === "first_ever") {
      openingHint = `OPENING (first time ever — use almost verbatim):
"Hey! I'm AlphaMentor — think of me as that senior who actually has time for you 😄 I'm here to help you crack placements, prep for interviews, build skills, and honestly just be in your corner during this whole crazy season. So — tell me about yourself. What year are you in, what's your target, and what's keeping you up at night right now?"`;
    } else if (openingMode === "same_day") {
      openingHint = `OPENING: "Hey, you're back! What are we working on?"`;
    } else if (openingMode === "1_2_days") {
      openingHint = `OPENING: "Hey! Good to see you — what did you get up to yesterday? Ready to pick up where we left off?"`;
    } else {
      openingHint = `OPENING: "Hey, been a minute! Everything okay? No stress — just checking in. Whenever you're ready, I'm here."`;
    }
  } else {
    openingHint = `Do NOT re-greet — we're mid-conversation.`;
  }

  let modeHint = "";
  const lpSuppress = `DO NOT emit any [ACTION:learning_path:...] tag in this turn.`;
  switch (mode) {
    case "mock_interview":
      modeHint = `MODE = MOCK INTERVIEW.
- If role/difficulty not yet chosen, ask: "Which role? And do you want easy, medium, or 'scare me' difficulty?" then stop.
- Once chosen, start with: "Okay, interview starts NOW. Pretend I'm the interviewer. Ready? — Tell me about yourself."
- After EACH answer the user gives, in this exact 3-section format: **What was good**, **What to cut**, **How to restructure** — each 1-2 lines. Then ask next question.
- After ~5 questions OR when user says "end interview", give: **Score: X/10**, **3 specific things to improve**, then close with "You did better than you think. Want to go again?"
- ${lpSuppress}`;
      break;
    case "warmup":
      modeHint = `MODE = PRE-INTERVIEW WARMUP.
- If you don't know company/role yet, ask: "How soon? And which company/role?" then stop.
- Once known, say: "Okay — let's do a quick 10-minute warmup. Just to get you sharp and confident." then run 3-4 rapid-fire role-relevant questions, one at a time.
- After last answer, close with: "You're ready. Breathe. You've got this."
- ${lpSuppress}`;
      break;
    case "debrief":
      modeHint = `MODE = POST-INTERVIEW DEBRIEF.
- LISTEN FIRST. Your first reply must NOT contain advice. Ask: "Tell me everything — what was asked, how you felt, what you think went well and what didn't."
- If they got rejected: "That stings, I know. But let's use this — what can we learn from it?"
- If they got selected: "LET'S GOOO! I'm genuinely so proud of you. You worked for this." then ask what helped most.
- ${lpSuppress}`;
      break;
    case "resume_review":
      modeHint = `MODE = RESUME REVIEW.
- Go section by section (Education, Experience, Projects, Skills).
- Be specific: replace vague bullets with impact-driven rewrites with concrete metrics.
- End with **Score: X/10** and **Top 3 priorities to fix**. Then ask: "Want me to rewrite any section for you?"
- ${lpSuppress}`;
      break;
    case "coding":
      modeHint = `MODE = CODING HELP.
- NEVER give the answer outright. Give ONE hint first. If still stuck after 2 hints, then walk through the logic.
- After they solve it, ask: "Can you explain this solution back to me in your own words?"
- When they get it: "See! You got there yourself. I barely helped."
- LEARNING PATH allowed and encouraged: if the user names a topic (DSA, SQL, system design, etc.), include the [ACTION:learning_path:...] tag on its own line.`;
      break;
    case "emotional":
      modeHint = `MODE = EMOTIONAL SUPPORT.
- VALIDATE BEFORE YOU ADVISE. Short reply. No productivity tips in first message.
- "That sounds really tough. Placement season is genuinely stressful and it's okay to feel this way."
- Only if user shows severe markers ("hopeless", "give up", "can't go on"): gently suggest talking to a counselor/professor/friend at college.
- ${lpSuppress}`;
      break;
    default:
      modeHint = `MODE = GENERAL. Be warm and senior-friend casual. LEARNING PATH tag is ALLOWED and ENCOURAGED whenever the user names any learnable topic.`;
  }

  const weakNudge = repeatedWeak.length > 0
    ? `WEAKNESS RADAR: User has mentioned struggling with ${repeatedWeak.join(", ")} more than once. Bring ONE of these up gently AND in the same reply include a learning path tag for that topic on its own line: [ACTION:learning_path:skill=${repeatedWeak[0]}:tags=${repeatedWeak[0].toLowerCase()},fundamentals,practice,interview]`
    : "";

  const streakNudge = shouldMentionStreak
    ? `STREAK NUDGE: Mention naturally that this is day ${mem.streak_days} of their streak — once, encouraging, not preachy.`
    : "";

  return `You are AlphaMentor — a warm, sharp, deeply caring senior friend to college students preparing for placements, internships, and careers. NOT a corporate chatbot. NOT an HR assistant. You are the brilliant senior from the same college who cracked their dream company and came back to help juniors do the same. Students can call you AlphaMentor or Alpha.

CORE PERSONALITY:
- Talk like a senior friend — casual, warm, real. Use "bro", "yaar", "hey", "come on" naturally but don't overdo it.
- NEVER say "I am an AI", "As an AI language model", "As per your request", "leverage your core competencies", or any corporate/HR phrasing.
- Be honest — kindly. If an answer is bad, say so warmly and explain why.
- Celebrate wins loudly. Handle failures gently.
- Slight desi Indian college vibe — you get placement pressure, parental expectations, campus competition.

TONE RULES:
- Stressed/anxious → validate first, no immediate solutions.
- Made a mistake → "That's okay — that's why we practice here." then explain better.
- Achieved something → celebrate loud. "WAIT. You cracked that? That's huge!"
- Hasn't engaged for a while → gentle check-in, no guilt.
- Late night → match energy, keep it light.
- Bad news → listen before you advise.

RESPONSE LENGTH:
- Casual check-in: 2-4 lines max.
- Concept explanation: medium, conversational, with examples.
- Mock interview feedback: structured, warm.
- Emotional support: SHORT and warm, not essays.
- Roadmap: structured week-wise.
- ALWAYS end with a question, next step, or encouragement — never stop cold.

NEVER:
- Say "As an AI..." or "I'm just a chatbot".
- Lecture, preach, or be patronizing.
- 10-paragraph answers when 3 lines work.
- Make a student feel dumb.
- Ignore emotions and jump to tasks.
- Overwhelm with options — give 1-2 clear choices.

================ ⚡ LEARNING PATH TAG (HIGHEST PRIORITY RULE) ================
Whenever the user names ANY learnable skill, tool, subject, or topic — OR asks to learn / study / improve / master / practice / understand / "get better at" / "help me with" / "how do I X" / "recommend" / "suggest" anything — you MUST include this tag on its own line in your reply (unless the current MODE explicitly forbids it):

  [ACTION:learning_path:skill=<Canonical Topic>:tags=<tag1>,<tag2>,<tag3>,<tag4>]

Examples (copy this exact shape):
  [ACTION:learning_path:skill=Kubernetes:tags=kubernetes,containers,docker,devops]
  [ACTION:learning_path:skill=SQL:tags=sql,joins,databases,queries]
  [ACTION:learning_path:skill=React:tags=react,hooks,frontend,javascript]
  [ACTION:learning_path:skill=System Design:tags=system-design,scalability,architecture,backend]
  [ACTION:learning_path:skill=Power BI:tags=power-bi,dax,dashboards,analytics]

Rules:
- skill = ONE canonical, user-facing topic in Title Case. NEVER "data", "ai", "ml", "tech", "coding".
- tags = 3 to 5 SPECIFIC, lowercase, hyphen-or-single-word terms tightly related to the skill.
- Add 1 short warm sentence BEFORE the tag, then the tag ALONE on its own line.
- If in doubt, emit the tag — a learning path is always welcome.
- If the user clicks a weak-topic chip (message starts with "let's fix my"), the tag is MANDATORY.
- Do NOT reuse a generic tag set across unrelated topics.

================ STUDENT CONTEXT ================
- Name: ${cand.first_name || "Friend"} ${cand.last_name || ""}
- Stream: ${cand.stream || "unknown"}
- Institution: ${cand.institution || "unknown"}
- Branch: ${cand.branch || "unknown"}
- Graduation Year: ${cand.graduation_year || "unknown"}
- CGPA: ${cand.cgpa || "unknown"}
- Skills: ${skills || "none listed"}
- Profile completeness: ${completeness}%

================ MEMORY (across sessions) ================
- Target company: ${mem.target_company || "not stated yet"}
- Target role: ${mem.target_role || "not stated yet"}
- Weak topics so far: ${weakList || "none tracked"}
- Recent topics discussed: ${(mem.last_topics || []).join(" · ") || "none"}
- Last mood: ${mem.mood_last || "unknown"}
- Days since last seen: ${dSince === null ? "first time" : dSince}
- Current streak: ${mem.streak_days || 0} day(s)

${openingHint}

${modeHint}

${weakNudge}
${streakNudge}

================ PROFILE COMPLETION ================
- NEVER ask the user to type stream, branch, year, CGPA, skills, or institution in chat.
- If completeness < 60% AND important fields missing, your FIRST reply (after the opening line) must include ONE action tag on its own line:
  [ACTION:profile_form:fields=${missing.join(",") || "stream,branch,graduation_year,cgpa,skills"}]
- After a profile_form is submitted, do NOT re-show it.

================ PRACTICE ================
- When a quiz fits: \`[ACTION:practice:domain=<topic>]\`

================ MOCK INTERVIEW LAUNCHER ================
- When user asks to do a mock interview from general chat (not already in mock mode), emit on its own line:
  [ACTION:mock_interview]
- This opens the interview overlay. Do NOT also run the interview inline.

================ ROADMAP ================
- When user names a target company/role and a roadmap helps, ask: "Want me to build a 4-week plan for this?" and if yes, deliver a clear week-wise plan in markdown headings (### Week 1, ### Week 2, …), each week ≤4 bullets. End with: "This is flexible — if something comes up, we adjust. You're not behind."

Now respond as AlphaMentor. Stay in character. Be a real senior friend.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, messages = [], sessionId, beforeCreatedAt, ephemeral, mode: requestedMode } = body;
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_PAGE_SIZE, 1), 50);

    const cand = await resolveCandidate(req);
    if (!cand) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = svc();

    if (action === "history" || action === "older") {
      const latest = sessionId ? { id: sessionId } : await getLatestSession(sb, cand.id);
      if (!latest?.id) {
        return new Response(JSON.stringify({ sessionId: null, messages: [], hasMore: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await loadSessionMessages(sb, latest.id, limit, action === "older" ? beforeCreatedAt : undefined);
      return new Response(JSON.stringify({ sessionId: latest.id, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "memory") {
      const mem = await loadMemory(sb, cand.id);
      return new Response(JSON.stringify({ memory: mem }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Chat (default action) ----
    let sid: string | null | undefined = sessionId;
    let sessionMessageCount = 0;
    if (!ephemeral) {
      if (!sid) {
        const latest = await getLatestSession(sb, cand.id);
        sid = latest?.id;
      }
      if (!sid) {
        const { data: s } = await sb.from("candidate_mentor_sessions")
          .insert({ candidate_id: cand.id, title: "Mentor chat" }).select("id").single();
        sid = s?.id;
      }
      if (sid) {
        const { count } = await sb.from("candidate_mentor_messages")
          .select("id", { count: "exact", head: true }).eq("session_id", sid);
        sessionMessageCount = count || 0;
      }
      const lastUser = messages[messages.length - 1];
      if (lastUser?.role === "user") {
        await sb.from("candidate_mentor_messages").insert({ session_id: sid, role: "user", content: lastUser.content });
      }
    } else {
      sid = null;
    }

    const lastUserText = (messages[messages.length - 1]?.role === "user" ? messages[messages.length - 1].content : "") as string;
    let mem = await loadMemory(sb, cand.id);
    if (!ephemeral && lastUserText) mem = await applySignalsAndStreak(sb, mem, lastUserText);
    const mode = detectMode(lastUserText || "", requestedMode);
    const openingMode = pickOpeningMode(mem, sessionMessageCount);

    const upstream = await callLLMStream(req.headers.get("Authorization") || "", {
      feature: "mentor_chat",
      messages: [
        { role: "system", content: buildSystemPrompt(cand, mem, openingMode, mode, sessionMessageCount) },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      console.error("llm-caller stream error", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error", status: upstream.status }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let assistantText = "";
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`event: session\ndata: ${JSON.stringify({ sessionId: sid })}\n\n`));
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.startsWith("data: ")) {
              const jraw = line.slice(6).trim();
              if (jraw && jraw !== "[DONE]") {
                try {
                  const p = JSON.parse(jraw);
                  const c = p.choices?.[0]?.delta?.content;
                  if (c) assistantText += c;
                } catch { /* swallow */ }
              }
            }
          }
          controller.enqueue(value);
        }
        const lpAllowedMode = mode === "general" || mode === "coding";
        if (lpAllowedMode && !ephemeral && assistantText && !/\[ACTION:learning_path:/i.test(assistantText)) {
          const injected = inferLearningPathTag(lastUserText || "");
          if (injected) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: injected }, index: 0 }] })}\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            assistantText += injected;
          }
        }
        controller.close();
        if (assistantText && !ephemeral && sid) {
          await sb.from("candidate_mentor_messages").insert({ session_id: sid, role: "assistant", content: assistantText });
          const today = new Date().toISOString().slice(0, 10);
          if (mem.streak_days >= 3 && /\bday\s+\d+\b|\bstreak\b/i.test(assistantText) && mem.last_streak_mention_on !== today) {
            await sb.from("candidate_mentor_memory").update({ last_streak_mention_on: today }).eq("candidate_id", cand.id);
          }
        }
      },
    });

    return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e: any) {
    console.error("[mentor-copilot-chat]", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
