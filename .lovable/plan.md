## Goal
Replace the remaining stub tabs in the candidate portal with the real components from `lovable-hiring-hub-02`, so the entire V4 portal works end-to-end against the same ATS Supabase backend.

## Status going in
Already ported with source parity: V4Home, MentorCopilot (+ chat/MessageRenderer, LPSuggestionCard, ProfileFormCard), MockInterviewOverlay, InterviewRecapCard, LearningPathView, AIOrb, share/ShareSheet+ShareCard+shareIntents, plus all UI primitives. Build is green.

Still stubbed: PracticeHub, LeaderboardView, CandidateProfileV4, V4JobsTab, V4Projects, MyBoardCanvas, V4TenantSwitcher, InstallAppButton.

## Approach — port in three batches across three turns

### Batch A — Light tabs (this next turn)
Lowest-risk, smallest tabs, no large transitive trees:
- `V4TenantSwitcher.tsx` — header tenant switcher dropdown.
- `InstallAppButton.tsx` — PWA install prompt button.
- `LeaderboardView.tsx` — campus/global rank tabs, calls `mentor-leaderboard` edge function.
- `PracticeHub.tsx` — daily practice quiz, calls `candidate-practice-*` edge functions.

### Batch B — Profile + Jobs (turn after)
- `CandidateProfileV4.tsx` — full profile editor (skills, projects, certifications, social links, resume via existing `CandidateResumeCard`).
- `V4JobsTab.tsx` — discover + my-applications view; reuses simplified `V2ApplicationsList` + `V4ApplicationTimeline` already in place.
- Any additional minor deps surfaced during port.

### Batch C — Heavy tabs (final turn)
- `V4Projects.tsx` + `projects-cluster/` subtree (TasksBoard, CodeInsightsBoard, ProjectAccordionRow, useMyProjects, useCandidateTasks, projectPalette).
- `MyBoardCanvas.tsx` + `myboard/` subtree (BoardFrame, ClusterConnectors, useCanvasViewport) — infinite-canvas dashboard.
- `notes/` workspace (TipTap-based) if MyBoard requires it inline; otherwise lazy-load.

## Method for each tab
1. Read the full source file from `lovable-hiring-hub-02` via `cross_project--read_project_file` (no subagents — they previously hallucinated).
2. Read all imported sibling files referenced by it.
3. Write the real file at the same path in this project.
4. After each batch, run `tsgo --noEmit` to catch import/type breaks immediately.
5. After Batch C, headlessly load the published site, sign in with a test account if available, and screenshot each tab to confirm render.

## Out of scope for this plan
- Re-porting `V2WorkflowStages` (936 lines, recruiter-heavy). The current simplified `V4ApplicationTimeline` will keep showing read-only application stages; deep interview/assessment surfaces stay on the main ATS portal as already noted.
- The Supabase OAuth redirect to `alpharecrewt.ai` — that is a backend allow-list config the user controls in the ATS Supabase dashboard, not a code change here.

## Deliverable per turn
- Batch A: tenant switcher + install + Leaderboard + Practice tabs working live.
- Batch B: Profile + Jobs tabs working live.
- Batch C: Projects + MyBoard working live; full portal feature-complete vs source.

Please approve to start Batch A.