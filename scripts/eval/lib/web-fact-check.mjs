// Live internet verification for grounded_insight_value claims that don't
// match anything in the Lenny archive. Reuses the exact web_search tool
// pattern run-eval.mjs's claude_web arm already uses (web_search_20250305)
// — no new API surface, just a different purpose: instead of generating an
// analysis, this asks Claude to go find out whether one specific claim
// holds up against live search results, and return a structured verdict.
//
// This exists to replace judge-model plausibility guessing (asking "would a
// knowledgeable practitioner believe this"), which structurally can't tell
// a well-written hallucination from a true claim — that's what makes it
// well-written. This checks against live evidence instead of a judge's
// prior beliefs.

const MODEL = "claude-sonnet-4-5";

function extractText(data) {
  return (data?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * factCheckClaim(claimText, product) => raw text reply (expected JSON),
 * same shape as a JudgeBackend.complete() call — caller parses it with the
 * same parseJudgeJSON used everywhere else in run-judgments.mjs.
 */
export async function factCheckClaim(claimText, product) {
  const prompt = `You are fact-checking one specific claim about ${product} using live web search. Search for evidence and determine whether the claim holds up.

Claim to check: "${claimText}"

Search the web for evidence, then respond with ONLY a single JSON object — no prose before or after it, no markdown code fences:
{
  "status": "corroborated" | "contradicted" | "no_evidence",
  "evidence": "<one sentence citing what you found, or stating that no relevant evidence was found>"
}

"corroborated" means you found real evidence supporting the claim. "contradicted" means you found evidence the claim is false or misleading. "no_evidence" means your search found nothing that confirms or denies it either way — treat absence of evidence as "no_evidence", not "corroborated."`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Web fact-check failed (${res.status}): ${JSON.stringify(data)}`);
  }
  const text = extractText(data);
  if (!text) throw new Error(`Web fact-check returned no text: ${JSON.stringify(data)}`);
  return text;
}
