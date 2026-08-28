# Judgment Orchestration — Design

Status: design + pseudocode only. Nothing here is wired up or executable.
Companion to `scripts/eval/judge-prompts.mjs` (judge prompt templates, already
implemented) and `supabase/migrations/pending_eval_judgments.sql` (staged
schema for `eval_judgments` / `eval_citations`, not yet promoted to a real
migration). This doc does not redefine either of those — it assumes their
current shape and designs the script that sits between them: pulling two
`eval_runs` rows for the same product, running them through every judge
dimension, and writing `eval_judgments` rows.

Target file for the eventual implementation: `scripts/eval/run-judgments.mjs`
(not created by this doc).

## 1. Inputs and scope

`eval_runs` has no foreign key from `eval_judgments`, and a product/arm pair
can have multiple `eval_runs` rows (the script is re-run over time). To avoid
silently comparing the wrong pair of runs, the orchestrator takes explicit
run identifiers rather than resolving "the run for product X, arm Y" itself:

```
orchestrateJudgments({ runIdA, runIdB, judgeModels }):
  runA = fetchEvalRun(runIdA)
  runB = fetchEvalRun(runIdB)
  assert runA.product == runB.product
  assert runA.arm != runB.arm

  # Canonicalize order so the same pair is never recorded as both
  # (arm_a=scry, arm_b=claude_vanilla) and (arm_a=claude_vanilla, arm_b=scry).
  [canonicalRun, otherRun] = sortByArmName([runA, runB])
  product   = canonicalRun.product
  arm_a     = canonicalRun.arm
  arm_b     = otherRun.arm

  textA = sanitizeOutput(canonicalRun)
  textB = sanitizeOutput(otherRun)

  for judgeModel in judgeModels:
    for dim in STANDARD_DIMENSIONS:
      runStandardDimension(product, arm_a, arm_b, dim, textA, textB, judgeModel)
    runInsightNoveltyDimension(product, arm_a, arm_b, textA, textB, judgeModel)
```

Caveat worth flagging for review: because `eval_judgments` keys on
`(product, arm_a, arm_b, dimension, judge_model, position_swapped)` and not
on `eval_runs.id`, re-judging with a *different* pair of runs for the same
product/arm combo will collide with prior rows under the current schema.
Callers are responsible for only invoking this once per product/arm pair
they care about, or for accepting that a later run overwrites/skips based on
the same identity (see §5). This is a schema limitation, not something this
script works around.

## 2. Judge backend abstraction

Judge dimensions must run against at least two vendors (e.g. Claude, Gemini)
through one interface, so nothing here may assume a specific SDK:

```
# A JudgeBackend is anything that can turn a prompt string into a raw text
# reply. All vendor-specific auth/request/response-unwrapping lives behind
# this boundary.
interface JudgeBackend:
  name: string                      # "claude", "gemini", ...
  complete(promptText: string) -> string   # raw text reply, expected to be JSON

JUDGE_BACKENDS = [
  ClaudeJudgeBackend(model: "claude-sonnet-4-5"),
  GeminiJudgeBackend(model: "gemini-2.5-pro"),
]

function callJudgeJSON(backend, promptText):
  raw = backend.complete(promptText)
  parsed = parseJSON(raw)   # throw a clear error on non-JSON; do not silently coerce
  return parsed
```

`runStandardDimension` / `runInsightNoveltyDimension` take a `JudgeBackend`
instance, not a vendor name — swapping in a third judge is adding an entry
to `JUDGE_BACKENDS`, not touching the loop logic.

## 3. Pre-judge sanitization

Both `eval_runs.raw_output` shapes currently in the table are arm-specific
and would leak the arm identity if handed to a judge unmodified:

- `scry` rows: `raw_output` is whatever `generate-teardown` returns —
  Scry's own structured teardown payload (section headers per the Master
  Rubric, "Lenny's Lens" framing, Scry's citation formatting). Its shape and
  section-label vocabulary is unique to Scry and instantly identifiable.
- `claude_vanilla` / `claude_web` rows: `raw_output` is the *raw Anthropic
  Messages API response envelope* (`content` blocks, `stop_reason`, `usage`,
  and for `claude_web`, `tool_use`/`web_search` blocks). The envelope shape
  itself — and the presence of tool-use blocks — is a dead giveaway
  regardless of the text inside it.

So sanitization is two passes: extract plain analysis text out of whatever
envelope the arm produced, then strip branding/structural tells from that
text.

```
function sanitizeOutput(run):
  text = extractText(run.arm, run.raw_output)
  return stripArtifacts(text)

function extractText(arm, rawOutput):
  match arm:
    case "scry":
      # Pull the actual analysis text out of generate-teardown's response
      # shape (confirm exact keys against the live payload when
      # implementing — run-eval.mjs treats it as an opaque blob and never
      # unpacks it). Concatenate section bodies in document order; drop any
      # metadata fields (coverage_tier, citation source arrays, etc.) that
      # aren't prose.
      return joinSections(rawOutput)   # placeholder for real key access
    case "claude_vanilla" | "claude_web":
      # Anthropic Messages API envelope: concatenate only text blocks,
      # skip tool_use / tool_result / thinking blocks entirely — their
      # presence is itself an arm signature (only claude_web calls
      # web_search).
      return rawOutput.content
        .filter(block => block.type == "text")
        .map(block => block.text)
        .join("\n\n")

function stripArtifacts(text):
  text = removeKnownSectionLabels(text)   # e.g. Scry's fixed rubric headers
                                           # ("GTM & Growth Loops", "Lenny's
                                           # Lens", etc.) — anything that only
                                           # ever appears in one arm's output
  text = removeWatermarksAndAttribution(text)  # "Generated by Scry", share
                                                # links, product/app chrome
  text = removeSelfReferences(text)       # "As Claude/Anthropic's assistant..."
  text = normalizeCitationMarkers(text)   # Scry's citation bracket/footnote
                                           # style vs. plain inline mentions —
                                           # normalize both to one neutral form
                                           # so citation formatting isn't a tell
  text = collapseMarkdownStructure(text)  # optional: normalize heading levels/
                                           # bullet style if structural
                                           # "shape" (not content) still reads
                                           # as arm-identifying even after
                                           # label removal
  return text.trim()
```

This runs once per run (not once per position-swap call) — both position
orderings reuse the same sanitized `textA` / `textB`, they just get relabeled
as "Output A" / "Output B" differently per call (§4).

## 4. Core pairwise loop — standard (single-call) dimensions

`framework_application`, `competitive_positioning`, and
`coherence_actionability` all share the same shape: one prompt function
`(outputA, outputB) -> promptText`, one `{winner, justification}` response.
Each needs to run twice per judge model — normal position and swapped —
and the raw `winner` letter has to be mapped back to the real arm before
anything is compared or stored, since "A" means different arms in the two
calls.

```
STANDARD_DIMENSIONS = [
  { name: "framework_application",   promptFn: frameworkApplicationPrompt },
  { name: "competitive_positioning", promptFn: competitivePositioningPrompt },
  { name: "coherence_actionability", promptFn: coherenceActionabilityPrompt },
]

function runStandardDimension(product, arm_a, arm_b, dim, textA, textB, judgeBackend):
  # position_swapped=false: arm_a shown as Output A, arm_b as Output B
  normalRow = runSinglePositionCall(
    product, arm_a, arm_b, dim, judgeBackend,
    positionSwapped: false,
    promptOutputA: textA, promptOutputB: textB,
  )

  # position_swapped=true: arm_b shown as Output A, arm_a as Output B
  swappedRow = runSinglePositionCall(
    product, arm_a, arm_b, dim, judgeBackend,
    positionSwapped: true,
    promptOutputA: textB, promptOutputB: textA,
  )

  return { normalRow, swappedRow }   # aggregate computed separately, see §4.1

function runSinglePositionCall(product, arm_a, arm_b, dim, judgeBackend,
                                positionSwapped, promptOutputA, promptOutputB):
  if alreadyJudged(product, arm_a, arm_b, dim.name, judgeBackend.name, positionSwapped):
    return fetchExistingJudgment(...)   # see §5

  promptText = dim.promptFn(promptOutputA, promptOutputB)
  raw = callJudgeJSON(judgeBackend, promptText)   # { winner: "A"|"B"|"tie", justification }

  # Map the judge's letter (relative to what it was shown) back onto the
  # real arm, so the persisted "winner" always means arm_a/arm_b, never
  # "whichever text happened to be labeled A in this call".
  normalizedWinner = normalizeWinner(raw.winner, positionSwapped)

  row = {
    product, arm_a, arm_b,
    dimension: dim.name,
    judge_model: judgeBackend.name,
    position_swapped: positionSwapped,
    winner: normalizedWinner,        # already in arm_a/arm_b terms
    justification: raw.justification,
    unique_claims: null,
  }
  persist("eval_judgments", row)
  return row

function normalizeWinner(rawWinner, positionSwapped):
  if rawWinner == "tie": return "tie"
  # Not swapped: judge's "A" *is* arm_a, "B" *is* arm_b — identity mapping.
  # Swapped: judge's "A" was actually arm_b's text, "B" was arm_a's — flip.
  if not positionSwapped:
    return rawWinner
  return rawWinner == "A" ? "B" : "A"
```

### 4.1 Swap-flip handling → aggregate to `tie`

Both calls now store a `winner` already normalized to arm_a/arm_b terms, so
detecting a position-bias flip is a direct comparison of the two stored
values — no re-mapping needed at this stage, which is precisely why the
normalization happens before persistence rather than after:

```
function computeAggregateVerdict(normalRow, swappedRow):
  if normalRow.winner == "tie" and swappedRow.winner == "tie":
    return "tie"
  if normalRow.winner == swappedRow.winner:
    # Same real arm won regardless of which position it was shown in —
    # a genuine signal.
    return normalRow.winner
  # normalRow.winner != swappedRow.winner: the preferred arm changed
  # depending purely on which slot ("Output A" vs "Output B") it was
  # placed in. That's position bias, not a quality signal — record it
  # as a tie for this dimension/judge_model.
  return "tie"
```

Note on persistence: the current staged schema (`pending_eval_judgments.sql`)
has no row shape for "the aggregate across a position-swap pair" — only
per-call rows keyed by `position_swapped`. This design does not add a column
or a synthetic third row to work around that (out of scope: not touching the
migration). `computeAggregateVerdict` is meant to be called by a reporting/
read step over the two persisted rows for a `(product, arm_a, arm_b,
dimension, judge_model)` group, e.g. when building a scoreboard. If a
persisted aggregate turns out to be needed later, that's a schema change for
the sibling migration doc to pick up, not something this script should
invent unilaterally.

## 5. Idempotency / partial-failure handling

Re-running the orchestrator over a product/arm pair that's already partially
judged should not re-call judge APIs (cost) or overwrite existing rows
(non-determinism — a re-run judge call can legitimately return a different
verdict, and silently clobbering the first one hides that). The guard is a
straight existence check on the judgment's natural key before every call:

```
function alreadyJudged(product, arm_a, arm_b, dimension, judgeModel, positionSwapped):
  existing = query("eval_judgments", {
    product, arm_a, arm_b, dimension,
    judge_model: judgeModel,
    position_swapped: positionSwapped,
  })
  return existing.length > 0
```

Both `runSinglePositionCall` (§4) and `runInsightNoveltyDimension` (§6)
check this before calling out to a judge, and skip (logging a "already
judged, skipping" line) rather than erroring. A crash mid-run — network
error, malformed judge JSON, rate limit — should be caught per-call so one
failing dimension/judge/position combo doesn't stop the rest of the matrix
from running; log the failure with enough identity
(`product/arm_a/arm_b/dimension/judge_model/position_swapped`) to be
re-runnable, and let the next invocation's `alreadyJudged` check naturally
pick up only what's missing.

## 6. Special case — `insight_novelty` (two-step dimension)

Unlike the standard dimensions, `insight_novelty` never sends both outputs
to the judge in one "Output A vs Output B" prompt. Per the judge-prompt
design, it's claim extraction (one output at a time) → uniqueness diff
(non-judge step) → novelty scoring (one claim list at a time). There is no
"Output A / Output B" framing anywhere in this pipeline for a position-bias
swap to apply to — extraction and scoring both operate on a single side at a
time. This dimension therefore writes only `position_swapped = false` rows;
that's a deliberate consequence of its shape, not an oversight, and is
called out explicitly here so it isn't mistaken for a missed swap call
during review.

```
function runInsightNoveltyDimension(product, arm_a, arm_b, textA, textB, judgeBackend):
  dimName = "insight_novelty"
  if alreadyJudged(product, arm_a, arm_b, dimName, judgeBackend.name, positionSwapped: false):
    return fetchExistingJudgment(...)

  # Step 1: extract claims independently per output.
  claimsA = callJudgeJSON(judgeBackend, claimExtractionPrompt(textA)).claims
  claimsB = callJudgeJSON(judgeBackend, claimExtractionPrompt(textB)).claims

  # Step 2: diff for uniqueness (non-judge-verdict step — determining
  # whether two claims are "the same point" is itself a semantic judgment
  # call, so this likely needs its own judge-backed equivalence prompt;
  # judge-prompts.mjs doesn't currently export one, so this is flagged as
  # an open dependency on the sibling doc rather than assumed away).
  { uniqueToA, uniqueToB } = dedupeClaimsAcrossOutputs(claimsA, claimsB, judgeBackend)

  # Step 3: score each arm's unique claims independently.
  scoredA = uniqueToA.length > 0
    ? callJudgeJSON(judgeBackend, noveltyScoringPrompt(uniqueToA, product)).claims
    : []
  scoredB = uniqueToB.length > 0
    ? callJudgeJSON(judgeBackend, noveltyScoringPrompt(uniqueToB, product)).claims
    : []

  # Step 4: reduce per-claim {validity, usefulness} into one dimension
  # verdict. Sum rather than average so an arm with more *and* better
  # unique insights wins outright; an arm that surfaces one unique claim
  # doesn't automatically lose to an arm with three weaker ones, but volume
  # still counts for something (subject to tuning once real data exists).
  scoreA = sum(scoredA.map(c => c.validity * c.usefulness))
  scoreB = sum(scoredB.map(c => c.validity * c.usefulness))

  winner = "tie"
  if abs(scoreA - scoreB) > NOVELTY_TIE_EPSILON:
    winner = scoreA > scoreB ? "A" : "B"   # "A" here already means arm_a —
                                            # no position mapping needed,
                                            # scoreA/scoreB were computed
                                            # directly from arm_a/arm_b's
                                            # own unique claims

  row = {
    product, arm_a, arm_b,
    dimension: dimName,
    judge_model: judgeBackend.name,
    position_swapped: false,
    winner: winner,
    justification: summarizeNoveltyVerdict(scoreA, scoreB, scoredA, scoredB),
    unique_claims: { arm_a: scoredA, arm_b: scoredB },
  }
  persist("eval_judgments", row)
  return row
```

`unique_claims` is the one field this dimension populates that the standard
dimensions leave `null`, matching the column comment in
`pending_eval_judgments.sql`.

## 7. Open dependencies on sibling docs

- Exact `generate-teardown` response keys for `extractText("scry", ...)` —
  `run-eval.mjs` never unpacks `raw_output`, so this needs a look at a real
  payload before implementation.
- A claim-equivalence judge prompt for `dedupeClaimsAcrossOutputs` — not
  currently exported by `judge-prompts.mjs`.
- Whether an aggregate-verdict row/table is worth adding to the
  `eval_judgments` schema (§4.1) — a call for the migration doc, not this one.
