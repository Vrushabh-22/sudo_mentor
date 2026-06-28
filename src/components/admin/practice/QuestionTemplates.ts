// Excel template definitions + generator + payload normalizer for practice question kinds.
import * as XLSX from "xlsx";

export type Kind = "mcq" | "true_false" | "fill_blanks" | "subjective" | "speech" | "scenario" | "ordering";

export const KIND_LABELS: Record<Kind, string> = {
  mcq: "Multiple Choice (MCQ)",
  true_false: "True / False",
  fill_blanks: "Fill in the Blanks",
  subjective: "Subjective / Written",
  speech: "Speech / Read-aloud",
  scenario: "Scenario MCQ",
  ordering: "Ordering (Drag & Drop)",
};

export type ColSpec = { name: string; required: boolean; example: string | number };

export const TEMPLATES: Record<Kind, { cols: ColSpec[]; help: string }> = {
  mcq: {
    help: "MCQ — single or multiple correct. RightChoices = comma-separated 1-based indexes (e.g. 1 or 1,3).",
    cols: [
      { name: "QuestionText", required: true, example: "What is 25% of 200?" },
      { name: "Choice1", required: true, example: "25" },
      { name: "Choice2", required: true, example: "50" },
      { name: "Choice3", required: false, example: "75" },
      { name: "Choice4", required: false, example: "100" },
      { name: "Choice5", required: false, example: "" },
      { name: "Choice6", required: false, example: "" },
      { name: "RightChoices", required: true, example: "2" },
      { name: "IsMultipleRightChoice", required: false, example: "No" },
      { name: "Explanation", required: false, example: "25% of 200 = 50" },
      { name: "Difficulty", required: false, example: "medium" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
  scenario: {
    help: "Same as MCQ but with a longer situational stem.",
    cols: [
      { name: "QuestionText", required: true, example: "Your teammate misses a deadline. What do you do first?" },
      { name: "Choice1", required: true, example: "Speak with them privately to understand why" },
      { name: "Choice2", required: true, example: "Escalate to the manager immediately" },
      { name: "Choice3", required: false, example: "Cover for them silently" },
      { name: "Choice4", required: false, example: "Ignore it" },
      { name: "RightChoices", required: true, example: "1" },
      { name: "Explanation", required: false, example: "Empathy + clarification before escalation." },
      { name: "Difficulty", required: false, example: "medium" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
  true_false: {
    help: "Statement + TRUE/FALSE.",
    cols: [
      { name: "QuestionText", required: true, example: "The sun rises in the east." },
      { name: "CorrectAnswer", required: true, example: "TRUE" },
      { name: "Explanation", required: false, example: "" },
      { name: "Difficulty", required: false, example: "easy" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
  fill_blanks: {
    help: "Use ___ in QuestionText for each blank. Answer1..Answer5 in order.",
    cols: [
      { name: "QuestionText", required: true, example: "The capital of France is ___." },
      { name: "Answer1", required: true, example: "Paris" },
      { name: "Answer2", required: false, example: "" },
      { name: "Answer3", required: false, example: "" },
      { name: "Answer4", required: false, example: "" },
      { name: "Answer5", required: false, example: "" },
      { name: "Difficulty", required: false, example: "easy" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
  subjective: {
    help: "Open-ended written answer evaluated against ScoringCriteria.",
    cols: [
      { name: "QuestionText", required: true, example: "Describe a time you led a team through a challenge." },
      { name: "ScoringCriteria", required: true, example: "STAR structure; ownership; measurable outcome." },
      { name: "Difficulty", required: false, example: "medium" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
  speech: {
    help: "Candidate reads ReferenceText aloud; pronunciation scored.",
    cols: [
      { name: "QuestionText", required: true, example: "Read the following paragraph clearly." },
      { name: "ReferenceText", required: true, example: "Effective communication starts with active listening..." },
      { name: "TimeLimitSeconds", required: false, example: 120 },
      { name: "Difficulty", required: false, example: "medium" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
  ordering: {
    help: "Items in CORRECT order. ScoringMode: partial_credit | all_or_nothing.",
    cols: [
      { name: "QuestionText", required: true, example: "Arrange the SDLC phases in order." },
      { name: "Item1", required: true, example: "Requirements" },
      { name: "Item2", required: true, example: "Design" },
      { name: "Item3", required: false, example: "Development" },
      { name: "Item4", required: false, example: "Testing" },
      { name: "Item5", required: false, example: "Deployment" },
      { name: "Item6", required: false, example: "" },
      { name: "Item7", required: false, example: "" },
      { name: "Item8", required: false, example: "" },
      { name: "Item9", required: false, example: "" },
      { name: "Item10", required: false, example: "" },
      { name: "ScoringMode", required: false, example: "partial_credit" },
      { name: "Difficulty", required: false, example: "medium" },
      { name: "StreamTag", required: false, example: "" },
    ],
  },
};

export function downloadTemplate(kind: Kind, subtopicName: string) {
  const spec = TEMPLATES[kind];
  const headers = spec.cols.map((c) => c.name);
  const example = spec.cols.map((c) => c.example);
  const hints = spec.cols.map((c) => (c.required ? "required" : "optional"));
  const ws = XLSX.utils.aoa_to_sheet([headers, hints, example]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  XLSX.writeFile(wb, `${subtopicName.replace(/\s+/g, "_")}_${kind}_template.xlsx`);
}

export type ParsedRow = {
  rowIndex: number;
  payload: any;
  difficulty: string;
  stream_tag: string | null;
  valid: boolean;
  errors: string[];
  preview: string;
};

function s(v: any): string { return v == null ? "" : String(v).trim(); }
function n(v: any): number | null { const x = Number(v); return Number.isFinite(x) ? x : null; }
const ALLOWED_DIFF = ["easy", "medium", "hard"];
function normDiff(v: any): string { const x = s(v).toLowerCase(); return ALLOWED_DIFF.includes(x) ? x : "medium"; }

export function parseRows(kind: Kind, rows: Record<string, any>[]): ParsedRow[] {
  return rows.map((r, i) => parseOne(kind, r, i + 2));
}

function parseOne(kind: Kind, row: Record<string, any>, rowIndex: number): ParsedRow {
  // case-insensitive accessor
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[k.toLowerCase().trim()] = row[k];
  const get = (k: string) => map[k.toLowerCase()];

  const errors: string[] = [];
  const difficulty = normDiff(get("Difficulty"));
  const stream_tag = s(get("StreamTag")) || null;
  let payload: any = {};
  let preview = "";

  switch (kind) {
    case "mcq":
    case "scenario": {
      const question = s(get("QuestionText"));
      const options: string[] = [];
      for (let i = 1; i <= 6; i++) { const v = s(get(`Choice${i}`)); if (v) options.push(v); }
      const rightRaw = s(get("RightChoices"));
      const isMulti = ["yes", "true", "1"].includes(s(get("IsMultipleRightChoice")).toLowerCase());
      if (!question || question.length < 5) errors.push("QuestionText too short");
      if (options.length < 2) errors.push("Need at least 2 choices");

      const indices: number[] = [];
      for (const tok of rightRaw.split(",").map((x) => x.trim()).filter(Boolean)) {
        const idx = Number(tok);
        if (Number.isFinite(idx) && idx >= 1 && idx <= options.length) indices.push(idx - 1);
        else {
          const matchIdx = options.findIndex((o) => o.toLowerCase() === tok.toLowerCase());
          if (matchIdx >= 0) indices.push(matchIdx);
          else errors.push(`RightChoices "${tok}" not a valid index or option`);
        }
      }
      if (indices.length === 0) errors.push("No correct answer");

      payload = isMulti || indices.length > 1
        ? { question, options, correct_indices: indices, explanation: s(get("Explanation")) }
        : { question, options, correct_index: indices[0] ?? 0, explanation: s(get("Explanation")) };
      preview = question;
      break;
    }
    case "true_false": {
      const question = s(get("QuestionText"));
      const ans = s(get("CorrectAnswer")).toLowerCase();
      const truthy = ["true", "t", "yes", "1"].includes(ans);
      const falsy = ["false", "f", "no", "0"].includes(ans);
      if (!question) errors.push("QuestionText required");
      if (!truthy && !falsy) errors.push("CorrectAnswer must be TRUE or FALSE");
      payload = {
        question,
        options: ["True", "False"],
        correct_index: truthy ? 0 : 1,
        explanation: s(get("Explanation")),
      };
      preview = question;
      break;
    }
    case "fill_blanks": {
      const question = s(get("QuestionText"));
      const answers: string[] = [];
      for (let i = 1; i <= 5; i++) { const v = s(get(`Answer${i}`)); if (v) answers.push(v); }
      if (!question) errors.push("QuestionText required");
      if (answers.length === 0) errors.push("At least one Answer required");
      payload = { question, answers };
      preview = question;
      break;
    }
    case "subjective": {
      const question = s(get("QuestionText"));
      const rubric = s(get("ScoringCriteria"));
      if (!question || question.length < 10) errors.push("QuestionText too short");
      if (!rubric) errors.push("ScoringCriteria required");
      payload = { prompt: question, rubric: rubric.split(/[;\n]/).map((x) => x.trim()).filter(Boolean) };
      preview = question;
      break;
    }
    case "speech": {
      const question = s(get("QuestionText"));
      const ref = s(get("ReferenceText"));
      const t = n(get("TimeLimitSeconds")) ?? 120;
      if (!question) errors.push("QuestionText required");
      if (!ref || ref.length < 10) errors.push("ReferenceText too short");
      payload = { prompt: question, reference_text: ref, time_limit: t };
      preview = ref.slice(0, 80);
      break;
    }
    case "ordering": {
      const question = s(get("QuestionText"));
      const items: string[] = [];
      for (let i = 1; i <= 10; i++) { const v = s(get(`Item${i}`)); if (v) items.push(v); }
      const mode = s(get("ScoringMode")).toLowerCase() || "partial_credit";
      if (!question) errors.push("QuestionText required");
      if (items.length < 2) errors.push("Need at least 2 items");
      payload = { prompt: question, correct_order: items, scoring_mode: mode };
      preview = question;
      break;
    }
  }

  return { rowIndex, payload, difficulty, stream_tag, valid: errors.length === 0, errors, preview };
}

export async function readWorkbook(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  // skip "required/optional" hint row if present
  return rows.filter((r) => {
    const vals = Object.values(r).map((v) => String(v).toLowerCase().trim());
    if (vals.length && vals.every((v) => v === "required" || v === "optional" || v === "")) return false;
    return true;
  });
}
