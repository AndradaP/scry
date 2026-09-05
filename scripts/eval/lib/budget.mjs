// Hard spend ceiling for the whole eval run. Built 2026-09-05 after an
// unbounded claim-extraction count (up to 147 claims from one output) +
// one-fact-check-API-call-per-ungrounded-claim, with zero cap on either,
// burned $62.27 in real Anthropic usage in a single day — with the batch
// nowhere near finished. See docs/scry-eval-status.md for the incident.
//
// This is not a warning or a log line. Every judge/fact-check call (Claude
// and Gemini both) reports its real token usage here; spend is estimated
// running, and the moment it crosses the ceiling, assertUnderBudget() throws
// a BudgetExceededError that is NOT caught by the per-dimension try/catch in
// run-judgments.mjs's orchestrateJudgments() — it's explicitly re-thrown
// there to propagate all the way to main() and kill the whole process. A
// budget overrun must stop the run outright, not get silently absorbed the
// same way an ordinary API failure does.

// Per-token USD prices. Claude Sonnet 4.5 confirmed 2026-09-04 against
// platform.claude.com/docs/en/models/sonnet-4-5/overview ($3/$15 per MTok).
// Gemini's actual model (and its paid-tier price) is discovered at runtime
// by lib/gemini.mjs, not fixed — this uses a deliberately conservative
// flat estimate (higher than a cheap Flash model's real rate) so the
// ceiling trips earlier rather than later if discovery lands on a pricier
// model than assumed. Being wrong in the direction of stopping too early is
// the safe failure mode here; being wrong the other way is what caused the
// incident this file exists to prevent.
const PRICE_PER_TOKEN_USD = {
  claude: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  gemini: { input: 1.25 / 1_000_000, output: 10 / 1_000_000 },
};

const DEFAULT_BUDGET_USD = 5;
const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? DEFAULT_BUDGET_USD);

export class BudgetExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

let spentUsd = 0;
let callCount = 0;
const perVendor = { claude: 0, gemini: 0 };

export function recordUsage(vendor, inputTokens, outputTokens) {
  const price = PRICE_PER_TOKEN_USD[vendor];
  if (!price) throw new Error(`recordUsage: unknown vendor "${vendor}"`);
  const cost = (inputTokens ?? 0) * price.input + (outputTokens ?? 0) * price.output;
  spentUsd += cost;
  perVendor[vendor] += cost;
  callCount++;
}

export function assertUnderBudget() {
  if (spentUsd >= BUDGET_USD) {
    throw new BudgetExceededError(
      `EVAL BUDGET EXCEEDED: estimated spend $${spentUsd.toFixed(2)} >= ceiling $${BUDGET_USD.toFixed(2)} ` +
      `after ${callCount} API calls (claude: $${perVendor.claude.toFixed(2)}, gemini: $${perVendor.gemini.toFixed(2)}). ` +
      `Stopping the entire run now, not skipping-and-continuing. Re-run with EVAL_BUDGET_USD=<higher number> ` +
      `only once you've deliberately decided that's the right ceiling.`
    );
  }
}

export function currentSpend() {
  return { spentUsd, callCount, budgetUsd: BUDGET_USD, perVendor: { ...perVendor } };
}
