# Scry — Backlog
*(formerly The Shard)*

---

### v0 — Lovable Prototype
*Goal: write a comprehensive PRD and produce a prototype in Lovable.*
Full UI shell built in Lovable: both Generate and Critique modes, history sidebar, chat panel, download button, mock AI responses. Established the visual direction — dark editorial aesthetic, amber-gold accent, Cormorant Garamond headings.

## Alpha — Ship for First Feedback
*Goal: get the core product in front of working and aspiring PMs for qualitative feedback. Teardown quality, UX clarity, and shareability are the only things that matter at this stage.*

Alpha Build
Wired everything to real infrastructure. Supabase auth (login, signup, password reset), Postgres DB persistence, Row Level Security, real Claude API via Supabase Edge Functions, LennyData MCP for corpus retrieval, Exa for live web search, two-step query pipeline (Haiku generates queries, Sonnet generates teardown). Prompt engineering guardrails locked in. Significant UI overhaul: renamed to Scry, full typography pass (Inter only), landing page hero with fire glow and coal line divider, three-column layout (history / teardown / chat), chat streaming, mobile tab fallback, shareable teardowns.

**Next: qualitative testing with 3-5 PMs** — mix of working and aspiring PMs. Share via link, observe cold. Key questions: does the teardown feel credible and sharp? Is Generate vs Critique mode distinction clear? Does the share flow work end to end? Collect feedback before prioritizing Beta work.

---

## Beta — Post-Feedback, Pre-LinkedIn
*Goal: act on alpha feedback, sharpen teardown quality and reading UX, add feedback mechanisms, fix rough edges before broader public release. Priority order TBD based on feedback received.*

### Output Quality & Prompt Engineering
- [ ] Master Rubric implementation — add explicit evaluation pillars to the system prompt (Business Model & Strategy, GTM / Growth Loops, Pricing & Packaging, UX Friction & Value Delivery). Model currently follows section structure without an internal rubric guiding what to look for. This sharpens analysis meaningfully.
- [ ] Saliency detection — feature vs company submission adjusts teardown depth automatically. Feature-level input narrows to UX/Value Proposition; company-level expands to full Strategy/Growth analysis.
- [ ] Conflicting perspectives surfacing — structurally instruct the model to look for disagreement across guests and flag it explicitly rather than flattening to consensus. Format: "The archive contains differing perspectives here — [Expert A] emphasizes X while [Expert B] argues Y."
- [ ] Evals — run 10-15 teardowns on well-known products, score against Master Rubric. Check: are citations accurate, is Lenny's Lens using Lenny's voice only, are sections appropriately scoped?
- [ ] Consider: Lead with strategic tension — prompt instruction to identify single highest-stakes unresolved paradox before writing any section, use every section as evidence for or against resolving it.

### Reading & UX
- [ ] Collapsible sections with summary line — each section shows a Claude-generated one-sentence sharp takeaway when collapsed. Expand to see full analysis. Requires prompt engineering change (add `summary` field per section) + UI toggle update.
- [ ] Substack-inspired reading UX — progressive disclosure, content feels written for someone specific. Each section summary is a sharp arguable claim, not a description.
- [ ] Full streaming via NDJSON — teardown/critique sections reveal one by one. Requires prompt format change + new frontend parsing logic. Replaces existing JSON salvage path.
- [ ] Download dark aesthetic — currently renders white/gray. Should preserve full Scry dark style.

### Intelligence & Corpus
- [ ] Product URL disambiguation — when product name is obscure, surface best-guess URL or confirm before generating
- [ ] Source bibliography — collect LennyData source URLs, render Sources section at bottom of teardown with links to episodes and newsletters

### Feedback & Product Loops
- [ ] Adversarial self-refinement loop — experiment first by running silent self-critique before output, no UI change. If quality improves, consider "Push Deeper" button as user-triggered second pass. Natural monetization gate. May slip to Phase 3 depending on complexity.

### UI & Polish
- [ ] Cursor haze effect — radial amber light follows cursor across hero, references Profound (tryprofound.com/careers). Film grain texture overlay. Proximity brightness falloff toward center. High-impression touch — transforms current fire glow into a live scrying pool.
- [ ] Add loading button state on signup/login
- [ ] Chat panel width tuning — 340px is starting point, revisit after real usage data

### Infrastructure
- [ ] **Security: `generate-teardown` trusts unverified JWTs** — `getUserFromJwt` only base64-decodes the token payload, it never verifies the signature. Any 3-part token with an arbitrary `email`/`sub` claim is accepted (this is exactly what the eval script's dev-bypass JWT relies on, see `scripts/eval/run-eval.mjs`). Need to check whether the function trusts the token's claimed `user_id` for writes or rate-limit checks without confirming it came from a real Supabase session — if so, anyone can forge a token to write as another user or dodge rate limits. Must fix (verify signature against Supabase's JWT secret/JWKS, or drop `verify_jwt = false` in `supabase/config.toml` for this function) before any wider beta release. Flagged during eval work on 2026-08-23, not fixed yet — do not treat as resolved.
- [ ] Code quality pass — separate agent reviews Edge Functions, prompt logic, RLS policies, rate limiting edge cases
- [ ] Google OAuth — nice-to-have, non-blocking
- [ ] Custom domain — currently the-shard-five.vercel.app
- [ ] Monetization model decision — freemium (5 teardowns/day free, unlimited paid) vs subscription. Decision needed before LinkedIn launch.
- [ ] Show what they're missing on limit hit — sales moment for paid tier upgrade
- [ ] Analytics and usage tracking

---

## Phase 3 — Later
*Goal: differentiation, delight, and scale. Nothing here is needed for feedback or LinkedIn launch.*

### Design & Experience
- [ ] Logo mark / scrying pool animation — dark crystalline vessel with living interior (fog, embers). Continuously animated, intensifies on cursor proximity. Needs real designer.
- [ ] Wordmark animation — slow cycle, hero only
- [ ] Thick coal line (3px) variant — hold until tested on large screen
- [ ] Visuals in teardowns — positioning map, growth loop diagram, feature matrix (Recharts or D3)
- [ ] Audio/listening feature — TTS via ElevenLabs or OpenAI TTS API
- [ ] Micro-animations — spark effect on submit, staggered section fade-in

### Intelligence
- [ ] Guest persona lenses — Growth / Design / Strategy / Investor. Each lens filters and reframes the teardown through a different expert worldview.
- [ ] Configurable teardown depth — user-selectable
- [ ] Master Rubric visibility — consider whether to expose to users
- [ ] Smart scope narrowing — post-generation, surface 2-3 drill-down angles using Exa results in parallel
- [x] Local corpus mirror — archive synced from the ZIP export into `public.lenny_corpus`, searched via `search_lenny_corpus()` FTS RPC. Kills the expiring-MCP-token dependency; `generate-teardown` no longer calls `mcp.lennysdata.com`. Refresh runbook: `scripts/sync-lenny-corpus.md`. Quarterly manual sync.
- [ ] Semantic retrieval — add an `embedding vector` column to `lenny_corpus` and rank by similarity; fast-follow to the FTS-only search, once FTS quality is judged on real teardowns
- [ ] Knowledge Graph layer — nodes: experts, frameworks, companies; edges: relationships

### Product
- [ ] User profiles — personalize teardowns based on role or interests over time
- [ ] Weekly newsletter pipeline — cron job + Resend or Loops. One AI-generated teardown per week based on trending product news. Decision needed: separate product or integrated?
- [ ] Rating per section — granular feedback on which teardown sections land vs miss

---

## Open Questions

- How to handle products not covered in Lenny's corpus? Reason by analogy, or surface a warning?
- Should the Master Rubric be visible to users?
- Newsletter: separate product or integrated?
- Monetization model: freemium / subscription / one-time?
- User profiles: personalize teardowns based on role or interests?
- New domain for Scry — what's available?

---

## Completed (full history)

- [x] Teardown feedback bar — Not useful / Useful / Excellent rating stored per teardown. Basic quality signal live before broader release
- [x] Scope hint on generate and critique input pages — clarifies expected input scope, reduces off-topic submissions
- [x] Citation compliance overhaul — full speaker names required, bare archive refs only, Lenny's Lens heading corrected, cross-attribution between adjacent excerpts prevented
- [x] Lenny's Lens speaker isolation — restricted to Lenny's own synthesis, pattern recognition across guests, and direct opinions; facilitation and paraphrase turns excluded
- [x] Query architecture overhaul — tightened grounding constraints, web relevance scoring, training-knowledge verifier added to cross-check cited claims against injected corpus
- [x] Chat: mid-stream submission prevention, max_tokens raised to 2000, send button dimmed during streaming
- [x] Output page polish — Teardown label above product name on generate page, product name promoted to hero heading on critique page, history sidebar language aligned with output page labels
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
- [x] Chat streaming — word-by-word response in chat panel
- [x] Password reset flow — forgot password link, Supabase email reset, /reset-password page
- [x] Signup inline message — replaced alert() with inline success message
- [x] Collapsible sections — chevron toggle on each section
- [x] Tighten output length — 3-5 sentences per section prompt constraint
- [x] Loading messages — 5 thematic messages, 8s each, stops on last
- [x] Usage counter — RLS fix, moved inline to generate/critique pages, right-aligned
- [x] Timezone-aware counter reset — resets at user's local midnight, not UTC
- [x] Rate limiting — 5 teardowns/day, 10 chat messages/teardown
- [x] vercel.json — SPA routing config so React Router paths work on Vercel
- [x] JSON parse resilience — salvage attempt if Claude response has syntax error
- [x] Git email fix — resolved Vercel deployment blocking due to local machine email
- [x] Product URL — prefer URLs on product's own domain over third-party sites
- [x] Dev bypass — skip rate limiting for owner account
- [x] Rename The Shard → Scry — repo, GitHub, Vercel, Supabase, frontend, docs
- [x] Global typography — Inter everywhere, citations at #A09A92
- [x] Landing page hero — fire glow, coal line, mode cards, centered layout, 100vh viewport fix
- [x] Chat panel — right-aligned user bubbles, Scry label, same font both sides
- [x] Footer — landing page only, "Powered by Lenny's Podcast & Newsletter"
- [x] History sidebar — scrollable, full height, collapsed state clean
- [x] Debug console.log statements removed
- [x] Trash icon delete fixed
- [x] Login error inline message
- [x] Mobile QA — full pass on iPhone Safari
- [x] Shareable teardowns — public read-only link, no account needed to view. Full Scry dark aesthetic. "Analyzed with Scry" attribution links to landing page. TEARDOWN/CRITIQUE badge with descriptor. Supabase anon GRANT + RLS policy for public reads.
