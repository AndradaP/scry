// Judge prompt templates for the eval pipeline. Each function returns the
// full text of a prompt to send to a judge model (Claude and Gemini are
// both run as separate judges over the same prompts, so nothing here may
// assume a specific provider's tools/API). Consumed by a not-yet-built
// orchestration script that pairs up anonymized eval_runs outputs, calls
// each judge, and records the parsed verdicts.
//
// Anonymization contract: callers must label the two outputs "Output A" /
// "Output B" and must not leak which arm (scry / claude_vanilla /
// claude_web) produced which — these functions only ever see the raw text.

const FORMATTING_BIAS_WARNING = `Ignore formatting and markdown polish entirely when judging quality — bullet density, headers, bold text, and overall visual structure are not evidence of higher quality. The outputs you are comparing are known to differ systematically in how heavily formatted their raw text is (some arms produce heavily bulleted/headered output, others produce plain prose), and that is a presentation artifact of how each arm was generated, not a signal of better analysis. Judge only the substance of the reasoning and claims.`;

const JSON_ONLY_INSTRUCTION = `Respond with ONLY a single valid JSON object and nothing else — no prose before or after it, no markdown code fences.`;

// 1. Framework application: does the output actually reason through a named
// framework to a specific conclusion, or just name-drop it?
export function frameworkApplicationPrompt(outputA, outputB) {
  return `You are evaluating two competitive-analysis outputs for the same product. Your job is to judge how well each one APPLIES named strategic/business frameworks (e.g. Porter's Five Forces, Jobs-to-be-Done, growth loops, the Bass diffusion model, wedge/platform strategy, etc.) rather than just mentioning them.

The key distinction you must make: an output that names a framework ("this looks like a classic Porter's Five Forces situation") but then states only generic or already-obvious observations is NOT applying the framework — it is name-dropping it. An output is actually applying a framework when it uses the framework's structure to derive a conclusion that is specific to this product and would not have been reached without that reasoning step — for example, walking through each of the five forces for this specific market and arriving at a non-obvious implication, or using JTBD to identify a specific underserved job that explains a specific feature or pricing choice.

${FORMATTING_BIAS_WARNING}

Do not reward an output merely for using more framework names than the other. A single framework applied rigorously to a real conclusion beats five frameworks that are each just namechecked.

Output A:
"""
${outputA}
"""

Output B:
"""
${outputB}
"""

Compare the two outputs on framework application depth as defined above. ${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "winner": "A" | "B" | "tie",
  "justification": "<one sentence explaining the verdict, citing what was actually applied vs. merely named>"
}`;
}

// 2. Competitive positioning depth: feature-parity listing vs. segmentation
// and business-model contrast that explains WHY strategies diverge.
export function competitivePositioningPrompt(outputA, outputB) {
  return `You are evaluating two competitive-analysis outputs for the same product. Your job is to judge the DEPTH of competitive positioning analysis in each.

The key distinction you must make: a shallow output lists feature differences between competitors ("Competitor X has feature Y, this product doesn't"). A deep output goes further — it identifies market segmentation (who each competitor is actually building for), contrasts business models (how each makes money, what that implies about incentives), and explains WHY the strategic bets differ, not just THAT they differ. For example, explaining that a competitor under-invests in a feature because their business model depends on a different segment or a different monetization lever is deep positioning; simply noting the feature gap is not.

${FORMATTING_BIAS_WARNING}

Do not reward an output for listing more competitors or more features. Reward it for explaining the strategic logic behind competitive differences.

Output A:
"""
${outputA}
"""

Output B:
"""
${outputB}
"""

Compare the two outputs on competitive positioning depth as defined above. ${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "winner": "A" | "B" | "tie",
  "justification": "<one sentence explaining the verdict, referencing whether each output reached segmentation/business-model reasoning or stopped at feature listing>"
}`;
}

// 3a. Insight novelty, step 1: claim extraction. Deliberately a separate
// pass from scoring — combining extraction and scoring in one prompt tends
// to produce shallower results (the model conflates "spotting a claim" with
// "judging it" and shortcuts both).
export function claimExtractionPrompt(output) {
  return `You are extracting the distinct strategic claims made in a competitive-analysis output. A "claim" is a discrete assertion about the product, its market, its competitors, or its strategy that could in principle be true or false, or judged more or less useful — not a section header, not a formatting element, and not a restatement of a fact directly given in the prompt (e.g. the product's name or category).

Read the output below and extract every distinct strategic claim it makes. Split compound sentences into separate claims if they assert more than one thing. Do not editorialize, rate, or comment on the claims — only extract and restate each one concisely in your own words, preserving its specific content (do not generalize it into something vaguer than what was written).

${FORMATTING_BIAS_WARNING}

Output:
"""
${output}
"""

${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "claims": ["<claim 1>", "<claim 2>", "..."]
}

If the output contains no genuine strategic claims, return an empty array for "claims".`;
}

// 3b. Insight novelty, step 2: novelty scoring. Takes claims that a prior
// (non-judge) diffing step has already determined are unique to one output
// (i.e. non-overlapping with the other output's claims) and rates each for
// validity and usefulness. This does not produce a winner/justification
// verdict shape — it returns per-claim ratings instead.
export function noveltyScoringPrompt(uniqueClaims, productContext) {
  const claimsList = uniqueClaims.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return `You are rating a list of strategic claims about a product${productContext ? ` (${productContext})` : ""}. These claims have already been determined to be unique to one analysis — that is, no overlapping or equivalent claim appears in the comparison output — so your task is not to compare them against anything else. Your task is to rate each claim on its own merits, independent of how it was phrased or formatted.

Rate each claim on two 1-5 integer scales:

- validity (1-5): how likely is this claim to be actually true / well-grounded, based on what a knowledgeable practitioner would believe about this product and its market? 1 = likely false or unsupported speculation, 3 = plausible but unverified, 5 = clearly true or very well-grounded.
- usefulness (1-5): if this claim is true, how useful would it be to a practitioner making a strategic decision about this product? 1 = trivial or already obvious to anyone familiar with the product, 3 = a reasonable point worth knowing, 5 = a genuinely novel, decision-relevant insight that changes how you'd think about the product's strategy.

${FORMATTING_BIAS_WARNING} You are scoring the claim's content only — a claim stated as a plain sentence should be scored identically to the same claim stated as a bolded bullet point.

Claims to rate:
${claimsList}

${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "claims": [
    { "claim": "<the claim text>", "validity": <1-5>, "usefulness": <1-5> },
    ...
  ]
}

Return one entry per input claim, in the same order, with the exact claim text repeated back.`;
}

// 4. Coherence and actionability: organized, non-redundant, specific enough
// to act on, versus generic filler.
export function coherenceActionabilityPrompt(outputA, outputB) {
  return `You are evaluating two competitive-analysis outputs for the same product. Your job is to judge coherence and actionability: is the output organized, non-redundant, and specific enough that a practitioner could actually act on it — versus being generic filler that sounds analytical but doesn't say anything a practitioner could use?

Judge each output on:
- Organization: does the analysis build logically, or does it jump between unrelated points?
- Non-redundancy: does it avoid restating the same observation in different words across sections?
- Specificity / actionability: are the conclusions concrete enough that a reader could take a specific next action or make a specific decision from them, versus being generic statements that could apply to almost any product in the category (e.g. "should focus on user experience" or "could improve retention through better onboarding" with no specifics)?

${FORMATTING_BIAS_WARNING} A heavily bulleted output is not automatically better organized than a prose output, and a prose output is not automatically more coherent than a bulleted one — judge the underlying logical structure and specificity of the content, not its visual presentation.

Output A:
"""
${outputA}
"""

Output B:
"""
${outputB}
"""

Compare the two outputs on coherence and actionability as defined above. ${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "winner": "A" | "B" | "tie",
  "justification": "<one sentence explaining the verdict, citing specificity/organization rather than presentation>"
}`;
}
