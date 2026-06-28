// Single source of truth for "how complete is this candidate profile?"
// Used by Edit Profile UI, Mentor's profile prompt, and patch_profile writes.

export const ESSENTIAL_FIELDS = [
  "stream",
  "branch",
  "institution",
  "graduation_year",
  "cgpa",
  "skills", // means: at least one skill in skills_v4
] as const;

export type EssentialField = (typeof ESSENTIAL_FIELDS)[number];

// Weighted set — basics + essentials. Total weights sum to 100.
const WEIGHTED: { key: string; weight: number; test: (c: any) => boolean }[] = [
  { key: "first_name",      weight: 6,  test: (c) => !!c.first_name },
  { key: "last_name",       weight: 4,  test: (c) => !!c.last_name },
  { key: "headline",        weight: 8,  test: (c) => !!c.headline },
  { key: "about",           weight: 8,  test: (c) => !!(c.about || c.bio) },
  { key: "location",        weight: 6,  test: (c) => !!c.location },
  { key: "stream",          weight: 10, test: (c) => !!c.stream },
  { key: "branch",          weight: 8,  test: (c) => !!c.branch },
  { key: "institution",     weight: 12, test: (c) => !!c.institution },
  { key: "graduation_year", weight: 10, test: (c) => !!c.graduation_year },
  { key: "cgpa",            weight: 8,  test: (c) => c.cgpa != null && c.cgpa !== "" },
  { key: "skills",          weight: 14, test: (c) => Array.isArray(c.skills_v4) && c.skills_v4.length > 0 },
  { key: "resume",          weight: 6,  test: (c) => !!c.resume_url },
];

export function computeProfileCompleteness(c: any): number {
  if (!c) return 0;
  let score = 0;
  for (const f of WEIGHTED) if (f.test(c)) score += f.weight;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function missingEssentials(c: any): EssentialField[] {
  if (!c) return [...ESSENTIAL_FIELDS];
  const out: EssentialField[] = [];
  if (!c.stream) out.push("stream");
  if (!c.branch) out.push("branch");
  if (!c.institution) out.push("institution");
  if (!c.graduation_year) out.push("graduation_year");
  if (c.cgpa == null || c.cgpa === "") out.push("cgpa");
  if (!(Array.isArray(c.skills_v4) && c.skills_v4.length > 0)) out.push("skills");
  return out;
}
