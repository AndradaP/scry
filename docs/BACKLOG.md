# The Shard — Backlog

A prioritized list of everything to build, fix, or explore.
Updated as ideas come up during build sessions.
Organized by phase — items move up as phases complete.

---

## Pre-Launch Checklist (before LinkedIn / public sharing)

- [ ] Password reset flow — "Forgot password?" on login page. Supabase built-in email reset. Blocker before public sharing.
- [ ] Rate limiting — max N teardowns + N chat messages per user per day. Prevents API abuse before public sharing.
- [ ] Chat loading state — show a typing indicator or spinner while Q&A response is generating. Fresh users think it's broken without it.
- [ ] Collapsible sections — each teardown section has a chevron toggle. Wall of text kills first impressions.
- [ ] Tighten output length — change prompt constraint to "3-5 sentences per section" for denser output.
- [ ] Signup UX — replace alert() with inline success message.

---

## Phase 2 — In Progress

### Must Do
- [ ] Add saliency detection to prompt — feature submission vs. company submission adjusts depth
- [ ] Stream Claude API responses for better perceived performance
- [ ] Chat loading indicator — typing indicator or subtle spinner in chat panel while waiting for response

### Polish
- [ ] Delete history entries — select / select all + delete in sidebar. Simplest first: single entry delete via trash icon on hover.
- [ ] Replace signup alert() with proper in-page success message
- [ ] Add loading button state on signup/login
- [ ] Remove debug console.log statements from history.ts
- [ ] Google OAuth / sign in with Google (nice-to-have, non-blocking)
- [ ] Product URL disambiguation — when product name is obscure, surface best-guess URL or confirm before generating
[ ] Source bibliography — collect LennyData source URLs returned with each search 
      result and render a "Sources" section at the bottom of each teardown with links 
      back to the actual podcast episodes and newsletter posts. Differentiating — makes 
      The Shard feel like a research tool. Moderate effort.
      Note: inline footnote citations are a more elegant version of this — backlog for later.
- [ ] Loading messages cycle too fast and repeat a few times (about 5) for Teardowns and Critiques alike. Fix: slow the rotation 
      interval (consider ~2x) and stop on the last message until generation completes.

---

## Phase 3 — Planned

### Intelligence
- [ ] Custom RAG pipeline — contingency only. Only build if LennyData MCP becomes insufficient (downtime, retrieval limits, speaker filtering needs). Current MCP retrieval quality is solid.
- [ ] Knowledge Graph layer (nodes: experts, frameworks, companies; edges: relationships)
- [ ] Guest persona lenses: Growth / Design / Strategy / Investor
- [ ] Configurable teardown depth (user-selectable)
- [ ] Conflicting perspectives surfacing — when corpus has tension between experts, show it explicitly
- [ ] Master Rubric visibility — consider whether to expose rubric to users
- [ ] Smart scope narrowing — post-generation, surface 2-3 drill-down angles using Exa results
      that ran in parallel. No extra wait time. e.g. "Go deeper on Figma's AI agent"

### Product
- [ ] Shareable teardowns — public read-only link per teardown
- [ ] Rating/feedback mechanism on teardown quality
- [ ] User profiles to personalize teardowns over time
- [ ] Weekly newsletter pipeline (cron job + Resend or Loops)
- [ ] Newsletter as separate product vs. integrated — decision needed
- [ ] Adversarial self-refinement loop ("Push Deeper" button)
      User-triggered second pass — teardown gets internally critiqued and regenerated.
      Natural monetization gate: free users get one pass, paid users unlock refinement.
      Options considered:
      - Option A: Silent — always runs before showing output. Adds 20-40s, no user control.
      - Option B: Show process — display draft, critique, then final. Educational but heavy UX.
      - Option C (preferred): User-triggered post-generation "Push Deeper" button.
      Requires: new Edge Function mode, button in TeardownDisplay.

### UI & Design
- [ ] Visuals in teardowns — positioning map, growth loop diagram, feature matrix (Recharts or D3)
- [ ] Audio/listening feature — TTS via ElevenLabs or OpenAI TTS API
- [ ] Wordmark animation — slow cycle between off-white, gold, near-translucent (hero only)
- [ ] Proper logo mark — glass shard SVG
- [ ] Micro-animations — spark effect on submit, staggered section fade-in

### Monetization & Scale
- [ ] Monetization model decision — freemium (N teardowns/month) vs. subscription vs. one-time
- [ ] Analytics and usage tracking
- [ ] Custom domain (currently the-shard-five.vercel.app)

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
- [x] Product URL — surface first Exa result URL as "Visit product →" link under 
      product name in generate mode output.
