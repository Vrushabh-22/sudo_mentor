## Redesign `/auth` — split-screen, on-brand

Make the candidate sign-in page feel like a continuation of the landing: minimal, elegant, Vapor Chrome (Sora display + Manrope body, lavender→cyan iridescence). No "Candidate Portal" title.

### Layout (desktop ≥ lg)
Two-column split, full-height.

```text
┌──────────────────────────┬─────────────────────────┐
│  BRAND PANEL (left 55%)  │  FORM PANEL (right 45%) │
│  - iridescent gradient   │  - clean white          │
│  - sudo·mentor wordmark  │  - "Welcome back"       │
│  - oversized tagline     │  - Google/GitHub/LI     │
│  - 3 feature chips       │  - divider              │
│  - testimonial quote     │  - email + password     │
│                          │  - Privacy/Terms note   │
└──────────────────────────┴─────────────────────────┘
```

Mobile: brand panel collapses to a slim top band (wordmark + one-line tagline) above the form.

### Brand panel content
- Top: small `sudo·mentor` lockup + back-arrow link to `/`.
- Headline (Sora, 5xl): *"Welcome to your career copilot."*
- Sub (Manrope): *"Mentor. Projects. Practice. Jobs — all in one place."*
- 3 chip rows with icons (Brain "AI mentor that remembers you", Code2 "Internship-grade projects", Trophy "Climb your campus board").
- Bottom: subtle testimonial card — *"Got my first internship in 6 weeks." — Aman, IIT-D*.
- Two floating animated blobs (framer-motion) using #c4b5fd / #67e8f9 / #818cf8 for depth, mix-blend overlay dot pattern at low opacity.

### Form panel content
- Replace `<CardTitle>Candidate Portal</CardTitle>` with `<h1>Welcome back</h1>` + `<p>Sign in to continue your journey</p>`.
- Drop the Briefcase badge.
- Keep all existing auth logic (Google / GitHub / LinkedIn OAuth, email+password, autoLogin token handler, redirects to `/portal`, toast errors). No behavior changes — pure presentation.
- Add Privacy / Terms footer line (placeholder links).
- Add "← Back to home" link at top of form column on mobile (already covered on desktop by brand panel link).
- Add "New here? Pick any social login — we'll set up your account." helper line below the social block.

### Files
- Edit `src/pages/CandidateAuth.tsx` — replace JSX from line ~160 onwards (the return block), keep all hooks/handlers untouched.

No new deps; framer-motion already installed.

### Verification
- `bunx tsgo --noEmit` clean.
- Visual check at 1280 and 390 wide via the existing preview.
- Click "Continue with Google" still triggers the OAuth flow.
