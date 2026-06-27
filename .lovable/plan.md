## Landing Page Plan — Sudo Mentor

Public marketing page at `/` to attract college students. Vapor Chrome palette (#c4b5fd, #818cf8, #67e8f9, #a5f3fc), Sora + Manrope typography, bento grid layout. Minimal, elegant, slightly futuristic.

### Routing changes
- `/` → new `Landing.tsx` (public, no auth)
- `/portal` → existing `CandidatePortalV4` (was at `/`)
- `/auth`, `/admin`, `/admin/login` — unchanged
- If a signed-in candidate hits `/`, show a subtle "Open my portal →" pill in the nav (no forced redirect — landing stays linkable).
- Update internal links (post-login redirect, sidebar logo, share intents) from `/` → `/portal`.

### Page sections (bento-first)

1. **Top nav** — Sudo Mentor wordmark, anchor links (Mentor, Projects, Practice, Jobs, App), "Sign in" + "Get started" CTAs. Glass blur on scroll.

2. **Hero** — Two-column on desktop, stacked on mobile.
   - Left: oversized Sora headline ("Your AI mentor for the career you actually want."), supporting line, two CTAs (Start free → /auth, Watch how it works → scroll), trust row ("Built for campuses · Free for students").
   - Right: floating mock device showing MentorCopilot chat bubble + XP/streak chip + a leaderboard rank pill. Soft iridescent blobs in background (CSS gradients, no images — pure tokens).

3. **Bento grid (the core)** — 6-tile asymmetric grid showcasing every migrated feature:
   - **Large tile (2x2): Sudo Mentor Copilot** — animated chat snippet, "Ask anything. Get a learning path."
   - **Tile: Internship Projects** — code/insights motif, "Build real projects. Get AI-evaluated."
   - **Tile: Daily Practice** — quiz card mock, "2 quizzes a day. Compounding skill."
   - **Tile: Campus Leaderboard** — rank chips, "Climb your campus board."
   - **Tile: Jobs & Applications** — role cards, "Apply with one tap."
   - **Wide tile: MyBoard + Notes** — canvas thumbnail, "Your second brain for college."

4. **Mobile app teaser** — Split section: phone mockup (CSS frame, gradient screen) + "Coming soon to iOS & Android" with email-capture style "Notify me" (visual only for now, posts to a `landing_waitlist` future table — wire later, button shows toast "We'll let you know").

5. **How it works** — 3-step horizontal: Sign in → Chat with mentor → Earn XP, build projects, get hired.

6. **Social proof strip** — College logos placeholder row + stat counters (Students, Projects shipped, XP earned) — static for now.

7. **Final CTA band** — Iridescent gradient panel, "Join the Sudo Mentor beta", Get started button.

8. **Footer** — Minimal: logo, links (Privacy, Terms, Contact), © 2026.

### Design system additions
- Install fonts: `@fontsource/sora`, `@fontsource/manrope` via bun add; import in `main.tsx`; register in `tailwind.config.ts` as `font-display` (Sora) and `font-sans` (Manrope) — scoped so it does not break the existing portal which uses default fonts.
- Add Vapor Chrome tokens to `index.css` under a `.landing` scope (or as additional CSS vars `--vapor-1..4`) so the existing portal tokens stay untouched.
- Use framer-motion (already permitted) for hero blob drift, bento card hover lift, scroll-in fade.
- All tiles use semantic tokens; no hardcoded colors in JSX.

### Files to create
- `src/pages/Landing.tsx` — page shell
- `src/components/landing/Nav.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/BentoGrid.tsx` (+ 6 tile subcomponents inline)
- `src/components/landing/MobileAppTeaser.tsx`
- `src/components/landing/HowItWorks.tsx`
- `src/components/landing/SocialProof.tsx`
- `src/components/landing/FinalCTA.tsx`
- `src/components/landing/Footer.tsx`

### Files to edit
- `src/App.tsx` — swap routes (`/` → Landing, `/portal/*` → portal).
- `src/main.tsx` — font imports.
- `src/pages/CandidateAuth.tsx` — post-login redirect to `/portal`.
- `src/components/candidate/v4/V4Shell.tsx` — logo link to `/portal`, "Sign out" returns to `/`.
- `src/components/candidate/v4/share/shareIntents.ts` — public share URLs.
- `tailwind.config.ts` — add Sora/Manrope families.
- `index.html` — title, meta description, OG tags for the landing page.

### Out of scope (later)
- Real waitlist table + edge function for "Notify me".
- Real campus logos and testimonials.
- App store deep links once apps ship.
- i18n.

### Verification
- `bun run build` clean.
- Playwright snapshot of `/` at 1280×1800 and 390×844 to confirm bento renders and CTAs link to `/auth` and `/portal`.
- Manual click-through: `/` → "Sign in" → `/auth` → success → `/portal`.
