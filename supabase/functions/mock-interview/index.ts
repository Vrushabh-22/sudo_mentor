// Mock Interview — per-turn conversational LLM call + strict batch evaluation.
// All AI calls route through llm-caller (json mode).
import { corsHeaders } from "../_shared/cors.ts";
import { callLLMJson } from "../_shared/llmCallerClient.ts";

function buildNextMessagePrompt(config: {
  domain: string;
  experience: string;
  interviewType: string;
  techStack?: string[];
  history: { role: string; text: string }[];
}): string {
  const { domain, experience, interviewType, techStack, history } = config;
  const stackStr = techStack?.length ? techStack.join(", ") : "general";
  const turnCount = history.filter((h) => h.role === "interviewer").length;
  const isFirstMessage = history.length === 0;

  const historyBlock = history.length > 0
    ? history.map((h) => `${h.role === "interviewer" ? "Interviewer" : "Candidate"}: ${h.text}`).join("\n\n")
    : "";

  if (domain === "BPO" && interviewType !== "technical") {
    if (isFirstMessage) {
      return `You are a customer calling a support line. You are ${experience === "Fresher" ? "mildly frustrated" : experience === "Mid-Level" ? "frustrated" : "very angry"}.
Start the call naturally — introduce yourself briefly and state your complaint/issue in first person.
Be realistic: billing issues, service problems, technical difficulties, etc.
Keep it to 2-3 sentences max. Sound like a real person, not robotic.

Return JSON: {"message":"...","context":"scenario type"}
ONLY output JSON. No markdown.`;
    }
    return `You are a customer on a support call. Stay in character as the customer throughout.
Experience level of the agent: ${experience}.

Conversation so far:
${historyBlock}

Continue the conversation naturally as the customer:
- React to what the agent just said — acknowledge their response naturally
- If their response was helpful, express some relief but bring up a related concern or ask for specifics
- If their response was vague or unhelpful, express frustration and push for a real solution
- If they've resolved the issue well after several exchanges, you can thank them and bring up one more thing
- Mix scenarios: billing, tech support, returns, escalations — introduce new wrinkles naturally
- Keep responses to 1-3 sentences. Sound like a real customer, not a script.
- This is turn ${turnCount + 1}. Keep the conversation going naturally.

Return JSON: {"message":"...","context":"scenario type"}
ONLY output JSON. No markdown.`;
  }

  if (isFirstMessage) {
    const role = interviewType === "technical"
      ? `a senior technical interviewer for a ${domain} developer role (${stackStr})`
      : `a senior interviewer conducting a behavioral interview for a ${domain} professional`;
    return `You are ${role}. The candidate is ${experience}-level.
Start the interview with a brief, warm greeting. Introduce yourself with a first name, mention the role briefly, and ask your first question.
Keep the greeting to 2-3 sentences total — natural and professional, not stiff.

Return JSON: {"message":"...","context":"topic area"}
ONLY output JSON. No markdown.`;
  }

  if (interviewType === "technical") {
    return `You are a senior technical interviewer for a ${experience}-level ${domain} developer (${stackStr}).

Conversation so far:
${historyBlock}

Continue the conversation naturally:
- Briefly acknowledge what the candidate said (1 short sentence — "Good point", "Interesting", "I see")
- If their answer was weak, vague, or too brief, ask them to elaborate or probe deeper on the same topic
- If their answer was solid, naturally transition to a new topic
- Mix: system design, debugging, conceptual questions, practical problems
- Sound like a real interviewer having a conversation, not reading from a script
- Keep your response to 2-4 sentences total
- This is exchange ${turnCount + 1}

Return JSON: {"message":"...","context":"topic area"}
ONLY output JSON. No markdown.`;
  }

  return `You are a senior interviewer conducting a behavioral interview for a ${experience}-level ${domain} professional.

Conversation so far:
${historyBlock}

Continue the conversation naturally:
- Briefly acknowledge what the candidate said (1 short sentence)
- If their answer lacked specifics or examples, ask them to elaborate or give a specific example
- If their answer was strong, transition naturally to a new skill area
- Focus on: teamwork, conflict resolution, leadership, time management, adaptability
- Sound conversational and engaging, not robotic
- Keep your response to 2-4 sentences total
- This is exchange ${turnCount + 1}

Return JSON: {"message":"...","context":"skill area"}
ONLY output JSON. No markdown.`;
}

function buildEvaluatePrompt(config: {
  domain: string;
  experience: string;
  interviewType: string;
}, qaPairs: { question: string; answer: string; context: string }[]): string {
  const isBPO = config.domain === "BPO";
  return `You are a STRICT ${isBPO ? "call center quality analyst" : "interview evaluator"} scoring a ${config.experience}-level candidate in ${config.domain}.

SCORING GUIDELINES — BE CRITICAL:
- 90-100: Exceptional. Specific examples, clear structure, deep insight. Very rare.
- 70-89: Good. Solid answer with some specifics but could be deeper.
- 50-69: Average. Vague, generic, or missing key points.
- 30-49: Below average. Very brief, off-topic, or surface-level.
- 10-29: Poor. One-line answer, no substance, or barely relevant.
- 0-9: No answer or completely off-topic.

${isBPO ? `Evaluate on:
- Empathy and tone (did they acknowledge frustration?)
- Problem resolution (clear solution offered?)
- Professionalism (appropriate language, de-escalation)
- Completeness (all concerns addressed?)` : `Evaluate on:
- Relevance (did they actually answer the question?)
- Depth (specific examples, not vague generalities — PENALIZE heavily for generic answers)
- Communication clarity
- Technical accuracy (if applicable)`}

IMPORTANT: Do NOT be generous. One-line or vague answers should score 10-30. Only give 70+ for answers with specific examples and clear structure. Average conversational answers with no depth score 40-55.

Here are the Q&A pairs:
${qaPairs.map((qa, i) => `
Q${i + 1} [${qa.context}]: ${qa.question}
A${i + 1}: ${qa.answer || "(no answer provided)"}
`).join("")}

Return JSON:
{
  "overallScore": <0-100 weighted average>,
  "summary": "<2-3 sentence overall assessment — be honest about weaknesses>",
  "scores": [
    {"questionIndex": 0, "score": <0-100>, "feedback": "<1-2 sentence specific feedback>", "strengths": "<brief or empty>", "improvement": "<specific actionable advice>"}
  ]
}

ONLY output JSON. No markdown.`;
}

const j = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { mode } = body;
    const authHeader = req.headers.get("Authorization") || "";

    if (mode === "next-question") {
      const { domain, experience, interviewType, techStack, history } = body;
      const prompt = buildNextMessagePrompt({ domain, experience, interviewType, techStack, history: history || [] });
      const parsed = await callLLMJson<{ message?: string; question?: string; context?: string }>(authHeader, {
        feature: "mock_interview_next_question",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 400,
      });
      const message = parsed.message || parsed.question || "";
      const context = parsed.context || "general";
      return j({ success: true, question: { message, context } });
    }

    if (mode === "evaluate") {
      const { domain, experience, interviewType, qaPairs } = body;
      const prompt = buildEvaluatePrompt({ domain, experience, interviewType }, qaPairs);
      const evaluation = await callLLMJson(authHeader, {
        feature: "mock_interview_evaluate",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 2000,
      });
      return j({ success: true, evaluation });
    }

    return j({ success: false, error: `Unknown mode: ${mode}` }, 400);
  } catch (error: any) {
    console.error("[MockInterview] Error:", error);
    return j({ success: false, error: error?.message || "internal" }, 500);
  }
});
