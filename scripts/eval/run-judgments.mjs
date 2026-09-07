// Implements orchestration-design.md end to end: pulls the latest eval_runs
// row per (product, arm), sanitizes/anonymizes both outputs, runs every
// judge dimension from judge-prompts.mjs through every configured judge
// backend, and writes eval_judgments rows.
//
// Scope: judges scry against each baseline arm (scry vs claude_vanilla,
// scry vs claude_web) — the eval's core question is whether the corpus
// adds value over an unaided/web-search model, not how claude_vanilla and
// claude_web compare to each other. Add that pair here later if it becomes
// a real question worth answering.
//
// Judge backends: Claude and Gemini per orchestration-design.md §2. Each
// backend call is wrapped so a single failure (e.g. Gemini billing still
// unresolved) logs and is skipped rather than aborting the run — a re-run
// later naturally backfills only what's missing, via the same idempotency
// check the design doc specifies (§5).
//
// Known deviation from a "no model grades its own homework" ideal: the
// Claude judge backend (lib/claude-judge.mjs) uses the same model family as
// the claude_vanilla/claude_web arms it scores. Once Gemini is actually
// producing results, cross-checking agreement between the two judges is the
// mitigation for this — a Claude-only verdict on scry-vs-claude_vanilla/web
// should be read as provisional until Gemini's independent verdict exists.
//
// Dimension rename (2026-09-04): "insight_novelty" is now
// "grounded_insight_value" — see judge-prompts.mjs's claimUsefulnessPrompt
// header for why. Validity is no longer judge-guessed; it's computed here
// via classifyGroundedness() against the real archive first, then a live
// web fact-check. Ungrounded-but-confident claims are penalized, not just
// excluded — per explicit instruction (2026-09-04), a fabricated "insight"
// is worse than no insight, not neutral.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { createClaudeBackend } from "./lib/claude-judge.mjs";
import { createGeminiBackend } from "./lib/gemini.mjs";
import { archiveLookup } from "./lib/archive-lookup.mjs";
import { factCheckClaims } from "./lib/web-fact-check.mjs";
import { BudgetExceededError, currentSpend } from "./lib/budget.mjs";
import {
  frameworkApplicationPrompt,
  competitivePositioningPrompt,
  coherenceActionabilityPrompt,
  claimExtractionPrompt,
  claimEquivalencePrompt,
  claimUsefulnessPrompt,
} from "./judge-prompts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env.local") });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRODUCTS = process.env.EVAL_SMOKE_TEST
  ? ["Figma"]
  : [
      "Figma", "Notion", "Slack", "Linear", "Duolingo",
      "Loom", "Calendly", "Webflow",
      "Nuvo", "Arena Physica", "Resolve AI", "AirOps",
    ];

const ARM_PAIRS = [
  ["scry", "claude_vanilla"],
  ["scry", "claude_web"],
];

const STANDARD_DIMENSIONS = [
  { name: "framework_application", promptFn: frameworkApplicationPrompt },
  { name: "competitive_positioning", promptFn: competitivePositioningPrompt },
  { name: "coherence_actionability", promptFn: coherenceActionabilityPrompt },
];

// Sum-of-(validity*usefulness) / penalty scores are small integers; a gap
// this small is noise, not a real signal, at least until real score
// distributions justify a different cutoff.
const NOVELTY_TIE_EPSILON = 2;

// A confident, ungrounded claim costs more than a real one is worth — per
// explicit instruction (2026-09-04: "a nice sounding hallucination is super
// bad"). 3x is a starting heuristic, not a validated weight; tune once real
// score distributions exist across a full batch.
const NOVELTY_PENALTY_WEIGHT = 3;

// Finding B (2026-09-06): factCheckClaims is good at corroborating discrete
// facts but structurally can't "corroborate" a higher-level strategic
// interpretation/synthesis claim — live search just won't turn up conclusive
// evidence either way for something like "Loom inverted typical PLG
// mechanics." Before this fix, that "no evidence found" case was classified
// identically (tier "ungrounded", full NOVELTY_PENALTY_WEIGHT penalty) to a
// claim that was actively web_contradicted — i.e. evidence was found proving
// it false. Those are very different severities: "we couldn't verify this
// either way" should cost much less than "this is actually false." Only
// web_contradicted keeps the full penalty; every other ungrounded tier
// (ungrounded/no_evidence, unverifiable) uses this much lighter weight.
const NOVELTY_PENALTY_WEIGHT_NO_EVIDENCE = 1;

// Hard cap on claims considered per side, enforced here in code — never
// trust judge-prompts.mjs's MAX_CLAIMS instruction alone as the only limit.
// One real output produced 147 "distinct claims" with no cap anywhere
// (2026-09-05 incident — every ungrounded claim triggered its own live
// web-search API call, and this run's claim counts alone made that
// unbounded; see docs/scry-eval-status.md). Must match judge-prompts.mjs's
// MAX_CLAIMS.
const MAX_CLAIMS = 20;

// ---- pre-judge sanitization (orchestration-design.md §3) ----

function extractText(arm, rawOutput) {
  if (arm === "scry") {
    // Confirmed against supabase/functions/generate-teardown/index.ts
    // directly (2026-08-30) — generate mode returns exactly these keys.
    // product_url and _eval_debug are excluded: the former is a bare URL,
    // not prose, and the latter (never present here since eval_runs already
    // splits it into debug_metadata) is instrumentation either way.
    const sectionKeys = "overall_assessment" in rawOutput
      ? ["overall_assessment", "strengths", "gaps_and_blind_spots", "framework_alignment", "suggested_improvements", "lennys_lens"]
      : ["product_overview", "strategy_and_positioning", "feature_breakdown", "growth_model", "design_analysis", "key_insights", "lennys_lens"];
    return sectionKeys.map((k) => rawOutput[k]).filter(Boolean).join("\n\n");
  }
  // claude_vanilla / claude_web: raw Anthropic Messages API envelope —
  // concatenate only text blocks, skip tool_use/tool_result/thinking (their
  // presence alone would identify claude_web as an arm).
  return (rawOutput.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

function stripArtifacts(text) {
  return text
    .replace(/^#+\s*(Lenny'?s Lens|GTM (&|and) Growth Loops?)\s*$/gim, "")
    .replace(/^.*Generated by Scry.*$/gim, "")
    .replace(/^\s*As (Claude|Anthropic'?s assistant).*$/gim, "")
    .trim();
}

function sanitizeOutput(run) {
  return stripArtifacts(extractText(run.arm, run.raw_output));
}

// ---- judge call plumbing ----

function parseJudgeJSON(raw) {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(stripped);
  } catch (e) {
    throw new Error(`Judge did not return valid JSON: ${e.message}\nRaw (truncated): ${stripped.slice(0, 500)}`);
  }
}

async function callJudgeJSON(backend, promptText) {
  const raw = await backend.complete(promptText);
  return parseJudgeJSON(raw);
}

function normalizeWinner(rawWinner, positionSwapped) {
  if (rawWinner === "tie") return "tie";
  if (!positionSwapped) return rawWinner;
  return rawWinner === "A" ? "B" : "A";
}

// ---- citation grounding context, passed into the standard dimensions so
// the judge checks framework/positioning/coherence claims against ground
// truth we already computed, instead of trusting the text's own citation
// formatting or its own sense of how rigorous the reasoning "feels" ----

async function fetchCitationSummary(evalRunId) {
  const { data, error } = await supabase
    .from("eval_citations")
    .select("verification_status")
    .eq("eval_run_id", evalRunId);
  if (error) throw error;
  const summary = { total: data.length, verified: 0, fabricated: 0, misattributed: 0 };
  for (const row of data) {
    if (row.verification_status === "verified-verbatim" || row.verification_status === "verified-paraphrase") summary.verified++;
    else if (row.verification_status === "fabricated") summary.fabricated++;
    else if (row.verification_status === "misattributed") summary.misattributed++;
  }
  return summary;
}

function citationContextLine(label, summary) {
  if (!summary || summary.total === 0) return `${label}: no citations were extracted from this output.`;
  return `${label}: ${summary.total} citations in this output were independently fact-checked before this review — ${summary.verified} verified as real and correctly attributed, ${summary.fabricated} fabricated (no real source found), ${summary.misattributed} misattributed (real content, wrong speaker/source claimed).`;
}

// ---- idempotency (orchestration-design.md §5) ----

const judgedCache = new Set();
const cacheKey = (product, arm_a, arm_b, dimension, judgeModel, positionSwapped) =>
  `${product}::${arm_a}::${arm_b}::${dimension}::${judgeModel}::${positionSwapped}`;

async function alreadyJudged(product, arm_a, arm_b, dimension, judgeModel, positionSwapped) {
  const key = cacheKey(product, arm_a, arm_b, dimension, judgeModel, positionSwapped);
  if (judgedCache.has(key)) return true;
  const { data, error } = await supabase
    .from("eval_judgments")
    .select("id")
    .match({ product, arm_a, arm_b, dimension, judge_model: judgeModel, position_swapped: positionSwapped })
    .limit(1);
  if (error) throw error;
  if (data.length > 0) {
    judgedCache.add(key);
    return true;
  }
  return false;
}

async function persistJudgment(row) {
  const { error } = await supabase.from("eval_judgments").insert(row);
  if (error) throw error;
  judgedCache.add(cacheKey(row.product, row.arm_a, row.arm_b, row.dimension, row.judge_model, row.position_swapped));
}

// ---- standard (single-call) dimensions (orchestration-design.md §4) ----

async function runSinglePositionCall({ product, arm_a, arm_b, eval_run_id_a, eval_run_id_b, dim, backend, positionSwapped, promptOutputA, promptOutputB, groundingContext }) {
  if (await alreadyJudged(product, arm_a, arm_b, dim.name, backend.name, positionSwapped)) {
    console.log(`  [skip] ${dim.name} / ${backend.name} / swapped=${positionSwapped} — already judged`);
    return;
  }
  const promptText = dim.promptFn(promptOutputA, promptOutputB, groundingContext);
  const raw = await callJudgeJSON(backend, promptText);
  const winner = normalizeWinner(raw.winner, positionSwapped);
  await persistJudgment({
    product, arm_a, arm_b, eval_run_id_a, eval_run_id_b,
    dimension: dim.name, judge_model: backend.name, position_swapped: positionSwapped,
    winner, justification: raw.justification, unique_claims: null,
  });
  console.log(`  [ok]   ${dim.name} / ${backend.name} / swapped=${positionSwapped}: winner=${winner}`);
}

async function runStandardDimension(ctx, dim, textA, textB) {
  const { citationSummaryA, citationSummaryB } = ctx;
  const normalContext = `${citationContextLine("Output A", citationSummaryA)}\n${citationContextLine("Output B", citationSummaryB)}`;
  const swappedContext = `${citationContextLine("Output A", citationSummaryB)}\n${citationContextLine("Output B", citationSummaryA)}`;
  await runSinglePositionCall({ ...ctx, dim, positionSwapped: false, promptOutputA: textA, promptOutputB: textB, groundingContext: normalContext });
  await runSinglePositionCall({ ...ctx, dim, positionSwapped: true, promptOutputA: textB, promptOutputB: textA, groundingContext: swappedContext });
}

// ---- grounded_insight_value, two-step dimension (orchestration-design.md
// §6, redesigned 2026-09-04 per judge-prompts.mjs's claimUsefulnessPrompt
// header) ----

// Archive check only — free DB lookup, no API cost, safe to run per-claim.
// Returns null (not found, OR not eligible) rather than a verdict, so the
// caller knows which claims still need a live web check.
//
// Finding A (2026-09-06): the archive-grounded tiers (archive_verbatim,
// archive_paraphrase) must only ever be reachable for claims belonging to
// the `scry` arm — it's the only arm with a legitimate causal path to have
// actually used the archive. Previously this checked a claim's TEXT against
// the real archive regardless of which arm produced it, so claude_vanilla
// (zero tool access, zero archive access, pure training-knowledge output)
// got claims classified as archive-grounded whenever its stated facts —
// often about famous, extensively-documented companies — happened to also
// appear somewhere in the Lenny archive by sheer coincidence. Confirmed
// real example: on Duolingo, claude_vanilla scored 19/19 claims "grounded."
// That answers "is this claim's content independently true," not "did this
// arm's own retrieval actually produce this claim" — undermining the whole
// point of the eval. Claims from claude_vanilla/claude_web now skip the
// archive lookup entirely for grounding-tier purposes and can only ever be
// graded web_corroborated (via the live fact-check) or ungrounded.
async function classifyArchiveGroundedness(claimText, arm) {
  if (arm !== "scry") return null;
  const archiveResults = await archiveLookup({ claim_text: claimText, claimed_speaker: null });
  if (archiveResults.length === 0) return null;
  const top = archiveResults[0];
  if (top.match_type === "exact") {
    return { grounded: true, tier: "archive_verbatim", validity: 5, evidence: top.episode_or_source_ref };
  }
  return { grounded: true, tier: "archive_paraphrase", validity: 3, evidence: top.episode_or_source_ref };
}

function classifyWebVerdict(verdict) {
  if (verdict.status === "corroborated") {
    return { grounded: true, tier: "web_corroborated", validity: 4, evidence: verdict.evidence };
  }
  return { grounded: false, tier: verdict.status === "contradicted" ? "web_contradicted" : "ungrounded", validity: 0, evidence: verdict.evidence };
}

// Rewritten 2026-09-05: previously called classifyGroundedness (and
// therefore factCheckClaim) once per claim in a loop — with claim counts
// unbounded, that meant up to 100+ individual live web-search API calls for
// a single output. Now: hard-caps to MAX_CLAIMS first, resolves every claim
// against the free archive lookup, then makes AT MOST ONE batched
// factCheckClaims call covering every claim the archive didn't cover — not
// one call per claim.
async function scoreClaimSet(claims, product, backend, arm) {
  const capped = claims.slice(0, MAX_CLAIMS);
  const graded = new Array(capped.length);
  const needsWebCheck = [];

  for (let i = 0; i < capped.length; i++) {
    const archiveResult = await classifyArchiveGroundedness(capped[i], arm);
    if (archiveResult) {
      graded[i] = { claim: capped[i], ...archiveResult };
    } else {
      needsWebCheck.push({ index: i, claim: capped[i] });
    }
  }

  if (needsWebCheck.length > 0) {
    try {
      const raw = await factCheckClaims(needsWebCheck.map((c) => c.claim), product);
      const parsed = parseJudgeJSON(raw);
      const byClaim = new Map((parsed.results ?? []).map((r) => [r.claim, r]));
      for (const { index, claim } of needsWebCheck) {
        const verdict = byClaim.get(claim);
        graded[index] = verdict
          ? { claim, ...classifyWebVerdict(verdict) }
          : { claim, grounded: false, tier: "unverifiable", validity: 0, evidence: "fact-check response missing this claim" };
      }
    } catch (e) {
      // The batched fact-check call itself failed — treat every claim that
      // needed it as unverifiable rather than crashing the whole dimension.
      for (const { index, claim } of needsWebCheck) {
        graded[index] = { claim, grounded: false, tier: "unverifiable", validity: 0, evidence: `fact-check failed: ${e.message}` };
      }
    }
  }

  if (graded.length === 0) return graded;
  const scored = (await callJudgeJSON(backend, claimUsefulnessPrompt(graded.map((g) => g.claim), product))).claims ?? [];
  for (let i = 0; i < graded.length; i++) {
    graded[i].usefulness = scored[i]?.usefulness ?? 0;
  }
  return graded;
}

function reduceClaimScore(graded) {
  let score = 0;
  for (const g of graded) {
    if (g.grounded) {
      score += g.validity * g.usefulness;
    } else {
      // Finding B: only an actively web_contradicted claim (real evidence
      // found it's false) gets the full penalty. Every other ungrounded
      // tier — ungrounded/no_evidence, unverifiable — means "no conclusive
      // evidence either way," which is a much lighter offense and gets the
      // lighter weight.
      const weight = g.tier === "web_contradicted" ? NOVELTY_PENALTY_WEIGHT : NOVELTY_PENALTY_WEIGHT_NO_EVIDENCE;
      score -= g.usefulness * weight;
    }
  }
  return score;
}

async function runGroundedInsightValueDimension(ctx, textA, textB) {
  const { product, arm_a, arm_b, eval_run_id_a, eval_run_id_b, backend } = ctx;
  const dimName = "grounded_insight_value";
  if (await alreadyJudged(product, arm_a, arm_b, dimName, backend.name, false)) {
    console.log(`  [skip] ${dimName} / ${backend.name} — already judged`);
    return;
  }

  // Hard-capped here too, not just inside scoreClaimSet — an uncapped
  // claims array would still make claimEquivalencePrompt's comparison call
  // itself needlessly large and expensive before grounding even starts.
  const claimsA = ((await callJudgeJSON(backend, claimExtractionPrompt(textA))).claims ?? []).slice(0, MAX_CLAIMS);
  const claimsB = ((await callJudgeJSON(backend, claimExtractionPrompt(textB))).claims ?? []).slice(0, MAX_CLAIMS);

  let uniqueToA = claimsA;
  let uniqueToB = claimsB;
  if (claimsA.length > 0 && claimsB.length > 0) {
    const equiv = await callJudgeJSON(backend, claimEquivalencePrompt(claimsA, claimsB));
    uniqueToA = equiv.unique_to_a ?? [];
    uniqueToB = equiv.unique_to_b ?? [];
  }

  const gradedA = await scoreClaimSet(uniqueToA, product, backend, arm_a);
  const gradedB = await scoreClaimSet(uniqueToB, product, backend, arm_b);

  const scoreA = reduceClaimScore(gradedA);
  const scoreB = reduceClaimScore(gradedB);

  let winner = "tie";
  if (Math.abs(scoreA - scoreB) > NOVELTY_TIE_EPSILON) winner = scoreA > scoreB ? "A" : "B";

  const groundedCountA = gradedA.filter((g) => g.grounded).length;
  const groundedCountB = gradedB.filter((g) => g.grounded).length;

  await persistJudgment({
    product, arm_a, arm_b, eval_run_id_a, eval_run_id_b,
    dimension: dimName, judge_model: backend.name, position_swapped: false,
    winner,
    justification: `${arm_a} score ${scoreA} (${groundedCountA}/${gradedA.length} grounded), ${arm_b} score ${scoreB} (${groundedCountB}/${gradedB.length} grounded)`,
    unique_claims: { arm_a: gradedA, arm_b: gradedB },
  });
  console.log(`  [ok]   ${dimName} / ${backend.name}: winner=${winner} (${scoreA} vs ${scoreB}, grounded ${groundedCountA}/${gradedA.length} vs ${groundedCountB}/${gradedB.length})`);
}

// ---- top-level orchestration ----

async function orchestrateJudgments(runA, runB, backends) {
  if (runA.product !== runB.product) throw new Error("product mismatch between runA/runB");
  if (runA.arm === runB.arm) throw new Error("runA/runB have the same arm — nothing to compare");

  // Canonicalize order so (scry, claude_vanilla) is never recorded both as
  // itself and as (claude_vanilla, scry) across separate invocations.
  const [canonicalRun, otherRun] = [runA, runB].sort((x, y) => x.arm.localeCompare(y.arm));
  const product = canonicalRun.product;
  const arm_a = canonicalRun.arm;
  const arm_b = otherRun.arm;
  const eval_run_id_a = canonicalRun.id;
  const eval_run_id_b = otherRun.id;

  const textA = sanitizeOutput(canonicalRun);
  const textB = sanitizeOutput(otherRun);

  const [citationSummaryA, citationSummaryB] = await Promise.all([
    fetchCitationSummary(eval_run_id_a),
    fetchCitationSummary(eval_run_id_b),
  ]);

  for (const backend of backends) {
    console.log(`\n${product}: ${arm_a} vs ${arm_b} — judge=${backend.name}`);
    const ctx = { product, arm_a, arm_b, eval_run_id_a, eval_run_id_b, backend, citationSummaryA, citationSummaryB };
    for (const dim of STANDARD_DIMENSIONS) {
      try {
        await runStandardDimension(ctx, dim, textA, textB);
      } catch (e) {
        // A budget overrun must stop the whole run, not just this one
        // dimension — re-throw past the ordinary per-dimension catch below
        // so it propagates all the way to main() and kills the process.
        if (e instanceof BudgetExceededError) throw e;
        console.error(`  [fail] ${dim.name} / ${backend.name}: ${e.message}`);
      }
    }
    try {
      await runGroundedInsightValueDimension(ctx, textA, textB);
    } catch (e) {
      if (e instanceof BudgetExceededError) throw e;
      console.error(`  [fail] grounded_insight_value / ${backend.name}: ${e.message}`);
    }
  }
}

async function fetchLatestRuns(products) {
  const { data: runs, error } = await supabase
    .from("eval_runs")
    .select("id, product, arm, raw_output, created_at")
    .in("product", products)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latest = new Map(); // "product::arm" -> run
  for (const run of runs) {
    const key = `${run.product}::${run.arm}`;
    if (!latest.has(key)) latest.set(key, run);
  }
  return latest;
}

function logSpend() {
  const s = currentSpend();
  console.log(`\n[budget] estimated spend: $${s.spentUsd.toFixed(2)} of $${s.budgetUsd.toFixed(2)} ceiling (claude: $${s.perVendor.claude.toFixed(2)}, gemini: $${s.perVendor.gemini.toFixed(2)}) across ${s.callCount} API calls.`);
}

async function main() {
  const backends = [createClaudeBackend()];
  if (process.env.GEMINI_API_KEY) {
    backends.push(createGeminiBackend());
  } else {
    console.warn("GEMINI_API_KEY not set — running Claude-only. This is a single-judge-family result; flag it in the writeup.");
  }

  const latest = await fetchLatestRuns(PRODUCTS);

  for (const product of PRODUCTS) {
    for (const [armX, armY] of ARM_PAIRS) {
      const runA = latest.get(`${product}::${armX}`);
      const runB = latest.get(`${product}::${armY}`);
      if (!runA || !runB) {
        console.warn(`Skipping ${product} ${armX} vs ${armY} — missing eval_runs row(s)`);
        continue;
      }
      await orchestrateJudgments(runA, runB, backends);
    }
    console.log(`\n=== ${product} done ===`);
    logSpend();
  }

  console.log("\nDone.");
}

main().catch((err) => {
  logSpend();
  console.error(err);
  process.exit(1);
});
