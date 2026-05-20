# The Shard — Product Requirements Document

**Version:** 0.3
**Last Updated:** May 2026
**Status:** Prototype complete / Phase 2 in progress

---

## 1. Overview

**The Shard** is an AI-powered product teardown tool designed for working product managers and aspiring PMs looking to sharpen their product sense. It transforms Lenny Rachitsky's podcast transcripts and newsletter content into an intelligent engine that produces deep, structured product teardowns and critiques — on demand.

The name is a nod to Tolkien: a shard is a fragment of something ancient and clarifying. Each teardown is a shard of truth about a product. Lenny's content is the fire. The Shard is what comes from it.

### Core Value Proposition
Most product analysis tools give you surface-level summaries. The Shard gives you the frameworks, vocabulary, and depth of the world's best product thinkers — distilled into a structured teardown of any product you care about. It is evidence-led: every insight traces back to the archive.

### Target Users
- **Working PMs** seeking competitive intelligence and structured frameworks for analyzing products
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

### Feature 1: Generate a Teardown (Static Mode)

**User Input Options:**
- Specific product: "Tear down Plaid"
- Vague category: "A popular payments product" → system surfaces top candidates, user selects
- Feature-level: "Tear down Uber's surge pricing feature"

**Saliency Detection (Two-Step Rubric):**
The system detects the scope of the submission and adjusts depth accordingly:
- Feature submission → narrows focus to UX/Value Proposition analysis
- Company submission → expands to full Strategy/Growth analysis
- This is encoded in the prompt architecture, not hardcoded — the AI reasons about scope before generating

**Teardown Output Structure (Full-Stack):**
1. Product Overview — what it is, who it's for, core job to be done
2. Strategy & Positioning — market context, differentiation, moat
3. Feature Breakdown — core features, UX flows, design decisions
4. Growth Model — acquisition, activation, retention, monetization
5. Design Analysis — UI/UX patterns, information architecture, notable design decisions
6. Key Insights — synthesis of what makes this product work (or not)
7. Lenny's Lens — Lenny's own perspective and synthesis, drawn from his voice in the transcripts (not guest summaries)

**Data Sources:**
- Lenny's podcast transcripts (primary intelligence layer)
- Lenny's newsletter archives
- Live web/news data for recent product context

**Output Rules:**
- Read-only — user cannot edit
- Chat panel docked below for follow-up Q&A
- Auto-saved to history

---

### Feature 2: Critique My Teardown (Dynamic Mode)

**User Input Options:**
- Free-text entry
- File upload (.pdf, .docx, .txt)

**Critique Output Structure:**
1. Overall Assessment
2. Strengths
3. Gaps & Blind Spots
4. Framework Alignment
5. Suggested Improvements
6. Lenny's Lens

**Blind Spot Injection:**
After the primary critique, the system surfaces 1-2 "Reflective Insights" — dimensions the user hadn't considered, drawn from the Master Rubric. These appear as a distinct subsection at the end of Suggested Improvements, labeled clearly so the user understands these are proactive additions, not responses to what they wrote.

**Output Rules:**
- Read-only
- Same chat Q&A interface as Feature 1
- Designed as a learning loop

---

### Feature 3: Chat Interface (Both Modes)

The chat panel is a strategic partner, not just a Q&A bot.

**Capabilities:**
- Answer follow-up questions grounded in the teardown/critique above
- Handle pushback: if the user disagrees with an assessment, engage with their reasoning
- Handle clarifying questions: "Why did you flag the growth model as weak?"
- Handle what-if scenarios: "What if they changed pricing to freemium?" — the AI reasons through the implication using the corpus
- Topic-locked to product strategy — will not answer off-topic questions
- Resource caps (token/turn limits) to manage scaling and prevent abuse

---

### Feature 4: Teardown History

- Collapsible left sidebar persisting across all pages (like Claude.ai / ChatGPT)
- Each entry: product name + mode badge ("Generate" or "Critique") + date
- Filter tabs at top: All / Generated / Critiques
- Search input filters within active tab
- Clicking entry reopens full teardown + chat thread

---

### Feature 5: Weekly Newsletter *(Phase 3)*

- Automated weekly digest of one AI-generated teardown based on trending product/tech news
- Same engine as Feature 1
- Email delivery + in-app archive

---

## 4. Intelligence Layer — Lenny's Corpus

### Data Available
- Full podcast transcripts (Lenny's Podcast) — owner has access
- Newsletter archives — owner has access

### Master Rubric
The intelligence layer is anchored by a Master Rubric — a codified set of evaluation pillars derived from the corpus:
- Business Model & Strategy
- GTM / Growth Loops
- Pricing & Packaging
- UX Friction & Value Delivery

This rubric acts as a dynamic filter, not a static checklist. It shapes what the AI looks for and how it weights insights depending on the scope of the submission (see Saliency Detection above).

### Conflicting Advice Handling
If the corpus contains tension between experts on a topic, the AI must surface it rather than flatten it. Format: "The archive contains differing perspectives here — [Expert A] emphasizes X while [Expert B] argues Y. The tension is worth noting for your context." This preserves intellectual honesty and reinforces the evidence-led value proposition.

### Recommended Architecture

**Phase 2 — RAG with metadata tagging:**
Standard RAG pipeline — chunk, embed, store in Supabase pgvector, retrieve at query time. Fast to build, gets to 80% quality immediately.

Metadata tags per chunk:
- `speaker`: "Lenny" or guest name
- `speaker_type`: "host" or "guest"
- `content_type`: "synthesis" (Lenny offering his own take) vs "summary_of_guest" (Lenny paraphrasing a guest)
- `expertise_domain`: growth, design, strategy, GTM, investing, consumer, B2B
- `episode_date`: for recency weighting

**Phase 3 — Knowledge Graph layer:**
A graph structure (G = (V, E)) layered on top of RAG to enable multi-hop reasoning:
- Nodes: Experts, Frameworks (e.g. "The Hook Model"), Companies, Historical Case Studies
- Edges: Thematic relationships (e.g. "Expert A founded Company B using Framework C")

This enables reasoning like: "While the archive is quiet on [Your Product], it has analyzed [Similar Company] which used a similar business model, where experts noted [Specific Risk]."

Decision: RAG first in Phase 2, graph in Phase 3. The metadata tagging in Phase 2 is designed to be compatible with the graph architecture — not throwaway work.

**Critical attribution rule:**
If a guest said something and Lenny summarizes it, the insight belongs to the guest. If Lenny is offering his own framing, synthesis, or opinion unprompted, that is Lenny's voice. The Lenny's Lens section pulls exclusively from chunks where `speaker = "Lenny"` AND `content_type = "synthesis"`.

**Chunking strategy:** Chunk by topic segment, not fixed token size. Lenny's interviews have natural topic transitions — respect them. Fixed-size chunking loses context and degrades retrieval quality.

### Persona Lenses (Phase 3)
- Growth lens (acquisition, retention, monetization)
- Design lens (UX, IA, visual design)
- Strategy lens (market positioning, moat, competitive dynamics)
- Investor lens (business model, unit economics, scalability)

---

## 5. Design System

### Color Palette
- Background: `#111210`
- Surface: `#1C1B17`
- Primary text (body): `#F0EBE0` warm parchment
- Accent (UI): `#D4A843` amber-gold — section labels, CTAs, active states, wordmark "Shard"
- Muted / secondary text: `#7A7670` stone gray
- Borders: `#2E2C28`

### Typography
- Headings: Cormorant Garamond
- Section labels: DM Mono, 11px, letter-spacing 0.15em, all-caps, color `#D4A843`
- Body text: Lora, 16px, line-height 1.75, color `#F0EBE0`
- Muted text (dates, citations, placeholders): `#7A7670`, 14px
- Expert citations: italic, `#7A7670`, 14px, inline format: *(Name, Domain)*

### Layout
- No rounded corners (border-radius 0 or max 2px)
- Max content width: 860px centered
- Section spacing: 40px between sections, 8px between label and body
- Thin 1px borders, no shadows

### Wordmark Treatment
Current implementation: "The" in `#F0EBE0` off-white, "Shard" in `#D4A843` amber-gold. Single unified accent color across wordmark and UI.

Options under consideration for Phase 3:
- **Animation:** Wordmark cycles slowly between off-white, gold, and near-translucent. Hero only, must respect `prefers-reduced-motion`.
- **Logo mark:** Proper shard-of-glass SVG icon to be designed in Figma or commissioned. Conceptual link to Lenny's firepit logo — the fire is the source, the shard is what comes from it.

### Phase 3 Design Touchpoints (Deferred)
Ideas to explore when polishing the UI — not for current build:
- "Strategic Shards" as an alternative label for teardown sections (test vs current labels)
- Micro-animations (spark effects) on submit actions
- The Phial: a minimalist vessel icon for the chat interface that animates during processing
- Glassmorphism effects — use sparingly and only if they don't date the UI

---

## 6. Prompt Engineering Guidelines

These rules apply to all Claude API calls:

**Tone and style:**
- No em dashes. Use periods, colons, or restructure the sentence.
- No sycophancy or superlatives. Write factually and critically.
- No marketing language. The teardown should read like a sharp analyst wrote it.
- No AI-speak: banned phrases include "In conclusion," "Unlocking potential," "It's worth noting," "Delve into," and similar filler.
- Friendly but neutral. Crisp, direct, and authoritative.

**Citations:**
- Every core insight must cite the archive via expert attribution.
- Inline format: *(Guest Name, Expertise Domain)* — italic, muted. Never cite "Lenny's Podcast" or "Lenny's Newsletter" inline — source context is established in the UI.
- If the archive is quiet on a specific product, reason by analogy to similar companies or frameworks that are covered.

**Lenny's Lens:**
- No inline citations. Experts may be named naturally in prose.
- Pulls exclusively from chunks where `speaker = "Lenny"` and `content_type = "synthesis"`.

**Conflicting perspectives:**
- Surface tensions in the archive rather than flattening them.
- Label clearly as differing perspectives, not contradictions.

**Scope:**
- Topic-locked to product strategy. Decline off-topic questions gracefully.

---

## 7. Build Strategy

### Phase 1 — Lovable (Complete)
UI prototype with mocked AI responses. Core flows: Generate, Critique, History sidebar, Chat panel, Download button. All end-to-end flows tested and working. History persists via localStorage.

### Phase 2 — Cursor + Backend (Current)
**Goal:** Wire the real intelligence layer.

**Sequence:**
1. Get project running locally in Cursor *(in progress)*
2. Set up Supabase project — auth + Postgres DB
3. Build RAG pipeline: chunk Lenny transcripts and newsletters by topic segment, generate embeddings, store in Supabase pgvector
4. Tag all chunks with metadata (speaker, content_type, expertise_domain, episode_date)
5. Build prompt architecture: teardown generation with retrieval, critique mode, Lenny's Lens filter
6. Integrate web search (Tavily or Exa) for live product context
7. Build file upload parsing for Critique mode (.pdf, .docx, .txt)
8. Apply all prompt engineering guidelines
9. Replace localStorage history with Supabase DB persistence

**Working style:** Product owner has Python and SQL experience, Figma familiarity, no full-stack background. All code written collaboratively in Cursor with Claude. Nothing assumed — each step explained and built incrementally.

### Phase 3 — Scale & Polish
- Knowledge Graph layer on top of RAG
- Guest persona lenses
- Configurable teardown depth
- Wordmark animation + logo mark design
- Newsletter pipeline (cron job + Resend/Loops)
- Monetization layer (freemium or subscription)
- Analytics and usage tracking
- UI polish (micro-animations, design touchpoints above)

---

## 8. Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | React / Next.js |
| Auth | Supabase Auth |
| Database | Supabase (Postgres) |
| Vector DB | Supabase pgvector |
| LLM | Anthropic Claude API |
| File parsing | LangChain document loaders or custom |
| Web search | Tavily or Exa |
| Email | Resend or Loops |
| Hosting | Vercel |

---

## 9. Open Questions

- Should teardowns be shareable via public read-only link?
- Rating/feedback mechanism on teardown quality?
- How to handle products not well-covered in Lenny's corpus?
- Monetization: freemium (X teardowns/month), subscription, or one-time?
- User profiles to personalize teardowns over time?
- Newsletter as separate product or integrated?
- Should the Master Rubric be visible to users in any form?

---

## 10. Success Metrics (Early Stage)

- Teardowns generated per user per week
- Chat engagement rate (% of teardowns with follow-up questions)
- Critique mode adoption vs. Generate mode
- Blind Spot Injection engagement (% of users who follow up on injected insights)
- 7-day return rate
- Newsletter open rate (Phase 3)
