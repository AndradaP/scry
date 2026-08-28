// Single-product teardown prompt: phrased the way a PM would actually type it.
export function singleProductPrompt(product) {
  return `give me a competitive teardown of ${product}`;
}

// Comparative two-product prompts don't fit the single-product template above,
// so they're kept in their own map, keyed by a short slug.
// TODO: fill in the exact wording of the real Slack vs Teams prompt.
export const comparativePrompts = {
  slack_vs_teams: null,
};
