# Scry — Backlog

A prioritized list of everything to build, fix, or explore.
Updated as ideas come up during build sessions.

---

## v1 - Pre-Launch Checklist (before LinkedIn / public sharing)

### Completed
- [x] Password reset flow — "Forgot password?" on login page, Supabase built-in email reset
- [x] Chat loading state — typing indicator while Q&A response generates
- [x] Collapsible sections — chevron toggle on each teardown section
- [x] Tighten output length — 3-5 sentences per section prompt constraint
- [x] Signup UX — inline success message, no alert popup
- [x] Loading messages — 5 thematic messages at 8s each, stops on last

### Fixes Needed
- [ ] Fix: usage counter 406 error — RLS/permissions on usage_limits table
- [ ] Fix: trash icon delete not working in sidebar
- [ ] Fix: login error still showing as alert popup, needs inline message

### Still To Build
- [ ] Usage counter — move off header, show on generate/critique page instead
- [ ] Developer bypass — skip rate limiting for owner account
- [ ] Shareable teardowns — public read-only link, no account needed to view

---

## Phase 1 — Lovable Protptype - v0 [DONE]

## Phase 2 — App Build - v1/v2 - Ideas to consider [PROGRESSING]

- [ ] Stream Claude API responses for better perceived performance
- [ ] Add loading button state on signup/login
- [ ] Remove debug console.log statements from history.ts
- [ ] Google OAuth / sign in with Google (nice-to-have, non-blocking)
- [ ] Product URL disambiguation — when product name is obscure, surface best-guess URL or confirm before generating
- [ ] Source bibliography — collect LennyData source URLs and render a Sources section at bottom of teardown with links to episodes and newsletters. Inline footnote citations are a more elegant version — backlog for later.
- [ ] User timezone for rate limit messages — detect browser timezone, show "resets at midnight EST" instead of generic midnight
- [ ] Consider: Lead with strategic tension — add prompt instruction to identify the single highest-stakes unresolved paradox before writing any section, use every section as evidence for or against resolving it

---

## Phase 3 — Brainstorming for later

### Intelligence
- [ ] Custom RAG pipeline — contingency only, build if LennyData MCP becomes insufficient
- [ ] Knowledge Graph layer (nodes: experts, frameworks, companies; edges: relationships)
- [ ] Guest persona lenses: Growth / Design / Strategy / Investor
- [ ] Configurable teardown depth (user-selectable)
- [ ] Conflicting perspectives surfacing — show tension between experts explicitly
- [ ] Master Rubric visibility — consider whether to expose to users
- [ ] Smart scope narrowing — post-generation, surface 2-3 drill-down angles using Exa results in parallel
- [ ] Saliency detection — feature vs company submission adjusts teardown depth

### Product
- [ ] Shareable teardowns — public read-only link (also in pre-launch)
- [ ] Rating/feedback mechanism on teardown quality
- [ ] User profiles to personalize teardowns over time
- [ ] Weekly newsletter pipeline (cron job + Resend or Loops)
- [ ] Newsletter as separate product vs integrated — decision needed
- [ ] Adversarial self-refinement loop ("Push Deeper" button)
      User-triggered second pass — teardown gets internally critiqued and regenerated.
      Natural monetization gate: free users get one pass, paid users unlock refinement.
      Options:
      - Option A: Silent — always runs before output. Adds 20-40s, no user control.
      - Option B: Show process — draft, critique, final. Educational but heavy UX.
      - Option C (preferred): User-triggered "Push Deeper" button post-generation.
      Requires: new Edge Function mode, button in TeardownDisplay.

### UI & Design
- [ ] Visuals in teardowns — positioning map, growth loop diagram, feature matrix (Recharts or D3)
- [ ] Audio/listening feature — TTS via ElevenLabs or OpenAI TTS API
- [ ] Wordmark animation — slow cycle between off-white, gold, near-translucent (hero only)
- [ ] Proper logo mark — glass shard SVG
- [ ] Micro-animations — spark effect on submit, staggered section fade-in

### Monetization & Scale
- [ ] Monetization model decision — freemium (5 teardowns/day free, 10 paid) vs subscription
- [ ] Analytics and usage tracking
- [ ] Custom domain (currently the-shard-five.vercel.app)
- [ ] Show what they're missing on limit hit — sales moment for paid tier upgrade

---

## Open Questions (Decisions Needed)

- Should teardowns be shareable via public read-only link?
- How to handle products not covered in Lenny's corpus?
- Should the Master Rubric be visible to users?
- Newsletter: separate product or integrated?
- Monetization model: freemium / subscription / one-time?
- User profiles: personalize teardowns based on role or interests?

---

## Completed

- [x] Lovable prototype — full UI, both modes, history sidebar, chat panel, download button
- [x] Cursor dev environment set up — project running locally
- [x] Supabase project created — auth, Postgres DB, pgvector enabled
- [x] Real Supabase auth — login and signup functional with real users
- [x] Auth-aware session state — sidebar and routes hidden for logged-out users
- [x] Supabase DB persistence — teardowns and history saving to real database
- [x] Claude API connection — Edge Function deployed, real teardowns generating
- [x] Prompt engineering guardrails — no em dashes, no sycophancy, no AI filler, factual tone
- [x] Wire Critique mode to Edge Function
- [x] Wire real chat Q&A to Claude API
- [x] LennyData MCP connected — SSE parsing working, pipe-delimited queries
- [x] Exa web search integrated — teardowns grounded in current facts
- [x] Two-step query pipeline — Haiku generates queries, Sonnet generates teardown
- [x] Pipe-delimited query format — corpus jumped from 10k to 36k+ characters
- [x] Critique query generation — extracts product name from teardown text automatically
- [x] PDF extraction in Critique upload — pdfjs-dist@4.4.168 working in browser
- [x] Input validation in Critique mode — frontend + Edge Function guards against gibberish
- [x] Product name required in Critique mode — improves Query 1 retrieval
- [x] Critique input label updated — "What are you analyzing?" with flexible examples
- [x] Vercel deployment — live at the-shard-five.vercel.app
- [x] Dev branch setup — main deploys to Vercel, dev is working branch
- [x] Product URL — "Visit product →" amber-gold link under product name in generate mode
- [x] Chat loading indicator — animated dots while waiting for response
- [x] Password reset flow — forgot password link, Supabase email reset, /reset-password page
- [x] Signup inline message — replaced alert() with inline success message
- [x] Collapsible sections — chevron toggle on each section
- [x] Tighten output length — 3-5 sentences per section prompt constraint
- [x] Loading messages — 5 thematic messages, 8s each, stops on last
- [x] Usage counter — shows X of 5 today in header (RLS fix pending)
- [x] Rate limiting — 5 teardowns/day and 10 chat messages/teardown in Edge Function
- [x] vercel.json — SPA routing config so React Router paths work on Vercel
- [x] JSON parse resilience — salvage attempt if Claude response has syntax error
- [x] Git email fix — resolved Vercel deployment blocking due to local machine email
- [x] Product URL — prefer URLs on product's own domain over third-party sites
- [x] Rate limiting — 5 teardowns/day, 10 chat messages/teardown, resets midnight UTC