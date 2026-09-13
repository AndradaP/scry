# Scry Eval — Status & Handoff

*Written for continuity across Claude Code sessions. Last updated: Sep 13,
2026. Everything below "What actually happened (progress log)" through Aug
29 is left as history; the Sep 2026 sections below it (in date order) are
the current state — read those first, and read this snapshot before
diving into the detailed log.*

## Snapshot — where things actually stand (2026-09-13)

**Why this eval exists** (unpacked below): does Scry's Lenny-corpus layer
produce analysis a general model with web access can't — evidence, not
intuition, before committing further to the product direction.

**What's been proven so far, in order:**
- The original word-overlap citation matcher had a real, structural ceiling
  (a genuinely correct match scored *lower* than a genuinely wrong one, no
  threshold could fix it) — replaced with real embedding-based matching,
  validated against the exact cases that exposed the ceiling.
- That fix, ported into live generation as a self-correcting citation
  mechanism (never trust the model's claimed attribution — always resolve
  it against real retrieved chunk metadata), moved archive-only citation
  precision **20.0% → 47.9%** — real, substantial, still short of the 90%
  gate. The two remaining causes are named and diagnosed, not mysterious
  (see the 2026-09-10 section) — deliberately not fixed further this week.
- Two real production bugs were found and fixed along the way: an Edge
  Function memory crash on large transcripts, and a silent revert of an
  already-live, separately-developed fix (both documented below).
- The LLM-judge comparison (cost-reduced to 8 of 12 products, preserving the
  coverage-tier stratification) is underway and, on the 4 products judged so
  far, showing a consistent, honest picture: scry wins the large majority of
  framework/positioning/coherence comparisons against both baselines, with
  real exceptions kept in (one genuine loss, one caught instance of judge
  self-preference bias — see below). The standout finding is groundedness:
  scry's claims check out as grounded (archive or web) at 85-100% across
  every product judged so far, independently confirmed by both judge
  families, against near-zero for the no-tools baseline.
- The run has been interrupted twice by exhausted API credits (Anthropic,
  then Gemini) — the idempotent skip-on-already-judged design meant zero
  data loss both times, just a clean resume.

**Not yet decided:** the actual Day 3 verdict against the pre-committed
decision gates below — waiting on the remaining 4 products (Loom, Calendly,
Nuvo, Resolve AI) to finish judging.

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

**In progress as of Aug 29:** a plain-text read-through of 3 products across
all 3 arms was requested to sanity-check output quality before building the
formal judging layer. Superseded by what actually happened next — Phase 2
(citation verification + pairwise judging) got built and run for real; see
below.

## September 2026 update — Phase 2 ran, a real incident happened, and it surfaced findings that reframe the plan above

**Phase 2 got built and run.** Citation verification (deterministic,
`run-citation-verification.mjs`) and pairwise LLM-judging (Claude + Gemini,
position-swapped, `run-judgments.mjs`) both exist and have real data behind
them now — 12 products, both baseline arms, most of the judge matrix
complete. The staged `eval_judgments`/`eval_citations` schema was promoted
for real (`20260830_eval_judgments.sql`).

**A real cost incident happened and got fixed.** Unbounded claim extraction
(one output produced 147 "distinct claims," no cap anywhere) combined with
one live web-search API call per ungrounded claim burned **$62.27** in a
single day, batch nowhere near finished. Root-caused against real data
before fixing, not guessed at. Fixed with three things, all committed: a
hard spend ceiling (`lib/budget.mjs`, `EVAL_BUDGET_USD`, throws
`BudgetExceededError` which kills the *whole* run, not just one dimension),
a hard cap on claims considered per side (`MAX_CLAIMS = 20`, enforced in
code not just prompted), and batching the fact-check calls (one call per
side covering every ungrounded claim, not one call per claim). Verified
against a real $1-ceiling test run before trusting it further.

**The `insight_novelty` dimension was renamed and redesigned as
`grounded_insight_value`.** It used to also ask the judge to rate
"validity" as *"how likely is this claim to be actually true, based on what
a knowledgeable practitioner would believe"* — which cannot distinguish a
true claim from a confident, plausible, false one, since that's the exact
shape of a good hallucination. Validity is no longer judge-guessed: each
unique claim is checked against the real archive first, then a live web
fact-check if the archive has nothing. Ungrounded-but-confident claims are
actively penalized (not just excluded) — a nice-sounding hallucination is
worse than no claim at all, per explicit instruction. A length-bias defense
was also added alongside the existing formatting-bias one.

**Reading real losing rows surfaced two deeper problems with the
redesigned rubric, before it had even fully run:**
- **Groundedness didn't distinguish *why* a claim is verifiable.** For
  famous, extensively-documented companies (Duolingo, Figma), `claude_vanilla`
  — zero tools, zero archive access — got claims classified
  `archive_paraphrase`-grounded purely because its training-knowledge
  claims happened to also be true and independently verifiable. On
  Duolingo it scored **19/19 claims "grounded."** This meant the check
  answered "is this true" not "did this arm's retrieval actually produce
  this," undermining the eval's whole purpose hardest on exactly the
  high-coverage products where Scry should look best. **Fixed**: archive-tier
  grounding (`archive_verbatim`/`archive_paraphrase`) is now only reachable
  for `scry`'s own claims — the only arm with a real path to have used the
  archive.
- **Live web fact-checking can't verify strategic interpretation the way it
  verifies facts.** A reasonable synthesis claim ("Loom inverted typical PLG
  mechanics...") gets "no evidence found" and was hit with the same full
  penalty as an actively false claim. **Fixed**: `web_contradicted` keeps
  the full penalty; a "no evidence either way" verdict gets a much lighter
  one (`NOVELTY_PENALTY_WEIGHT_NO_EVIDENCE = 1` vs. 3).

Both fixes are implemented and committed. The 46 old `grounded_insight_value`
rows (scored under the pre-fix, invalid methodology) were deleted; only 5
of them have been recomputed under the fixed code so far — **blocked
repeatedly on the Anthropic account's credit balance running out
mid-batch**, a recurring issue across this whole session (added credits
multiple times, same error recurred — looked like an org/workspace
mismatch rather than a genuine shortfall each time). Do not trust any
`grounded_insight_value` aggregate number until this finishes a full,
clean run.

**A parallel three-agent investigation ran** (Task tool, one in the main
worktree scoped to `scripts/eval/`, two in isolated git worktrees to avoid
file conflicts) to move faster without the mistakes above repeating:

1. **Rubric-fix agent** — implemented the two fixes above. Blocked on the
   Anthropic credit issue for finishing the re-run (see above).
2. **Unknown-product query-fix agent** — built and **already deployed live**
   to `generate-teardown` (not yet merged to `main` — the git commit is only
   on `worktree-agent-ac6ca54aa6a14cafa`, so production and `main` are
   currently out of sync, a deliberate hold pending the item below). For a
   zero-coverage product, it now runs the web-search leg first, extracts
   real category/business-model signal, and issues a follow-up archive
   query with that instead of just the raw (unmatchable) product name.
   Tested on Nuvo/Arena Physica/Resolve AI/AirOps: **fabrication dropped
   meaningfully** (combined 17.2%→12.3%, Arena Physica 58.3%→13.0%), but
   **precision dropped for 3 of 4 products** — the agent traced this
   honestly to the archive-matcher quality issue below giving more
   retrieved content more chances to be mis-matched, not to a flaw in the
   query-bootstrap idea itself. Resolve AI's fallback never triggered — a
   separate, unfixed name-collision bug (the words "resolve"/"ai" are
   common enough to spuriously return archive hits on the bare product
   name). **Do not judge this fix's real value until it's retested against
   the fixed matcher below.**
3. **Citation-precision investigation agent** (report only, no code
   changes, by design — the exact "build before diagnosing" mistake from
   the `grounded_insight_value` rework was avoided on purpose here) — see
   findings below. Independently converged on the same underlying matcher
   problem the query-fix agent's precision drop pointed at, from a
   completely different angle — a real cross-validation signal.

**Citation-precision investigation findings, all with concrete evidence,
not guesses:**

- **The original "Moderate tier (51%) is worse than Zero tier (72%)"
  mystery is mostly a measurement artifact, not a real quality gap.** Web
  citations get an automatic pass in `run-citation-verification.mjs` —
  format-checked only, content never verified (`classifyWebCitation`'s own
  header comment already says this is out of scope). Zero-tier leans
  heavily on web citations (69%, since there's nothing archive-shaped to
  say), which all auto-pass; Moderate-tier leans more on archive citations
  (56%), which go through the one path that's actually checked — and that
  path fails at almost the same real rate in both tiers (12.5% vs. 11.1%
  archive-verified). **The 90% precision gate is inflated for any product
  leaning on web citations** — a live methodology gap, not fixed yet.
- **Confirmed, fixed bug #1**: `archive-lookup.mjs`'s speaker resolution
  anchored on the first occurrence of the first significant claim word
  *anywhere in the whole transcript* — in a multi-speaker document that's
  near-arbitrary. Proven concretely: a verbatim Katie Dill quote got
  resolved to "Lenny" this way. **Fixed** — now finds the position whose
  surrounding window contains the most of the claim's other significant
  words too. Verified fixed on the Katie Dill case.
- **Confirmed, fixed bug #2**: `extract-citations.mjs`'s sentence-boundary
  regex broke on any decimal number appearing earlier in the same
  paragraph ("2.5 years"), silently falling back to grabbing the entire
  preceding section as `claim_text` instead of one sentence, blending
  unrelated citations together. **Fixed** — decimal points are masked
  before sentence-boundary matching.
- **A real, deeper, NOT-yet-fixed problem**: generic "recognizable expert"
  name-dropping. For thin-coverage (Moderate-tier) products, Scry names
  plausible real archive guests (April Dunford, Hila Qu, Katie Dill) from
  general topic knowledge, not from anything actually retrieved about that
  specific product — and misses the one real archive-connected guest that
  does exist (Calendly's Oji Udezue, never cited). This is a
  **generation-side defect** (`generate-teardown` itself), not just an
  eval-measurement issue, though the eval's own word-overlap matcher (next
  item) makes it easy for this pattern to hide behind a plausible-looking
  "verified-paraphrase" match.
- **The matcher's actual ceiling, discovered empirically, not assumed —
  this is the load-bearing finding for the semantic-search question.**
  Tried fixing the wrong-episode-matching problem by scoring word-overlap
  within the same local window used for speaker resolution (instead of the
  whole document) — this correctly demoted real false-positive matches
  (Snyk episode wrongly matched to a Duolingo claim: 0.11-0.22 across all
  window sizes tried, well below any reasonable threshold) but **also
  broke a genuinely correct match** (real Duolingo-streaks claim, correct
  episode, tops out at 0.43 confidence in its best window — never clears
  0.55). Worse: a wrong match (Duolingo growth claim → generic Lenny
  newsletter about building growth engines) sits flat at **0.538
  regardless of window size**, because that newsletter is generically
  *about* growth and shares vocabulary with almost any growth-related claim.
  **No threshold or window size can separate a 0.43 correct match from a
  0.538 wrong one — this is not a tuning problem, it's a real ceiling on
  plain word-overlap.** This windowed-scoring change is sitting
  **uncommitted** (`lib/archive-lookup.mjs`) pending the decision below —
  do not assume it's live.

**Open decision, not yet made: how to fix the matcher ceiling.** Three real
options, in cost order: (1) ship the windowed version anyway, accepting the
tradeoff it demonstrably has; (2) weight distinctive/rare words much more
than generic ones (TF-IDF style) — still lexical, no new infrastructure,
directly targets the demonstrated failure mode (generic vocabulary
overwhelming specific signal), untested but theoretically well-motivated,
worth trying before the bigger option; (3) real semantic
embeddings/`pgvector` (already schema-ready, unused) — now genuinely
justified by concrete, reproducible evidence rather than an assumption
("discover, don't assume" was the standing principle all along, and this is
what discovering it looks like) — but still the most expensive option, and
option (2) hasn't been tried yet so it isn't yet proven necessary.
**Recommendation if no one's made the call yet: try (2) first, cheaply; if
it doesn't resolve the Duolingo-streaks-vs-newsletter-class of case, that's
the real trigger for (3).**

**Consider for future eval cost**: swap the tool-free judge calls (claim
extraction, usefulness scoring, the three pairwise comparison dimensions —
the bulk of token volume) to a cheap open-weight model via any inference
provider. Real, not just cost savings: a third model family also
strengthens the existing "no model grades its own homework" defense beyond
just Claude+Gemini. Does NOT cleanly cover the live web fact-check, which
rides on Claude's built-in server-side search tool — an open-weight swap
there needs real search wired up manually (Exa, already used in production)
rather than being a drop-in replacement. Not scoped yet — a real follow-up
decision, not a snap model pick.

## What's left, roughly in order

1. **Decide the archive-matcher fix** (see the three options above) —
   currently blocking trust in any citation-precision number, and blocking
   whether to merge the unknown-product query fix (item 2).
2. **Decide whether to merge the unknown-product query-fix branch**
   (`worktree-agent-ac6ca54aa6a14cafa`) to `main` — currently deployed live
   to production but un-merged; re-test against the fixed matcher before
   deciding, not against the current numbers (matcher-confounded).
3. **Finish the `grounded_insight_value` re-run** — blocked on the
   Anthropic account credit issue (check the org/workspace the API key
   actually belongs to, not just whether credits were added) — and should
   happen *after* item 1 lands, so it isn't scored against a matcher known
   to be wrong (would mean a third re-run otherwise).
4. **Build real web-citation content verification** (currently
   format-checked only, inflating precision on any product leaning on web
   citations) — the `lib/web-fact-check.mjs` batched fact-checker already
   built for `grounded_insight_value` is directly reusable here, this is
   mostly wiring, not new design.
5. **Scope the generation-side generic-expert-name-dropping fix**
   (`generate-teardown` itself, not the eval) — real, confirmed, not yet
   designed.
6. **Full re-analysis** once 1-4 land, against the pre-committed decision
   gates in "Eval design" above — this is the actual moment that answers
   whether the differentiation thesis holds, still pending.
7. Get Abhi's verbatim Deep Research prompt (still outstanding, unrelated
   to everything above) to finally run the manual arm, at least on a
   subset.
8. Scope the open-weight-model swap for eval judging (see above) — real
   cost-reduction opportunity for whatever Phase 3 looks like.

**Not blocking, but don't let them quietly rot:**
- Fix JWT signature verification before any wider beta (flagged 2026-08-23,
  still not fixed).
- Email LennyData directly about durable server-side access options (asked,
  not yet sent as far as this record shows).
- Migration-history repair (pre-existing drift, unrelated to the two new
  migrations added this session, which are both accounted for in
  `supabase/migrations/`).
- Resolve AI's archive fallback never triggering (name-collision bug, found
  during the unknown-product query-fix testing, not fixed).
- **Entailment/faithfulness gap in the 2026-09-09 chunk-based citation fix**:
  the fix (embedding-similarity match against retrieved chunks) corrects
  misattribution (wrong person cited) and catches fabrication (no real
  source), but cannot catch a claim that cites the *right* person/source
  while still distorting the actual content — similarity measures topical
  closeness, not factual correctness. A paraphrase can sit close enough to a
  real chunk to pass while quietly exaggerating a number, inverting a
  conclusion, or adding a detail that isn't there. Fixing this needs a
  different mechanism — a lightweight entailment/faithfulness check ("does
  this excerpt actually support this claim: yes/no/partially"), the same
  shape as `classifyGroundedness()` in the `grounded_insight_value` work, not
  a bigger similarity threshold. Deliberately out of scope this week —
  unmeasured whether it's a real problem in practice (everything sampled so
  far was misattribution, not distortion-with-correct-attribution); worth
  checking the "verified" bucket for this once the chunk-based fix ships,
  before deciding whether to build it.

## 2026-09-10 — chunk-based citation fix shipped, re-verified, two remaining root causes diagnosed and NOT fixed (by design — see below)

Full re-run after the 2026-09-09 fix (chunk-based retrieval + self-correcting
citations, deployed) plus the restored zero-coverage fallback (see below):
archive-only citation precision **20.0% (18/90) → 47.9% (46/96)** — misattribution
roughly halved (58 → 34), fabrication flat (14 → 16, expected — the fix was
never meant to touch it). Still fails the 90% gate. Sampled all 34 remaining
misattributed + all 16 remaining fabricated cases before stopping (explicit
call: no further fix-and-redeploy cycles this session). Two distinct,
evidence-backed causes, neither a quick patch:

1. **Bounded-retrieval misattribution (new pattern, not last night's).**
   The dominant remaining misattribution shape: the model's own prose
   correctly names a real archive person ("mirrors Hila Qu's framework,"
   "Noah Weiss calls...") but the citation still says `(Lenny Rachitsky,
   Host)`. Cause: the production correction step (generate-teardown) can
   only resolve a citation against chunks *actually retrieved that
   generation* — 5 candidate docs × 7 topic queries. When Sonnet name-drops
   a real archive person from its own training knowledge rather than from
   retrieved content, that person's chunk was never in the pool to correct
   against, so the citation stays wrong or gets reassigned to whatever
   similar-topic chunk *was* retrieved (often Lenny). The eval's independent
   per-claim check (archive-lookup.mjs, unbounded, searches fresh per claim)
   finds the real person; production's bounded per-generation retrieval
   structurally can't. This is the same "candidate pool too narrow" shape as
   the original archive-lookup.mjs bug, recurring one layer up, at
   generation time instead of verification time. Real fix would need
   production to do a fresh, claim-scoped lookup post-generation (not just
   corpus-scoped-to-the-original-queries) — a meaningfully bigger change,
   not attempted.

   **Refined on closer read (2026-09-10, post-session review):** the 34
   remaining misattributed cases actually split into two different shapes,
   not one:
   - **Real, mechanical mismatch** (roughly half): the model's own prose
     *already names the right person* ("mirrors **Noah Weiss's** approach,"
     "**Katie Dill's** observation," "**Michael Truell's** insight") but the
     citation badge still says `(Lenny Rachitsky, Host)` anyway. The
     correction step isn't using the name already sitting in the sentence at
     all — it only trusts embedding similarity against the bounded retrieval
     pool.
   - **Genuinely ambiguous, possibly not even wrong** (the other half): the
     claim is a generic paraphrase naming nobody, and a *different* person's
     episode happens to score as the closest re-check match — the same
     "two real sources, near-tie" shape as the Duolingo growth-engine case
     from Day 1. Re-scoring against a different search doesn't prove the
     original citation was false.

   **A real (not patch) fix exists for the first half, proposed but not
   built:** before trusting similarity-based correction, first check whether
   the claim's own sentence already names a real person — cross-reference
   against the full list of real archive speakers we already have (every
   `speaker` value in `lenny_corpus_chunks`). If the named person is a
   verified real archive speaker, that's a stronger signal than similarity
   math and should win. If the named person *isn't* verifiable as a real
   archive speaker (e.g. Michael Porter — a real person Sonnet knows
   generally, not necessarily an archive guest), the honest move is to drop
   the citation parenthetical entirely rather than default to Lenny or
   guess — the sentence stays, it just stops claiming archive provenance.
   This does not touch the second half (the near-tie cases) — that still
   needs the bigger "fresh claim-scoped lookup post-generation" fix noted
   above.

2. **Fabrication is the pre-existing, already-documented "generic expert
   name-dropping" problem, confirmed unrelated to anything built this week.**
   All 16 sampled fabricated citations show `evidence: no archive candidate
   found` — not "found something, didn't match," literally nothing in the
   archive for that claim's wording even at a 15-candidate search width.
   Claims read like real training-knowledge facts (Slack's "rooster warning
   before @channel," a Webflow hiring anecdote) wearing an archive-citation
   costume that doesn't belong. This is the same problem named in
   scry-eval-status.md before any of this week's work started — confirmed
   still present, confirmed untouched by the chunk-based fix (which was
   never designed to address it).

   **Open question, not resolved:** are these hallucinations (invented,
   possibly false) or true facts Sonnet knows generally but mislabeled as
   archive-sourced? Current tooling can't tell — it only checks "does this
   match Lenny's archive," never "is this claim true in the real world."
   Spot-reading a few by eye, some look like plausible real facts (Slack's
   `@channel` warning dialog, Duolingo's China/India expansion stumbles are
   both the kind of thing that's genuinely been publicly discussed) wearing
   the wrong badge; others are specific enough (an exact freemium video
   count, a hiring anecdote) that they can't be judged as true or invented
   without an actual check. Distinguishing the two needs a live fact-check
   against the real world, not just against the archive — the same
   `lib/web-fact-check.mjs` machinery already built for `grounded_insight_value`
   is directly reusable here (flagged there too), still just wiring, not new
   design.

**The unifying theme across both findings, worth stating plainly:** the
system has no clean way to say "this specific piece of text is general
knowledge, not archive-derived" — everything gets forced into an
archive-citation-shaped box (kept, corrected, or stripped) rather than ever
being allowed to just be true-but-uncited. Both the name-in-prose fix above
and the fact-check-for-fabrication idea are really the same underlying
capability from two different angles: telling apart "from Lenny's archive"
vs. "from Claude's training / the general internet." Worth treating as one
project if either gets picked up, not two.

**Also fixed along the way, not part of the diagnosis above:**
- Deploying this branch's generate-teardown/index.ts silently reverted the
  already-live, never-merged "unknown-product query-fix"
  (`worktree-agent-ac6ca54aa6a14cafa`, commit 2c9dfe6) — it was deployed
  out-of-band from git, so a git-based deploy of an older base overwrote it.
  Cherry-picked back in and reconciled with the chunk-based retrieval (the
  zero-coverage fallback query now also goes through the chunk-aware
  resolver, not the old flat-text path, so it benefits from real speaker
  metadata too). **This branch should be merged to main with both fixes
  together, not just the citation fix alone** — deploying only one half
  again would silently re-break the other.
- `WORKER_RESOURCE_LIMIT` crash confirmed for real (2 of 12 first-batch
  regenerations): unbounded per-document chunk fetch (some transcripts have
  300+ chunks) blew Edge Function memory. Capped at 60/document, ordered by
  chunk_index. Real fix is ranking by similarity in Postgres scoped to one
  filename (a new RPC/migration) instead of transferring every embedding
  over the network to rank in JS — not available this session, noted above
  in the retrieval code itself too.

**Decision not yet made**: whether to proceed to the LLM-judge comparison
with citation precision still below gate (treating it as informative
context rather than an absolute blocker, given the trajectory and now-named
causes), or hold judging until one or both root causes above are addressed.

## Process note, since you're consolidating into Code

Claude Code can hold real planning conversations now too, not just execute,
so moving day-to-day build decisions there is reasonable. The one thing
worth being deliberate about: a fresh Code session has no memory of any of
this unless you feed it something like this document first. This file is
meant to be that bridge — paste it in at the start of a new session instead
of re-explaining the last two weeks from scratch.
