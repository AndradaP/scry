# The Shard — Backlog

A prioritized list of everything to build, fix, or explore.
Updated as ideas come up during build sessions.
Organized by phase — items move up as phases complete.

---

## Phase 2 — In Progress

### Must Do (Core functionality)
- [ ] Build RAG pipeline — chunk, embed, and store Lenny's transcripts and newsletters in pgvector
- [ ] Tag RAG chunks with metadata: speaker, speaker_type, content_type, expertise_domain, episode_date
- [ ] Build Lenny's Lens retrieval — filter chunks by speaker = "Lenny" AND content_type = "synthesis"
- [ ] Integrate web search (Tavily or Exa) for live product context in teardowns
- [ ] Build file upload parsing for Critique mode (.pdf, .docx, .txt)
- [ ] Add saliency detection to prompt — feature submission vs. company submission adjusts depth

### Polish (Phase 2 quality of life)
- [ ] Replace signup alert() with proper in-page success message
- [ ] Add loading button state on signup/login (visual feedback on click)
- [ ] Reduce Claude API max_tokens from 4000 to 2500 for faster responses - under consideration
- [ ] Stream Claude API responses for better perceived performance
- [ ] Remove debug console.log statements from history.ts
- [ ] Google OAuth / sign in with Google (nice-to-have, non-blocking)
- [ ] Add input validation to Critique mode — if submission is too short (< 50 words) or clearly not a teardown, return a short friendly message instead of a full critique. Something like: "This doesn't look like a product teardown. A teardown analyzes a specific product — its users, problem, solution, growth model, and design. Try submitting 200+ words on a product you want feedback on."
- [ ] Product URL disambiguation — when product is obscure or ambiguous, surface a best-guess URL or prompt user to confirm before generating teardowngit log HEAD..origin/main --oneline

---

## Phase 3 — Planned

### Intelligence
- [ ] Knowledge Graph layer on top of RAG (nodes: experts, frameworks, companies; edges: relationships)
- [ ] Guest persona lenses: Growth / Design / Strategy / Investor
- [ ] Configurable teardown depth (user-selectable)
- [ ] Conflicting perspectives surfacing — when corpus has tension between experts, show it
- [ ] Master Rubric visibility — consider whether to expose rubric to users in any form

### Product
- [ ] Shareable teardowns — public read-only link per teardown
- [ ] Rating/feedback mechanism on teardown quality
- [ ] User profiles to personalize teardowns over time
- [ ] Weekly newsletter pipeline (cron job + Resend or Loops)
- [ ] Newsletter as separate product vs. integrated — decision needed

### UI & Design
- [ ] Visuals in teardowns:
  - Positioning map (2x2 chart) in Strategy & Positioning section
  - Growth loop diagram in Growth Model section
  - Feature comparison matrix in Feature Breakdown section
  - AI-generated SVGs via structured data → Recharts or D3
- [ ] Audio/listening feature — TTS via ElevenLabs or OpenAI TTS API
- [ ] Wordmark animation — slow cycle between off-white, gold, near-translucent (hero only)
- [ ] Proper logo mark — glass shard SVG, design in Figma or commission
- [ ] Micro-animations: spark effect on submit, staggered section fade-in
- [ ] "Strategic Shards" section label treatment — A/B test vs current labels

### Monetization & Scale
- [ ] Monetization model decision: freemium (X teardowns/month free) vs. subscription vs. one-time
- [ ] Analytics and usage tracking
- [ ] Vercel deployment (currently local only)

---

## Open Questions (Decisions Needed)

- Should teardowns be shareable via public read-only link?
- How to handle products not well-covered in Lenny's corpus? (reason by analogy? surface a warning?)
- Should the Master Rubric be visible to users in any form?
- Newsletter: separate product or integrated into the main app?
- Monetization model: freemium / subscription / one-time?
- User profiles: personalize teardowns based on user's role or interests over time?

---

## Completed

- [x] Lovable prototype — full UI, both modes, history sidebar, chat panel, download button
- [x] Cursor dev environment set up — project running locally
- [x] Supabase project created — auth, Postgres DB, pgvector enabled
- [x] Real Supabase auth — login and signup functional with real users
- [x] Auth-aware session state — sidebar and routes hidden for logged-out users
- [x] Supabase DB persistence — teardowns and history saving to real database (replaced localStorage)
- [x] Claude API connection — Edge Function deployed, real teardowns generating
- [x] Prompt engineering guardrails — no em dashes, no sycophancy, no AI filler, factual tone
- [x] Wire Critique mode to Edge Function (same as Generate — next immediate task)
- [x] Wire real chat Q&A to Claude API (currently still returning placeholder responses)