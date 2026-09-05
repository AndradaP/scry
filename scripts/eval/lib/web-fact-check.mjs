// Live internet verification for grounded_insight_value claims that don't
// match anything in the Lenny archive. Reuses the exact web_search tool
// pattern run-eval.mjs's claude_web arm already uses (web_search_20250305)
// — no new API surface, just a different purpose: instead of generating an
// analysis, this asks Claude to go find out whether specific claims hold
// up against live search results, and return structured verdicts.
//
// This exists to replace judge-model plausibility guessing (asking "would a
// knowledgeable practitioner believe this"), which structurally can't tell
// a well-written hallucination from a true claim — that's what makes it
// well-written. This checks against live evidence instead of a judge's
// prior beliefs.
//
// Rewritten 2026-09-05: was one API call per ungrounded claim, in a loop,
// with no cap on how many claims could reach this stage. Combined with
// claimExtractionPrompt having no claim-count limit either (one output
// produced 147 "distinct claims"), that meant potentially 100+ individual
// live-search API calls for a single output — the direct mechanism behind
// a $62.27 same-day Anthropic bill with the batch nowhere near finished.
// Now: one call checks every ungrounded claim for a given side at once
// (claim counts are separately hard-capped at MAX_CLAIMS in
// run-judgments.mjs, so this never receives more than a small, bounded
// list regardless of what extraction returns).

import { recordUsage, assertUnderBudget } from "./budget.mjs";

const MODEL = "claude-sonnet-4-5";

function extractText(data) {
  return (data?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * factCheckClaims(claimTexts, product) => raw text reply (expected JSON),
 * same shape as a JudgeBackend.complete() call — caller parses it with the
 * same parseJudgeJSON used everywhere else in run-judgments.mjs. Checks all
 * claims in ONE call rather than one call per claim.
 */
export async function factCheckClaims(claimTexts, product) {
  assertUnderBudget();
  const claimsList = claimTexts.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const prompt = `You are fact-checking a list of specific claims about ${product} using live web search. Search for evidence on each one and determine whether it holds up.

Claims to check:
${claimsList}

Search the web for evidence on each claim, then respond with ONLY a single JSON object — no prose before or after it, no markdown code fences:
{
  "results": [
    { "claim": "<exact claim text, repeated verbatim>", "status": "corroborated" | "contradicted" | "no_evidence", "evidence": "<one sentence citing what you found, or stating none was found>" },
    ...
  ]
}

"corroborated" means you found real evidence supporting the claim. "contradicted" means you found evidence the claim is false or misleading. "no_evidence" means your search found nothing that confirms or denies it either way — treat absence of evidence as "no_evidence", not "corroborated." Return exactly one entry per input claim, in the same order, with the claim text repeated back exactly so the caller can match it by string equality.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Web fact-check failed (${res.status}): ${JSON.stringify(data)}`);
  }
  if (data.usage) recordUsage("claude", data.usage.input_tokens, data.usage.output_tokens);
  assertUnderBudget();
  const text = extractText(data);
  if (!text) throw new Error(`Web fact-check returned no text: ${JSON.stringify(data)}`);
  return text;
}
