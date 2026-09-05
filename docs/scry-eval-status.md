# Scry Eval — Status & Handoff

*Written for continuity across Claude Code sessions. Last updated: Aug 29, 2026.*

## The actual question this eval answers

Does Scry's Lenny-corpus layer produce analysis a general model with web
access can't? Two working-PM testers (Aadhi, Abhi) independently converged
on competitive analysis as the use case, but Abhi asked the hard version of
the question directly: why not just Deep Research? This eval exists to
answer that with evidence instead of intuition, before committing to a
product direction or building more on an unproven core.

The deeper identity question — working PM comp analysis vs. aspiring PM
product-sense-building vs. the job-search/interview-prep use Andra
personally uses Scry for — is deliberately **not** decided yet. Citation
integrity, framework application, and insight novelty don't depend on that
answer. Positioning depth leans comp-analysis by default since that's what
both testers converged on, but it's a swappable judge dimension, not a
locked identity. **This is still the open question underneath everything
below.**

## Eval design

**Arms:**
- `scry` — full production pipeline (Haiku query generation → local corpus
  + Exa web search → Sonnet synthesis)
- `claude_vanilla` — same underlying model, no tools, no corpus
- `claude_web` — same model + web search, no corpus
- `deep_research` — manual only, run by hand using Abhi's actual verbatim
  prompt, not automatable via API. **Blocked: Abhi never sent his prompt.**
  Aadhi's prompt arrived and was already used once for a live assist, not
  yet run through this arm formally.

Open item: never explicitly confirmed that `claude_vanilla`/`claude_web`
call the *exact* same model version the live `generate-teardown` function
uses. Should verify before trusting the comparison is apples-to-apples.

**12-product list, stratified by real LennyData coverage counts:**
- High: Figma, Notion, Slack, Linear, Duolingo
- Moderate: Loom, Calendly, Webflow
- Zero (real job-search companies, doubles as personal intel): Nuvo, Arena
  Physica, Resolve AI, AirOps

**Scoring, two layers:**
1. **Citation verification (deterministic, no LLM judgment).** Extract every
   citation, classify as verified-verbatim / verified-paraphrase /
   misattributed / fabricated against the real archive grammar:
   `(Full Name, Role · Lenny's Archive)` for corpus, `(Outlet, Month Year)`
   for web, unattributed for training knowledge. Special check for
   guest-to-host misattribution specifically (previously flagged failure
   mode). Hard gate: under ~90% precision, stop and fix the pipeline before
   anything else matters.
2. **LLM-as-judge (pairwise).** Four dimensions: framework application,
   competitive positioning depth, insight novelty (two-step: extract unique
   claims, then rate them), coherence/actionability. Every comparison runs
   twice with positions swapped. Two judges from different families (Claude
   + Gemini) so no model grades its own homework. Formatting stripped before
   judging so structure isn't mistaken for quality.

**Decision gates, set before seeing results:**
- Citation precision <90% → fix pipeline first, everything else waits.
- Scry wins framework application + insight novelty on most high-coverage
  products with substantive unique claims → thesis holds, lock a use case,
  build framework-first query redesign, re-run to measure lift.
- Scry ties/loses even on high-coverage → pipeline isn't extracting the
  archive's value; one rescue attempt via framework-first queries, re-run;
  if still tied, that's real signal to shift toward portfolio-documentation
  framing.
- Wins on covered products but collapses on zero-coverage → thesis holds
  narrowly; honest coverage-signal UI feature moves up the list.

## What actually happened (progress log)

**Built:** `run-eval.mjs`, `prompts.mjs`, `eval_runs` table (live, applied).
Single-product template done; comparative two-product template (for the
Slack-vs-Teams shape) stubbed, not wired up.

**A two-day detour that turned out to matter more than the eval itself:**
Investigating why Figma (deep archive coverage) showed zero real archive
citations led to discovering `LENNYSDATA_TOKEN` had silently expired —
`searchLennyData` had no error-status check, so every 401 was swallowed and
treated identically to "the archive has nothing." This meant **the live
production app had been generating teardowns with zero real corpus
grounding**, not just in this eval, for however long the token had been
dead, which likely included some or all of Aadhi's and Abhi's actual test
sessions. (Note: the specific historical-timeline check against the real
`teardowns` table, to establish exactly when this started, was requested
but never confirmed completed — still an open thread if it matters later.)

**Real fix shipped, not just a rotation:** LennyData's own access model
turned out to be magic-link/session-based with no durable API-key option at
all (confirmed via their site — every supported client, Claude, Cursor,
Codex, authenticates the same way). Since no durable credential was ever
going to be available, the dependency itself got removed: the full archive
(683 rows — 369 newsletters + 314 transcripts) is now mirrored into a local
`lenny_corpus` Postgres table with `tsvector` full-text search, a quarterly
sync script (`scripts/sync-lenny-corpus.mjs`), and `generate-teardown`
swapped from the live MCP fetch to a single `supabase.rpc()` call. Deployed,
validated against real spot-checks (pricing → Madhavan Ramanujam, Notion →
Ivan Zhao/Camille Ricketts), merged to main.

**Important nuance, don't lose this:** this fixes the auth-fragility
failure mode entirely. It does **not** fix retrieval quality — the local
corpus search is still lexical/keyword-based, same fundamental limitation
as the old MCP. The pipe-delimited synonym-query trick (Haiku
free-associates likely phrasings, e.g. `"PLG|product-led growth|bottoms-up"`,
purely from its own training, then the corpus does literal string matching
against that hand-written list) is a real, working compensation, but it's
still bounded by whatever Haiku thought to write down. True semantic
search (embeddings + pgvector, schema already supports it, unused) is a
separate, deliberately deferred piece of work. Worth noting: Exa's web
layer already does genuine embeddings-based semantic search, so there's a
real quality asymmetry between the two grounding sources feeding the same
output right now.

**Verified the fix on Figma specifically:** re-ran the same checkpoint
post-migration. 6 real, verified archive citations landed (Claire Butler,
Mihika Kapoor, Hila Qu, April Dunford, Brian Balfour, Lauryn Isford), 2 of
10 originally-written citations were correctly scrubbed as unverified —
confirming `verifyParsedCitations` does real verification work rather than
passing everything through or deleting everything.

**Phase 1 batch run: complete.** 36/36 rows landed (12 products × 3 arms).
AirOps needed a third attempt — first two timeouts were initially suspected
to be a product-specific query hang, but the real cause was the laptop
going to sleep mid-request; not a pipeline defect. Worth remembering if any
future product times out — check for this mundane cause before assuming
something's wrong with the query.

**Parallel subagent work (built via Claude Code's Task tool, 4 concurrent
subagents, staged for review, none applied/integrated yet):**
- `judge-prompts.mjs` — 5 prompt functions covering the 4 dimensions above
  (novelty split into 2 steps as designed). Good, model-agnostic, formatting
  bias handled.
- `citation-verification.md` — design doc, read the *actual* live system
  prompt to extract the real citation grammar (this is what made the Figma
  diagnosis precise instead of eyeballed). Includes the guest-to-host
  special check.
- `pending_eval_judgments.sql` — staged schema for `eval_judgments` +
  `eval_citations`, RLS + GRANT pattern matches project convention.
  **Known gap, self-flagged by two independent subagents: no FK from
  `eval_judgments` back to `eval_runs.id`. Fix before applying.**
- `orchestration-design.md` — pairwise loop pseudocode, position-swap-to-tie
  logic, idempotency guard. Also flags a second gap: no claim-equivalence
  judge prompt exists yet for `dedupeClaimsAcrossOutputs` — needed before
  `run-judgments.mjs` can actually be built. And a third: exact
  `generate-teardown` response keys for baseline extraction need confirming.

**Security items found along the way, flagged but not fixed:**
- `generate-teardown`'s `getUserFromJwt` only base64-decodes the JWT
  payload, never verifies the signature — any forged 3-part token with a
  fabricated user_id is accepted. The eval's own dev-bypass currently
  depends on this exact hole to authenticate. **Must fix before any wider
  release or before real testers touch the app again** — but fixing it will
  break the eval's current auth method, so the eval script will need a real
  replacement (most likely the Supabase service role key directly) when
  that happens.
- Pre-existing migration-history drift on the Supabase project (phantom
  versions in remote history not matching local files) — blocks
  `supabase db push` until someone runs a migration repair. Left alone
  deliberately, out of scope of everything above.

**In progress right now:** requested a plain-text read-through of 3 products
across all 3 arms (Slack/high-coverage, Loom/moderate, Resolve AI/zero) to
sanity-check output quality before building the formal judging layer.
Claude Code produced an artifact called "coverage spectrum" — **not yet
reviewed, paste contents in to complete this section.**

## What's left, roughly in order

1. Read the coverage-spectrum artifact together against: does grounding
   carry real argumentative weight vs. decorate a sentence; does framework
   application derive a specific conclusion vs. name-drop; does positioning
   go past feature-parity into why bets differ; is `scry` distinguishable
   from `claude_web` with labels covered; any vendor-sourced citations
   masquerading as independent grounding (Figma had 3/16 pointing at its
   own Help Center); does `lennys_lens` read as real synthesis or generic
   filler.
2. Fix the `eval_judgments` FK gap and write the missing claim-equivalence
   prompt before promoting the staged schema.
3. Confirm `generate-teardown`'s exact response shape for baseline
   extraction.
4. Build and run Phase 2: citation verification pass (deterministic) +
   pairwise judging (Claude + Gemini, position-swapped) across all 12
   products.
5. Evaluate against the pre-committed decision gates above. This is the
   moment that actually answers whether the differentiation thesis holds.
6. Get Abhi's verbatim prompt (still outstanding) to finally run the manual
   Deep Research arm, at least on a subset.
7. Depending on Phase 2 outcome: either lock a use case and build the
   framework-first query redesign, or treat it as a rescue attempt, or
   start framing this honestly as a portfolio piece rather than a product
   with unproven differentiation.

**Not blocking, but don't let them quietly rot:**
- Fix JWT signature verification before any wider beta.
- Semantic embeddings upgrade — measure as its own before/after once built,
  don't fold it into this eval's baseline.
- Email LennyData directly about durable server-side access options
  (asked, not yet sent as far as this record shows).
- Migration-history repair.

## Process note, since you're consolidating into Code

Claude Code can hold real planning conversations now too, not just execute,
so moving day-to-day build decisions there is reasonable. The one thing
worth being deliberate about: a fresh Code session has no memory of any of
this unless you feed it something like this document first. This file is
meant to be that bridge — paste it in at the start of a new session instead
of re-explaining the last two weeks from scratch.
