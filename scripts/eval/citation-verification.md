# Citation Verification — Design Doc

Design only. No code, no archive integration. This describes how a future
`citation-verification` pass in the eval pipeline would extract every
citation/quote/attribution from a `raw_output` (one row of `eval_runs`),
classify each against Lenny's archive, and specifically catch guest-to-host
misattribution — without building the actual archive query.

## 0. Where this fits

`scripts/eval/run-eval.mjs` produces one `eval_runs` row per (product, arm),
`arm` in `scry | claude_vanilla | claude_web`. All three arms answer the same
prompt; only Scry's `raw_output` is meant to carry real grounding. The
baselines exist as a control — they may fabricate citations, omit them
entirely, or cite nothing in a way that can even be checked. This pipeline
treats that as expected input, not an error case to special-case away.

Five stages, each consuming the previous one's output:

1. **Extraction** — pull every citation-shaped span out of `raw_output`.
2. **Classification** — decide what kind of citation it is against the archive.
3. **Host-attribution check** — a stricter, separately-callable pass over the
   subset of citations claiming to be Lenny's own words.
4. **Outlet legitimacy check** — for web citations, flag outlet names that
   aren't independently recognizable, separate from whether the underlying
   claim itself checks out.
5. **Vendor-source-citation metric** — for web citations, flag when the
   "independent" source is actually the product's own blog/help center/press
   page, not third-party grounding.

Stages 2-5 all depend on an archive/web lookup that this doc deliberately
does not build (Section 6). Stages 3-5 are each filters over Stage 2's
output — they only ever add fields, never change Stage 2's classification.

## 1. Extraction

Input: one `eval_runs` row (`arm`, `raw_output`, `product`, `prompt`). The two
arms have structurally different `raw_output`, so extraction branches on `arm`.

### 1a. Scry (`arm: "scry"`)

`raw_output` is the flat JSON object `generate-teardown` returns — one string
per section, keyed by mode. Generate mode: `product_url,
product_overview, strategy_and_positioning, feature_breakdown, growth_model,
design_analysis, key_insights, lennys_lens`. Critique mode:
`overall_assessment, strengths, gaps_and_blind_spots, framework_alignment,
suggested_improvements, lennys_lens`.

Scry's system prompt enforces an exact citation grammar per section string:

- Archive: `(Full Name, Role · Lenny's Archive)` — one or more attributions
  can share a single parenthetical, semicolon-separated:
  `(Name A, Role A · Lenny's Archive; Name B, Role B · Lenny's Archive)`.
- Web: `(Outlet, Month Year)`.
- Training knowledge: unattributed, no parenthetical at all.

`lennys_lens` is generated under a rule that forbids naming anyone and
forbids inline citations entirely — it should never yield an extracted
citation. If it does, that itself is a defect worth flagging (citation-format
violation), separate from the classification work below.

Extraction regex per non-`lennys_lens` section string:

- Archive block: `\(([^)]+·\s*Lenny's Archive[^)]*)\)`, then split the
  captured group on `;` to get one attribution per clause. Within a clause,
  the text before the first `,` is `claimed_speaker`; between `,` and `·` is
  `claimed_role`.
- Web block: `\(([A-Z][^,)]*),\s*(January|…|December)\s+\d{4}\)` →
  `claimed_speaker: null`, `claimed_source_type: "web"`,
  `claimed_episode_or_outlet` = the outlet text.
- Everything else in the string (unattributed prose) is not extracted — there
  is no grounding claim to verify.

For each match, `claim_text` is the sentence or clause immediately preceding
the parenthetical (the thing being attributed), and `claim_type` is
`verbatim_quote` if that span is wrapped in quotation marks, else
`paraphrase` — Scry's prompt discourages verbatim quoting, so expect mostly
paraphrase in practice.

### 1b. Baselines (`arm: "claude_vanilla" | "claude_web"`)

`raw_output` is the raw Anthropic Messages API response:
`{ id, type, role, content: [...], model, stop_reason, usage, ... }`.
Concatenate the `text` of every `content[]` block of type `text` into one
string per row (for `claude_web`, `content` may also include `server_tool_use`
/ `web_search_tool_result` blocks — note their presence as "did use live
search" metadata, but they are not citations and are not extracted here).

Baselines don't follow Scry's grammar, so extraction here is a generic
detector rather than a strict-format parser. Scan the concatenated text for:

- Quoted spans (`"…"` or smart quotes) with a nearby attribution phrase
  ("according to X", "X said", "as X put it").
- Any parenthetical that looks citation-shaped even if it doesn't match
  Scry's exact grammar — `(Name, ...)`, `(Outlet, Year)`, `[N]` footnote
  markers, bare URLs presented as sourcing.
- Explicit named claims: "X argues/notes/found that …".

Each match becomes a candidate with the same record shape as 1a but with
`claim_type` inferred loosely and `claimed_source_type` set to `"unknown"`
whenever the text doesn't clearly say archive vs. web (baselines have no
concept of "Lenny's Archive" at all, so most of their citations, if any, will
resolve to `unknown` or `web`).

A baseline row that yields **zero** extracted citations is a valid, expected
result — record it as `citation_count: 0` rather than silently dropping the
row, since "made claims with nothing to check" is itself a signal to report
on, distinct from "every claim it made checked out."

### Extracted citation record (output of Section 1)

```
{
  id,
  eval_run_id,
  arm,                        // "scry" | "claude_vanilla" | "claude_web"
  section_key,                // e.g. "strategy_and_positioning", or "unsectioned" for baselines
  claim_text,                 // exact span being attributed
  claim_type,                 // "verbatim_quote" | "paraphrase"
  claimed_source_type,        // "archive" | "web" | "unknown"
  claimed_speaker,            // string | null
  claimed_role,                // string | null
  claimed_episode_or_outlet,  // string | null
  raw_citation_text           // the literal matched parenthetical, for audit
}
```

## 2. Verification classification

For each extracted citation, call the archive lookup (Section 6) with
`{ claim_text, claimed_speaker }` and classify using its result(s):

1. **No candidate match at all** (lookup returns empty) → `fabricated`.
   Nothing in the archive resembles the claim's substance.
2. **Candidate found, textual match near-exact** (verbatim-quote claim,
   compared to the matched snippet case/whitespace/punctuation-normalized)
   **and** `claimed_speaker` (if given) equals the match's `real_speaker` →
   `verified-verbatim`.
3. **Candidate found, not a near-exact match but substantively supported**
   (semantic-similarity / entailment comparison between `claim_text` and
   `matched_snippet`, above a confidence threshold) **and**
   `claimed_speaker` matches `real_speaker` (or none was claimed) →
   `verified-paraphrase`.
4. **Candidate found, content matches, but `claimed_speaker` does not match
   `real_speaker`** (or `claimed_episode_or_outlet` doesn't match
   `episode_or_source_ref`) → `misattributed`. The underlying claim is real
   and findable; the byline is wrong.

Decision order matters: check *content existence* first, independent of who
it's attached to, then check *attribution correctness* second. That ordering
is exactly what separates `misattributed` (content real, wrong source) from
`fabricated` (content doesn't exist at all), and it's what Section 3 reuses.

Web citations (`claimed_source_type: "web"`) run through the same two-stage
logic against a web source instead of a transcript; the archive/web
distinction only changes which lookup backend is queried, not the
classification rules — out of scope to spec further here since the task is
the Lenny archive, but the interface in Section 6 is written source-agnostic
so it isn't blocked on that.

Edge cases:
- A quoted fragment that matches exactly even though surrounding paraphrase
  doesn't → still `verified-verbatim` for that citation; classification
  operates on `claim_text` as extracted, not the whole sentence around it.
- Multiple candidate matches for one claim (same idea appears in two
  episodes) → take the highest `match_confidence` candidate for the primary
  classification, but set an `ambiguous: true` flag on the record so it can
  be reviewed rather than silently resolved.

## 3. Host-attribution check

Section 2 already produces `misattributed` for any wrong-speaker citation.
This check exists because one specific flavor of misattribution — a guest's
opinion attributed to Lenny — has been a recurring, previously-fixed failure
mode for this product (`docs/BACKLOG.md`: "Citation compliance overhaul" and
"Lenny's Lens speaker isolation"). It deserves its own named check and its
own severity tier in reporting, not silent absorption into the generic
`misattributed` bucket: turning "one guest's opinion" into "the host's own
voice" misrepresents the product's editorial stance in a way an ordinary
wrong-episode misattribution does not.

This check is a filter over Section 2's output, callable standalone against
a batch of citations without rerunning full classification.

**Trigger**: run only on extracted citations where `claimed_speaker`
resolves to a host-name variant ("Lenny Rachitsky", "Lenny"; Scry's citation
grammar literally supports `(Lenny Rachitsky, Host · Lenny's Archive)`, so
`claimed_role == "Host"` is also a trigger signal).

**Logic**:

1. Take the archive lookup's top match from Section 2 Step 1 for this
   citation — specifically its matched *utterance*, not just "this episode is
   about the right topic." The lookup output must carry per-utterance
   speaker metadata for this to work at all (Section 6 output shape assumes
   the archive is turn-tagged: `speaker_role: "host" | "guest"` per matched
   snippet).
2. If `matched_result.speaker_role == "guest"` → this is not a generic
   misattribution, it's the specific documented failure mode. Set
   `classification: "misattributed"` (Section 2's verdict stands) plus
   `misattribution_subtype: "guest_to_host"`, and mark it high severity for
   review — this is the finding the eval pipeline most needs to surface.
3. If `matched_result.speaker_role == "host"` → the attribution is correct;
   Section 2's classification (`verified-verbatim` / `verified-paraphrase`)
   stands unchanged, no subtype set.
4. If Section 2 already returned `fabricated` (no matched turn exists at
   all), this check is a no-op — there's no real speaker to compare against.

**Output**: this check only ever *adds* `misattribution_subtype:
"guest_to_host"` on top of an existing Section 2 classification; it never
produces a classification value on its own. That keeps the four
classifications in Section 2 exhaustive and mutually exclusive, while still
letting reporting compute a dedicated "guest→host misattribution rate" as a
distinct metric from the overall misattribution rate.

## 4. Outlet legitimacy check (web citations)

Section 2's classification only asks whether a web citation's underlying
*claim* checks out against a live source — it never asks whether
`claimed_episode_or_outlet` is a name worth trusting in the first place. The
qualitative read of the Aug 29 batch surfaced web citations attributing
claims to outlet names that are plausible-sounding but not independently
recognizable (small or invented-reading trade blogs), which Section 2 alone
wouldn't catch: the underlying claim can still resolve to
`verified-paraphrase` against a live web source even when the outlet name
itself is one nobody would recognize or vouch for.

This is a filter over Section 2's output, same shape as Section 3 above: it
adds a field, it never changes the classification.

**Trigger**: run on every extracted citation where `claimed_source_type ==
"web"`.

**Logic**: maintain (or query) a lightweight outlet-reputation signal —
recognized major/trade outlets, the product's own domain family (Section 5
below handles that case specifically), and a residual "unfamiliar" bucket.
For each web citation:

1. If `claimed_episode_or_outlet` resolves to a known/recognized outlet →
   `outlet_legitimacy: "recognized"`.
2. Otherwise → `outlet_legitimacy: "unfamiliar"`. This is a flag for manual
   review, not an automatic downgrade to `fabricated` — a small or obscure
   trade newsletter is not fabricated, just unverifiable by familiarity
   alone, and the underlying claim may still be accurate and independently
   sourced.

**Output**: adds `outlet_legitimacy: "recognized" | "unfamiliar"` on top of
an existing Section 2 classification. Reporting can then compute an
"unfamiliar-outlet rate" per arm as its own metric, distinct from the
fabricated/misattributed rates.

## 5. Vendor-source-citation metric

Separate concern from legitimacy above: even a fully recognized, legitimate
outlet can be the *product's own* blog, help center, or press page — which
is not independent grounding, it's the vendor describing itself. Seen
repeatedly in the Aug 29 batch (Figma's own Help Center, Resolve AI's own
blog, cited as if third-party sourcing).

**Trigger**: run on every extracted citation where `claimed_source_type ==
"web"`, using the `product` field already carried on the `eval_runs` row.

**Logic**: compare `claimed_episode_or_outlet` — and, where available, the
underlying source URL/domain from the web search results rather than just
the outlet-name string — against the product's own domain family (its own
site, blog subdomain, help/support center, press page). If it matches:

1. Set `vendor_sourced: true` on the citation record (default `false`
   otherwise).
2. This is a metric, not a verdict on truthfulness — a vendor-sourced
   citation can still be `verified-verbatim` (the product really did say
   that on its own blog), but it should never count toward "independent
   grounding" in aggregate reporting.

**Aggregation implication**: report `vendor_sourced_citation_rate` per arm
alongside the Section 2 classification counts — citations pointing at the
product's own properties versus genuinely third-party sources. This is
exactly the signal the qualitative read was checking for by hand (e.g.
"Figma had 3/16 pointing at its own Help Center") and it deserves to be a
tracked metric per run, not an anecdotal spot-check repeated manually every
time.

## 6. Interface boundary — real archive lookup plugs in here

Everything above is written against this input/output contract. Building the
actual query against Lenny's archive (via LennyData MCP, referenced
elsewhere in this repo — see `searchLennyData` in
`supabase/functions/generate-teardown/index.ts` for the existing query
pattern) is explicitly **not** part of this design. A future implementer
should be able to write that lookup in isolation, satisfy the shapes below,
and drop it in without touching Sections 1–3.

**Input** (illustrative signature, not real code):

```
archiveLookup(query: {
  claim_text: string,           // required — the claim/quote to check
  claimed_speaker?: string,     // optional — who the output said it was
  claimed_episode?: string,     // optional — episode/outlet the output claimed
}) => LookupResult[]
```

**Output** — a ranked list (possibly empty) of:

```
LookupResult {
  matched_snippet: string,       // exact transcript/newsletter text found
  real_speaker: string,          // who actually said/wrote it
  speaker_role: "host" | "guest",// per-utterance — required for Section 3
  episode_or_source_ref: string, // episode title/date or newsletter issue id
  source_ref: string,            // stable pointer back into the archive
  match_confidence: number,      // 0–1, how well matched_snippet supports claim_text
  match_type: "exact" | "semantic" // optional hint for Section 2's branch choice
}
```

An empty array is a valid, meaningful response — it's what drives the
`fabricated` classification in Section 2.

**What plugs in here later**: LennyData MCP corpus retrieval, snippet
ranking, verbatim vs. semantic matching, and the speaker-tagging pipeline
that produces `speaker_role` per utterance. None of that is designed or
built in this document — only the shape it must expose to be consumable.

## Example walkthrough

Scry `raw_output.strategy_and_positioning` (generate mode) contains:

> "…founders should default to weekly shipping cadence early on (Lenny
> Rachitsky, Host · Lenny's Archive)."

**Extraction** (Section 1a):

| field | value |
|---|---|
| section_key | `strategy_and_positioning` |
| claim_text | "founders should default to weekly shipping cadence early on" |
| claim_type | `paraphrase` |
| claimed_source_type | `archive` |
| claimed_speaker | `Lenny Rachitsky` |
| claimed_role | `Host` |
| raw_citation_text | `(Lenny Rachitsky, Host · Lenny's Archive)` |

**Archive lookup** (Section 6) called with `{claim_text, claimed_speaker:
"Lenny Rachitsky"}` returns:

```
{
  matched_snippet: "I always tell early-stage founders — ship weekly,
    no exceptions, until you have product-market fit.",
  real_speaker: "Casey Winters",
  speaker_role: "guest",
  episode_or_source_ref: "Episode 214 — Casey Winters on Growth",
  match_confidence: 0.88,
  match_type: "semantic"
}
```

**Classification** (Section 2): content exists (not `fabricated`) →
`claimed_speaker` ("Lenny Rachitsky") ≠ `real_speaker` ("Casey Winters") →
`misattributed`. (Had the speaker matched, the semantic-not-exact match
would have made this `verified-paraphrase`.)

**Host-attribution check** (Section 3): `claimed_speaker` resolves to a host
variant → check triggers → `matched_result.speaker_role == "guest"` →
add `misattribution_subtype: "guest_to_host"`, severity high.

**Final record**:

```
{
  arm: "scry",
  section_key: "strategy_and_positioning",
  claim_text: "founders should default to weekly shipping cadence early on",
  claimed_speaker: "Lenny Rachitsky",
  classification: "misattributed",
  misattribution_subtype: "guest_to_host",
  matched_source_ref: "Episode 214 — Casey Winters on Growth",
  confidence: 0.88
}
```

## Aggregation note

Per `eval_runs` row, roll extracted-citation records up into counts by
`classification`, with `guest_to_host` surfaced as its own blocking-finding
count rather than folded into `misattributed`. Expect the two baseline arms
to skew heavily toward `fabricated` (or zero-citation rows per Section 1b),
since they have no real grounding mechanism — that contrast against Scry's
distribution is the point of running all three arms through the same
pipeline.

Also roll up, per arm, the two web-citation-specific signals from Sections 4
and 5: an **unfamiliar-outlet rate** (share of web citations with
`outlet_legitimacy: "unfamiliar"`) and a **vendor-sourced-citation rate**
(share of web citations with `vendor_sourced: true`). Neither changes a
citation's `classification`, but both matter for the same reason
`guest_to_host` gets its own tier: a citation can be technically
`verified-verbatim` and still not be the independent third-party grounding
the product's positioning implies it is. Full reporting/scoring format is
out of scope for this document.
