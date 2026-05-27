# Scry — Product Requirements Document
*(formerly The Shard)*

**Version:** 0.5
**Last Updated:** May 2026
**Status:** Phase 2 active — MCP intelligence layer in progress

---

## 1. Overview

**Scry** is an AI-powered product teardown tool for working PMs and aspiring PMs. It transforms Lenny Rachitsky's podcast transcripts and newsletter content into an intelligent engine that produces deep, structured product teardowns and critiques — on demand.

The name carries the same Tolkien lineage as the original name (The Shard): to scry is to see truth in a dark reflective surface — a mirror, a pool, a palantír. It's what Tolkien's seers do. Lenny's content is the dark surface. Scry is the act of seeing what's really there. The name was chosen over The Shard (retired due to phonetic issues and growing database/infra connotations) after a full naming exploration — see Section 5 for the full reasoning.

### Core Value Proposition
Most product analysis tools give you surface-level summaries. Scry gives you the frameworks, vocabulary, and depth of the world's best product thinkers — distilled into a structured teardown of any product you care about. It is evidence-led: every insight traces back to the archive.

### Target Users
- **Working PMs** seeking competitive intelligence and structured frameworks
- **Aspiring PMs / PM students** building product sense through practice and expert-grounded feedback

---

## 2. Product Modes

| Mode | Input | Output |
|------|-------|--------|
| **Generate** | Product name or category | AI-generated full-stack teardown |
| **Critique** | User-written teardown (text or file upload) | AI critique of the user's teardown |

Both modes include a **read-only output** + **chat interface docked below** for follow-up Q&A.

---

## 3. Features

### Feature 1: Generate a Teardown

**User Input Options:**
- Specific product: "Tear down Plaid"
- Vague category: "A popular payments product" → system surfaces top candidates, user selects
- Feature-level: "Tear down Uber's surge pricing feature"

**Saliency Detection:**
The system detects submission scope and adjusts depth:
- Feature submission → narrows to UX/Value Proposition analysis
- Company submission → expands to full Strategy/Growth analysis

**Teardown Output Structure:**
1. Product Overview
2. Strategy & Positioning
3. Feature Breakdown
4. Growth Model
5. Design Analysis
6. Key Insights
7. Lenny's Lens — Lenny's own synthesis and voice (see attribution rules below)

**Data Sources:**
- LennyData MCP (primary intelligence layer) — 356 newsletters + 300 podcast transcripts
- Live web/news data via web search (Exa) — integrated in Phase 2
- Claude's training knowledge as fallback

---

### Feature 2: Critique My Teardown

**Input:** Free-text or file upload (.pdf, .docx, .txt)

**Critique Output Structure:**
1. Overall Assessment
2. Strengths
3. Gaps & Blind Spots
4. Framework Alignment
5. Suggested Improvements (includes Blind Spot Injection)
6. Lenny's Lens

**Blind Spot Injection:** After primary critique, surfaces 1-2 dimensions the user hadn't considered, drawn from the Master Rubric.

---

### Feature 3: Chat Q&A
Both modes include a chat panel docked below the output. The chat:
- Answers follow-up questions grounded in the teardown/critique
- Handles pushback, clarifying questions, and what-if scenarios
- Is topic-locked to product strategy
- Has access to the same corpus context as the teardown

---

### Feature 4: Teardown History
- Collapsible left sidebar (like Claude.ai)
- Filter tabs: All / Generated / Critiques
- Search by product name
- Clicking entry reopens full teardown + chat thread

---

### Feature 5: Weekly Newsletter *(Phase 3)*
- Automated weekly digest of one AI-generated teardown based on trending product/tech news
- Same engine as Feature 1
- Email delivery + in-app archive

---

## 4. Intelligence Layer

### Data Source: LennyData MCP
**What it is:** A managed API providing access to Lenny Rachitsky's full archive — 356 newsletter posts and 300 podcast transcripts — as structured, searchable markdown files. New podcast transcripts are added automatically as episodes are published.

**Connection:** `https://mcp.lennysdata.com/mcp` — connected to Claude.ai and available as a tool in the Edge Function.

**Why MCP instead of a custom RAG pipeline:**
- Zero pipeline to build or maintain
- Always up to date automatically
- No storage, embedding, or infrastructure costs
- Retrieval quality handled by LennyData's search
- Can revisit custom RAG in Phase 3 if retrieval quality needs improvement

**What the corpus contains:**
- Full podcast transcripts with speaker labels: `**Lenny Rachitsky** (timestamp):` and `**Guest Name** (timestamp):`
- Newsletter posts in markdown format
- Metadata: title, date, tags (growth, design, strategy, B2C, B2B, etc.), word count, source URL

### How the Intelligence Layer Works

**At teardown/critique generation time:**
1. Edge Function receives the product name or user teardown
2. Edge Function queries LennyData MCP with relevant search terms (product name, category, relevant frameworks)
3. MCP returns top matching excerpts from transcripts and newsletters
4. Excerpts are injected into the Claude system prompt as corpus context
5. Claude generates the teardown grounded in real Lenny corpus content
6. Citations appear inline: *(Guest Name, Domain)*

**At chat time:**
- Same process — relevant corpus excerpts injected alongside teardown context
- Claude answers grounded in both the teardown and the corpus

### Lenny's Lens — Attribution Rules

Lenny's turns in transcripts fall into three types:

**Type 1 — Facilitation (do NOT use for Lenny's Lens):**
Questions, prompts, and paraphrases of what a guest just said. e.g. *"What's the most counterintuitive lesson you've learned?"*

**Type 2 — Cross-guest synthesis (USE for Lenny's Lens):**
Lenny connecting patterns across multiple conversations. e.g. *"There's an interesting pattern I found across a bunch of recent guests..."* This is his own synthesis even when referencing others.

**Type 3 — Direct opinion/anecdote (USE for Lenny's Lens):**
Lenny pushing back, sharing personal experience, or stating a direct view. Often begins with "I think...", "I've noticed...", "My take is...", "I disagree..."

**Implementation:** The Claude prompt for Lenny's Lens instructs: *"Draw only from moments where Lenny Rachitsky offers his own synthesis, pattern recognition across guests, personal anecdotes, or direct opinions — not from moments where he is simply asking questions or paraphrasing what a guest just said."*

### Master Rubric
The intelligence layer is anchored by a Master Rubric — evaluation pillars derived from the corpus:
- Business Model & Strategy
- GTM / Growth Loops
- Pricing & Packaging
- UX Friction & Value Delivery

Acts as a dynamic filter — shapes what Claude looks for depending on submission scope.

### Conflicting Perspectives
If the corpus contains tension between experts on a topic, surface it rather than flatten it. Format: *"The archive contains differing perspectives here — [Expert A] emphasizes X while [Expert B] argues Y."*

---

## 5. Naming & Brand Identity

### Why We Moved Away from The Shard

The Shard was a strong name with real conceptual grounding — a Tolkien nod, a fragment of something ancient and clarifying, Lenny's content as the fire. The design direction (crystalline, cold light on dark stone, amber-gold accent) flowed directly from it. That lineage is preserved in Scry; nothing is being abandoned, only sharpened.

The reasons to move on were two: the phonetic proximity to "shart" is real enough to be distracting, and "shard" carries growing infra connotations (database sharding) that pull technical users toward the wrong mental model. Neither is fatal, but when a better option exists there's no reason to carry the baggage.

### Name Shortlist Considered

**Verso**
The left-hand page of an open manuscript — the hidden face, what you see when you turn something over. Elegant, European, editorial. Fits the Cormorant Garamond aesthetic naturally. Of the three finalists, Verso is the most personally resonant — the one that matches the overall sensibility of the builder. Set aside because the name is genuinely crowded: a pharma AI product family, an AI media studio, a clean music app, and others all operate under Verso. Not a legal blocker for a side project, but enough to give pause.

**Glyph**
A mark that carries compressed meaning — signals and patterns baked into a product's surface that the app decodes. Geometric, precise, slightly architectural. The most approachable and fun of the three, which cuts both ways: accessible but perhaps too light for a tool PMs are meant to trust for serious analysis. Domain taken.

**Scry** ← Selected
To scry is to see truth in a dark reflective surface — a mirror, a pool, a palantír. It's what Tolkien's seers do. It's the act the app performs: you bring a product, and the darkness shows you what's really there. The most conceptually locked of the three — every design decision flows from the name without forcing it. Short, strange enough to be memorable, and ownable in this category. The slight unfamiliarity is a feature: it stays with you.

### Why Scry

Scry is the only name where the design intent is native rather than applied. The cursor effect, the dark glass aesthetic, the fire and coal palette, the Tolkien lineage — none of it needs to be explained or justified. It all lives inside the word already. Verso is more elegant. Glyph is more approachable. Scry is the most coherent as a total product identity, and coherence compounds.

---

## 6. Design System

### Color Palette
The existing foundation stays largely intact. Scry deepens rather than replaces it — the palette shifts from cold stone toward onyx and burning coal.

- Background: `#0A0A08` near-black onyx (deepened from `#111210`)
- Surface: `#1C1B17` dark glass
- Primary text: `#F0EBE0` warm parchment
- Accent: `#D4A843` amber-gold — section labels, CTAs, wordmark
- Secondary accent: ember orange `#C4581A` — used sparingly for warmth, hover states
- Muted text: `#7A7670` stone gray
- Borders: `#2E2C28`

### Typography
- Headings: Cormorant Garamond
- Section labels: DM Mono, 11px, letter-spacing 0.15em, all-caps, amber-gold
- Body text: Lora, 16px, line-height 1.75, warm parchment
- Citations: italic, `#7A7670`, 14px, format: *(Name, Domain)*

### Wordmark
"Scry" alone — single word, no "The." Set in Cormorant Garamond, full amber-gold `#D4A843`. The two-tone split ("The" off-white / name in gold) is retired since Scry is one word and should read as one mark. The "y" descender is a subtle design opportunity worth exploring.

Phase 3 options: wordmark animation, proper logo mark (dark glass or scrying pool motif).

### Cursor Effect *(Phase 3)*
A radial light source follows the cursor across dark hero surfaces — as if something is being revealed underneath. Bright and tight near center, wide and diffuse as it spreads. The reference is a lighthouse or the Eye of Sauron: not aggressive, just watching. Key details from reference (tryprofound.com/careers):
- Film grain / noise texture overlaid on the entire hero — makes light feel physical rather than digital, like light through dust
- Radial gradient centered on cursor position, white/warm white fading to black
- Proximity falloff — the closer the cursor to the focal point (logo or center), the brighter the illumination
- For Scry: use deep amber rather than white for the light haze — fire revealed in darkness, consistent with scrying pool concept

### Logo Mark / Hero Animation *(Phase 3 — dreaming)*
The real design opportunity is a scrying pool or crystal bowl as the central hero element. Ideas to explore — none final:
- A dark crystalline vessel (onyx, black glass) with something alive inside — fog, embers, slow-churning light
- Continuously animated by default (subtle, slow) — intensifies on cursor proximity
- Fiery pixelated situation inside the bowl that reacts to cursor movement
- Foggy interior that clears or swirls as you approach
- The light-follows-cursor effect and the bowl animation could be one unified system — cursor proximity illuminates and agitates whatever is inside

The logo mark is undecided. The bowl/vessel concept is the strongest candidate. Needs a real designer or a very good generative approach when the time comes.

### Material Reference
Black glass and onyx rather than dark stone. The surface should feel still and faintly reflective — like something you could scry in. Subtle sheen without being glossy or playful.

### Layout Rules (unchanged)
- No rounded corners (border-radius: 0 or 2px max)
- Generous whitespace between sections
- Thin 1px borders for card separation
- Section dividers: single amber-gold hairline rule at 20% opacity
- Maximum content width: 860px, centered

---

## 7. Prompt Engineering Guidelines

- No em dashes — use periods, colons, or restructure
- No sycophancy or superlatives — write factually and critically
- No marketing language — sharp analyst voice
- No AI-speak: banned phrases include "In conclusion," "Unlocking potential," "It's worth noting," "Delve into"
- Friendly but neutral, crisp and authoritative
- Inline citations: *(Guest Name, Domain)* — italic, muted, 14px
- Never cite "Lenny's Podcast" or "Lenny's Newsletter" inline — source established in UI
- Lenny's Lens: no inline citations, natural prose, Lenny's synthesis voice only
- Topic-locked to product strategy

---

## 8. Build Strategy

### Phase 1 — Complete
Lovable prototype. UI shell, both modes, history sidebar, chat panel, download button. Mock AI responses.

### Phase 2 — Active

**Completed:**
- Supabase auth (real login/signup)
- Auth-aware session state across app
- Supabase DB persistence (teardowns and history)
- Claude API via Supabase Edge Function (generate-teardown)
- Real teardowns and critiques generating
- Real chat Q&A with teardown context
- Markdown rendering in chat
- LennyData MCP connected — SSE parsing working, pipe-delimited queries
- Exa web search integrated
- Two-step query pipeline (Haiku generates queries, Sonnet generates teardown)
- PDF extraction in Critique upload
- Input validation in Critique mode
- Vercel deployment (live at the-shard-five.vercel.app — domain TBD as Scry)
- Rate limiting (5 teardowns/day, 10 chat messages/teardown)
- Password reset flow
- Collapsible sections, loading states, usage counter

**Remaining Phase 2 / Pre-Launch:**
- Fix: usage counter 406 error (RLS/permissions on usage_limits table)
- Fix: trash icon delete not working in sidebar
- Fix: login error still showing as alert popup, needs inline message
- Usage counter — move off header, show on generate/critique page instead
- Developer bypass — skip rate limiting for owner account
- Shareable teardowns — public read-only link

### Phase 3 — Planned
- Cursor haze effect on hero surfaces
- Guest persona lenses (Growth / Design / Strategy / Investor)
- Configurable teardown depth
- Visuals in teardowns (positioning maps, growth loop diagrams)
- Audio/listening feature (ElevenLabs or OpenAI TTS)
- Wordmark animation + proper logo mark (scrying pool or dark glass motif)
- Newsletter pipeline
- Monetization layer
- Custom RAG pipeline (if MCP retrieval quality needs improvement)
- Knowledge graph (if multi-hop reasoning becomes necessary)
- Custom domain

---

## 9. Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | React + Vite |
| Auth | Supabase Auth |
| Database | Supabase Postgres |
| Vector DB | Supabase pgvector (available, not yet used) |
| LLM | Anthropic Claude API (claude-sonnet-4-5) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Corpus | LennyData MCP |
| Web search | Exa |
| File parsing | pdfjs-dist (browser-side PDF extraction) |
| Email | Resend or Loops (Phase 3) |
| Hosting | Vercel |

---

## 10. Open Questions

- Should teardowns be shareable via public read-only link?
- How to handle products not covered in Lenny's corpus? (reason by analogy, surface a warning?)
- Should the Master Rubric be visible to users?
- Newsletter: separate product or integrated?
- Monetization: freemium / subscription / one-time?
- User profiles to personalize teardowns over time?
- New domain for Scry — what's available?

---

## 11. Success Metrics

- Teardowns generated per user per week
- Chat engagement rate (% of teardowns with follow-up questions)
- Critique vs Generate mode split
- Blind Spot Injection engagement
- 7-day return rate
- Newsletter open rate (Phase 3)
