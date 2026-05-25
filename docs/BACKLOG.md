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
- [ ] Add saliency detection to prompt — feature submission vs. company submission adjusts depth
- [ ] Stream Claude API responses for better perceived performance

### Polish (Phase 2 quality of life)
- [ ] Replace signup alert() with proper in-page success message
- [ ] Add loading button state on signup/login (visual feedback on click)
- [ ] Remove debug console.log statements from history.ts
- [ ] Google OAuth / sign in with Google (nice-to-have, non-blocking)
- [ ] Collapsible sections — each teardown section has a down arrow to expand/collapse.
      Default state TBD (all open vs. summary-only first).
- [ ] Tighten teardown length — change prompt constraint from "2 paragraphs"
      to "3-5 sentences per section" for better compliance and denser output.
- [ ] Product URL disambiguation — when product is obscure or ambiguous, surface a best-guess
      URL or prompt user to confirm before generating teardown. Add to backlog for Cursor.

---

## Phase 3 — Planned

### Intelligence
- [ ] Knowledge Graph layer on top of RAG (nodes: experts, frameworks, companies; edges: relationships)
- [ ] Guest persona lenses: Growth / Design / Strategy / Investor
- [ ] Configurable teardown depth (user-selectable)
- [ ] Conflicting perspectives surfacing — when corpus has tension between experts, show it
- [ ] Master Rubric visibility — consider whether to expose rubric to users in any form
- [ ] Smart scope narrowing — when user submits a broad product name, do a quick Exa search
      for recent updates and surface 2-3 clickable options post-generation (not pre-generation)
      e.g. "Go deeper on Figma's AI agent" / "Compare vs Canva" 
      Preferred: Option B — generate immediately, surface drill-down angles in parallel.
      No extra wait time for the user.

### Product
- [ ] Shareable teardowns — public read-only link per teardown
- [ ] Rating/feedback mechanism on teardown quality
- [ ] User profiles to personalize teardowns over time
- [ ] Weekly newsletter pipeline (cron job + Resend or Loops)
- [ ] Newsletter as separate product vs. integrated — decision needed
- [ ] Adversarial self-refinement loop ("Push Deeper" button)
      After initial teardown generates, user can trigger a second pass where the output
      is internally critiqued and a stronger version is produced.

      Preferred: Option C — user-triggered via "Push Deeper" button post-generation.
      Keeps initial load fast, creates engagement moment, natural monetization gate
      (free users get one pass, paid users unlock refinement).

      Other options considered:
      - Option A: Silent refinement — always runs critique + regenerate before showing output.
        Better quality floor, but adds 20-40s to every generation. No user control.
      - Option B: Show the process — display initial teardown, then critique, then refined version.
        Educational and transparent, but heavy UX. Better fit for a learning-focused mode.

      Implementation: new Edge Function call triggered by button click, passes current
      teardown output as context for critique + regeneration in one prompt.
      Requires: "Push Deeper" button in TeardownDisplay, new mode in Edge Function.

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
- [ ] PDF extraction — implement server-side via Edge Function base64 approach.
      Browser-side pdfjs has Vite compatibility issues with newer versions.
      Current workaround: pdfjs-dist@4.4.168 working in browser. Monitor for breakage.

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
- [x] Wire Critique mode to Edge Function
- [x] Wire real chat Q&A to Claude API
- [x] LennyData MCP connected — SSE parsing working, named entity + pipe-delimited queries
- [x] Exa web search integrated — teardowns grounded in current facts
- [x] Two-step query pipeline — Haiku generates queries, Sonnet generates teardown
- [x] Pipe-delimited query format — corpus jumped from 10k to 28k+ characters
- [x] Critique query generation — extracts product name from teardown text automatically
- [x] PDF extraction in Critique upload — pdfjs-dist@4.4.168 working in browser
- [x] Input validation in Critique mode — frontend + Edge Function guards against gibberish
- [x] Product name required in Critique mode — improves Query 1 retrieval
- [x] Critique input label updated — "What are you analyzing?" with flexible examples