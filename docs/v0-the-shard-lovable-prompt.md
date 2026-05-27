# Scry — Lovable Prototype Prompt

Copy and paste the following prompt into Lovable to scaffold the prototype:

---

## PROMPT

Build a web app called **Scry** — an AI-powered product teardown tool for product managers and PM students.

The name is a nod to Tolkien: a shard is a fragment of something ancient and clarifying. Each teardown is a shard of truth about a product. The design should feel like that — sharp, precise, a little weighty.

---

### App Overview

Scry has two core modes:
1. **Generate Mode** — User requests a product teardown; the app generates a structured analysis
2. **Critique Mode** — User submits their own teardown; the app critiques it

Both modes produce a **read-only output** with a **chat interface docked directly below it** for follow-up Q&A.

---

### Tech Stack
- **Frontend:** React + Tailwind CSS
- **Auth + DB:** Supabase (email/password auth, store sessions and chat history, pgvector-ready for Phase 2)
- **AI:** Claude API (Anthropic) for teardown generation and critique
- **Routing:** React Router

---

### Design Direction

**Inspiration:** Lenny Rachitsky's brand palette — warm, editorial, newsletter-native — but sharpened and made colder. Think: the warmth stays but the softness is cut away. This is Lenny's aesthetic passed through a blade.

**Mood:** Crystalline. Precise. Like cold light hitting dark stone. Minimal ornamentation, hard geometric edges, no rounded corners anywhere.

**Color Palette:**
- Background: deep cool charcoal — `#111210`
- Surface / card backgrounds: one step lighter — `#1C1B17`
- Primary text: warm off-white / pale parchment — `#F0EBE0`
- Accent: sharp amber-gold — `#D4A843` — used sparingly for highlights, active states, key labels
- Secondary / muted text: cool stone gray — `#7A7670`
- Borders: barely-there — `#2E2C28`
- Error: muted terracotta, not harsh red

**Typography:**
- Headings: **Cormorant Garamond** — sharp geometric serif, editorial and authoritative
- Body / UI: **Inter** — clean, neutral, modern
- Teardown output text: **DM Mono** — monospaced, gives the output an "analytical document" feel
- No rounded or playful fonts anywhere

**Layout Rules:**
- No rounded corners (border-radius: 0 or at most 2px)
- Generous whitespace between sections
- Thin 1px borders instead of shadows for card separation
- Section dividers: single amber-gold hairline rule (`#D4A843` at 20% opacity)
- Maximum content width: 860px, centered
- Aesthetic target: high-end literary magazine crossed with a Bloomberg terminal — not a typical SaaS app

**Iconography:** Sharp geometric line icons only. Minimal icon use — let typography carry the UI.

---

### Pages & Routes

#### 1. `/` — Home / Landing
- App name **"Scry"** in large Cormorant Garamond
- Tagline: *"Product teardowns powered by the best product minds."*
- Two large mode-selection cards side by side — sharp rectangular, 1px amber-gold border on hover:
  - **"Generate a Teardown"** — "Pick a product. Get a full-stack analysis."
  - **"Critique My Teardown"** — "Submit your teardown. Get expert feedback."
- If logged in: recent teardowns listed below mode cards
- Header: wordmark only, "History" nav link, auth button

#### 2. `/generate` — Generate Mode

**Step 1: Input**
- Full-width underline-style text input (no box border, just a bottom line)
- Label: "What product do you want to tear down?"
- Placeholder: *"e.g. Plaid, Duolingo, Figma's multiplayer feature, the most popular ride-sharing app..."*
- "Generate Teardown" button — sharp rectangle, amber-gold fill, dark text

**Step 2: Loading State**
- Thin amber-gold progress bar animating across top of content area
- Rotating messages in small monospaced text: "Analyzing product strategy..." / "Reviewing growth model..." / "Synthesizing design patterns..." / "Applying frameworks..."

**Step 3: Teardown Output**
- Product name as large Cormorant Garamond heading
- Seven collapsible sections, each separated by a thin hairline rule:
  1. Product Overview
  2. Strategy & Positioning
  3. Feature Breakdown
  4. Growth Model
  5. Design Analysis
  6. Key Insights
  7. Lenny's Lens
- Section labels: small-caps, amber-gold, monospaced — clicking toggles collapse/expand
- Body text: DM Mono, warm off-white
- Auto-saves to Supabase if user is logged in

**Chat Panel — docked directly below the teardown (no page break, flows as continuation):**
- Subtle label: "Ask a follow-up" in small muted text
- Scrollable message thread
- Input: underline-style text field + "Send" button
- User messages: right-aligned, warm white, no bubble
- Assistant messages: left-aligned, DM Mono, slightly muted
- Pressing `/` focuses the chat input
- Chat is context-aware of the teardown above

#### 3. `/critique` — Critique Mode

**Step 1: Input**
- Tab toggle: **"Write"** | **"Upload"** — underline-style tabs, not pills
- Write tab: large textarea — "Write or paste your teardown here..."
- Upload tab: minimal dropzone, dashed 1px border — accepts .pdf, .docx, .txt — shows filename on upload
- Optional field: "What product is this a teardown of?"
- "Get Critique" button — same style as Generate

**Step 2: Loading State**
- Same pattern, context-appropriate messages: "Reading your teardown..." / "Identifying gaps..." / "Applying frameworks..." / "Writing your critique..."

**Step 3: Critique Output**
- Six collapsible sections, same typographic treatment:
  1. Overall Assessment
  2. Strengths
  3. Gaps & Blind Spots
  4. Framework Alignment
  5. Suggested Improvements
  6. Lenny's Lens

**Chat Panel — identical to Generate mode, docked below critique output**

#### 4. `/history` — Teardown History
- Clean row list — no cards, thin bottom border per row
- Each row: product name (bold) + mode badge (small amber label: "Generate" or "Critique") + date (right-aligned, muted)
- Search input at top
- Clicking a row reopens full teardown + chat thread
- Empty state: *"No teardowns yet."* with links to both modes

#### 5. `/login` + `/signup`
- Stark, minimal — wordmark centered at top, form below, nothing else
- Same underline input style as rest of app

---

### Supabase Schema

**teardowns**
- id (uuid, primary key)
- user_id (uuid, foreign key → auth.users)
- mode (text: 'generate' | 'critique')
- product_name (text)
- input_text (text)
- output (jsonb)
- created_at (timestamp)

**messages**
- id (uuid, primary key)
- teardown_id (uuid, foreign key → teardowns)
- role (text: 'user' | 'assistant')
- content (text)
- created_at (timestamp)

---

### AI Integration (Claude API)

**Generate Mode — system prompt:**
```
You are a world-class product analyst trained on the best product thinking in the industry. When given a product name or description, produce a comprehensive, full-stack product teardown structured into exactly 7 sections. Be specific, insightful, and opinionated. Avoid generic observations. Format your response as a JSON object with these exact keys: product_overview, strategy_and_positioning, feature_breakdown, growth_model, design_analysis, key_insights, lennys_lens. Each value should be 2-4 paragraphs of substantive analysis.
```

**Critique Mode — system prompt:**
```
You are a world-class product coach trained on the best product thinking in the industry. When given a user-written product teardown, produce a structured critique. Be direct, constructive, and specific. Format your response as a JSON object with these exact keys: overall_assessment, strengths, gaps_and_blind_spots, framework_alignment, suggested_improvements, lennys_lens. Each value should be 2-4 paragraphs of substantive feedback.
```

**Chat — system prompt:**
```
You are a product expert. The user has received a product teardown or critique (provided below). Answer their follow-up questions using the teardown as your primary reference. Be concise, specific, and insightful. Build on the teardown — do not repeat it back.

[TEARDOWN CONTEXT]: {teardown_output}
```

---

### Component Notes
- **ChatPanel** — single reusable component, used in both modes
- **SectionDisplay** — shared base component for teardown and critique output (collapsible sections, different labels)
- **Skeleton loading** — pulsing placeholder lines matching the section structure, so layout doesn't shift on load
- Smooth scroll to chat panel after output finishes loading
- Staggered fade-in on teardown sections (nice-to-have)
- Copy-to-clipboard button on output (nice-to-have)

---

### What NOT to build in Lovable
- No RAG pipeline or vector DB — Phase 2
- No newsletter feature
- No guest persona lenses
- File upload: extract raw text content and pass as string to Claude — no complex parsing needed
