# Scry — UI Style Guide
*For implementation via Claude Code. All decisions are final unless noted as "hold".*

---

## Accessibility Rule

No readable content below `#7A7670` on dark backgrounds. Citations, card descriptions, secondary text — minimum `#A09A92`. Only timestamps, metadata, and non-essential decorative labels may use `#7A7670`. Everything a user needs to read or act on must be at least `#A09A92`. All equivalent elements (e.g. card descriptions) use the same color — never mix values.

---

## Colors

| Role | Token | Hex |
|------|-------|-----|
| Page background | `--bg` | `#070705` |
| Surface / cards | `--surface` | `#1C1B17` |
| Border | `--border` | `#2E2C28` |
| Primary text | `--text-primary` | `#F0EBE0` |
| Secondary text | `--text-secondary` | `#A09A92` |
| Muted text | `--text-muted` | `#7A7670` |
| Accent gold | `--gold` | `#D4A843` |
| Ember orange | `--ember` | `#C4581A` |

---

## Typography

**Two fonts only.**

| Role | Font | Size | Weight | Color |
|------|------|------|--------|-------|
| Wordmark | Cormorant Garamond | 18px (nav) / 52px (hero H1) | 600 | `#D4A843` |
| Product name H1 | Cormorant Garamond | 22px | 600 | `#F0EBE0` |
| Page title H1 | Cormorant Garamond | 20px | 600 | `#F0EBE0` |
| Section labels | Inter | 11px | 400 | `#D4A843` |
| Section labels style | all-caps, letter-spacing 0.15em | | | |
| Body / teardown content | Inter | 15px | 400 | `#F0EBE0` |
| Body line-height | 1.75 | | | |
| Citations | Inter | 14px | 400 italic | `#A09A92` |
| UI / buttons / nav | Inter | 13–14px | 400–500 | varies |
| Muted UI (email, timestamps) | Inter | 13px | 400 | `#7A7670` |
| Chat messages (both sides) | Inter | 15px | 400 | `#F0EBE0` |

**Removed fonts:** DM Mono (retired), Lora (retired).

---

## Layout Rules

- No rounded corners — `border-radius: 0` or `2px` max
- No box shadows
- Thin `1px` borders using `#2E2C28`
- Section dividers: single amber-gold hairline at 20% opacity
- Maximum content width: `860px`, centered
- Generous whitespace between sections

---

## Hero / Landing Page

**Background:** `#070705`

**Fire shadow (CSS):**
```css
/* Outer flame */
position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
width: 500px; height: 320px;
background: radial-gradient(ellipse at 50% 100%,
  rgba(212,168,67,0.18) 0%,
  rgba(196,88,26,0.09) 32%,
  rgba(196,88,26,0.03) 55%,
  transparent 70%);
clip-path: polygon(50% 0%, 96% 100%, 4% 100%);

/* Inner flame */
position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
width: 240px; height: 240px;
background: radial-gradient(ellipse at 50% 100%,
  rgba(212,168,67,0.14) 0%,
  rgba(196,88,26,0.05) 48%,
  transparent 68%);
clip-path: polygon(50% 0%, 88% 100%, 12% 100%);
```

**Coal line — implement thin (1px):**
```css
position: absolute; bottom: 0; left: 0; right: 0;
height: 1px;
background: linear-gradient(90deg,
  transparent 0%,
  rgba(196,88,26,0.4) 20%,
  rgba(212,168,67,0.9) 40%,
  rgba(255,210,100,1) 50%,
  rgba(212,168,67,0.9) 60%,
  rgba(196,88,26,0.4) 80%,
  transparent 100%);
```

**Coal line — thick (3px) — documented, hold for now:**
Same gradient as above, `height: 3px`.

**Hero copy (do not change):**
- Wordmark: `Scry` in Cormorant Garamond 600, `#D4A843`
- Tagline: `Product teardowns powered by the best product minds.` in Inter 14px, `#A09A92`
- No second line below tagline

**Mode cards:**
- Two side-by-side cards below the tagline
- Both transparent background — fire shadow visible through cards
- No arrow — entire card is clickable
- No border-radius
- Card 1 — Generate: border `1px solid rgba(212,168,67,0.45)`, heading `#D4A843` Cormorant Garamond 600 18px, description Inter 13px `#A09A92`
- Card 2 — Critique: border `1px solid rgba(240,235,224,0.15)`, heading `#F0EBE0` Cormorant Garamond 600 18px, description Inter 13px `#A09A92`
- Description copy: Card 1 "Pick a product. Get a full-stack analysis." / Card 2 "Submit your analysis. Get expert feedback."
- Both description lines use identical color `#A09A92` — no exceptions
- Hover: border brightens (Card 1 → `#D4A843`, Card 2 → `rgba(240,235,224,0.35)`), background lifts to `rgba(212,168,67,0.04)` / `rgba(240,235,224,0.03)`
- Active/click: `transform: scale(0.98)`
- Transition: `border-color 0.15s, background 0.15s, transform 0.1s`

**Coal line placement:**
- Sits at the very bottom edge of the hero section, below mode cards, above footer
- Wrapper div: `position: relative; z-index: 4` so it renders above fire shadow
- May need tuning at full screen width — thickness (1px vs 3px) TBD

**Landing page:**
- Hero is the entire page — wordmark, tagline, two mode cards, coal line
- No other content sections between hero and footer
- Page height is fixed regardless of history length

---

## Header

- Wordmark `Scry` — Cormorant Garamond 600, 18px, `#D4A843`
- Nav links — Inter 13px, `#7A7670`
- User email — Inter 14px, `#7A7670`
- Sign out — Inter 14px, `#7A7670`
- No background color on header — transparent over page bg

---

## History Sidebar

- "HISTORY" label — Inter, 11px, all-caps, letter-spacing 0.15em, `#D4A843`
- Tab labels (All / Generated / Critiques) — Inter 14px, `#F0EBE0` active, `#7A7670` inactive
- Active tab underline — 1px `#D4A843`
- Entry names — Inter 14px, `#F0EBE0`
- Mode badges (GENERATE / CRITIQUE) — Inter, 9px, all-caps, letter-spacing 0.12em, border `1px`
  - Generate: `#D4A843` text, `rgba(212,168,67,0.4)` border
  - Critique: `#7A7670` text, `#2E2C28` border
- Timestamps — Inter 11px, `#7A7670`
- Sidebar is independently scrollable: `overflow-y: auto`, fixed height, does not affect page height

---

## Generate & Critique Input Pages

- Label row: Inter 11px all-caps letter-spacing 0.15em, `#D4A843` — left aligned
- Usage counter: Inter 11px, `#7A7670` — right aligned, same row as label
- Format: `X of 5 teardowns today`
- Placeholder text: Inter 15px, `#7A7670`
- Button: Inter 14px 500, gold fill `#D4A843`, text `#070705`

---

## Teardown Output

- Product name H1 — Cormorant Garamond 600, 22px, `#F0EBE0`
- "Visit product →" — Inter 13px, `#D4A843`
- Section labels — Inter 11px, all-caps, letter-spacing 0.15em, `#D4A843`
- Section left border — `1px solid rgba(212,168,67,0.2)`
- Body text — Inter 15px, 1.75 line-height, `#F0EBE0`
- Citations — Inter 14px italic, `#A09A92`
- Citation format: `(Name, Domain)`

---

## Chat Panel

**Layout (Claude-style):**
- User message: right-aligned bubble, background `#2E2C28`, border `1px solid #3E3C38`, Inter 14px, `#F0EBE0`, max-width 75%
- "You" label: Inter 12px, `#7A7670`, above bubble
- Scry response: left-aligned, no bubble
- "Scry" label: Inter 10px, all-caps, letter-spacing 0.12em, `#D4A843`, above response
- Response text: Inter 15px, 1.75 line-height, `#F0EBE0`
- Citations in chat: Inter 13px italic, `#A09A92`
- Same font both sides — no switching
- Input placeholder: Inter, `#7A7670`
- Send button: Inter 13px 500, `#D4A843`

---

## Footer

- Wordmark `Scry` — Cormorant Garamond 600, 16px, `#D4A843`
- Caption "Powered by Lenny Rachitsky's archive" — Inter 13px, `#7A7670`

---

## Buttons

- Primary: background `#D4A843`, text `#070705`, Inter 14px 500, no border-radius
- Secondary: background transparent, border `1px solid rgba(212,168,67,0.2)`, text `#A09A92`, Inter 14px
- Interactive/readable elements: minimum `#A09A92`, never `#7A7670` for anything that needs to be acted on

---

## Phase 3 — Documented, Not Implemented

- **Cursor haze effect:** Radial amber light follows cursor across hero, references Profound (tryprofound.com/careers). Film grain texture overlay. Proximity brightness falloff toward logo/center.
- **Thick coal line (3px):** Hold until tested on large screen.
- **Logo mark / scrying pool animation:** Dark crystalline vessel with living interior (fog, embers). Continuously animated, intensifies on cursor proximity. Undecided — needs real designer.
- **Wordmark animation:** Slow cycle, Phase 3 only.
