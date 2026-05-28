# Scry — Backlog
*(formerly The Shard)*

---

## Alpha — Ship for First Feedback
*Goal: get the core product in front of working and aspiring PMs for qualitative feedback. Teardown quality, UX clarity, and shareability are the only things that matter at this stage.*

### Still To Build
- [ ] Shareable teardowns — public read-only link, no account needed to view. All sections fully expanded by default. Preserves full Scry dark aesthetic.
- [ ] Mobile QA — full pass on iPhone Safari. Check: landing page, login/signup, generate/critique input, teardown result, chat tabs, history sidebar, keyboard behavior.

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

### Intelligence & Corpus
- [ ] Product URL disambiguation — when product name is obscure, surface best-guess URL or confirm before generating
- [ ] Source bibliography — collect LennyData source URLs, render Sources section at bottom of teardown with links to episodes and newsletters

### Feedback & Product Loops
- [ ] Rating and feedback mechanism — thumbs up/down per teardown with optional comment. Stretch: per-section rating so you know which parts land. Needed before broader release to have a signal to act on.
- [ ] Adversarial self-refinement loop — experiment first by running silent self-critique before output, no UI change. If quality improves, consider "Push Deeper" button as user-triggered second pass. Natural monetization gate. May slip to Phase 3 depending on complexity.

### UI & Polish
- [ ] Cursor haze effect — radial amber light follows cursor across hero, references Profound (tryprofound.com/careers). Film grain texture overlay. Proximity brightness falloff toward center. High-impression touch — people feel it immediately. Transforms current fire glow into a live scrying pool.
- [ ] Download dark aesthetic — currently renders white/gray. Should preserve full Scry dark style.
- [ ] Add loading button state on signup/login
- [ ] Chat panel width tuning — 340px is starting point, revisit after real usage data

### Infrastructure
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
- [ ] Guest persona lenses — Growth / Design / Strategy / Investor. Each lens filters and reframes the teardown through a different expert worldview. Requires UI decision (select before or after generation?) and significant prompt engineering.
- [ ] Configurable teardown depth — user-selectable
- [ ] Master Rubric visibility — consider whether to expose to users
- [ ] Smart scope narrowing — post-generation, surface 2-3 drill-down angles using Exa results in parallel
- [ ] Custom RAG pipeline — contingency only, build if LennyData MCP becomes insufficient
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

## What We Built

### v0 — Lovable Prototype
Full UI shell built in Lovable: both Generate and Critique modes, history sidebar, chat panel, download button, mock AI responses. Established the visual direction — dark editorial aesthetic, amber-gold accent, Cormorant Garamond headings.

### Alpha — Full Product Build
Wired everything to real infrastructure. Supabase auth (login, signup, password reset), Postgres DB persistence, Row Level Security, real Claude API via Supabase Edge Functions, LennyData MCP for corpus retrieval, Exa for live web search, two-step query pipeline (Haiku generates queries, Sonnet generates teardown). Prompt engineering guardrails locked in. Significant UI overhaul: renamed to Scry, full typography pass (Inter only), landing page hero with fire glow and coal line divider, three-column layout (history / teardown / chat), chat streaming, mobile tab fallback, shareable teardowns.
