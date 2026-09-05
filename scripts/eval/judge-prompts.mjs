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

// Added 2026-09-04, alongside the length-bias fix requested for this
// rubric. Verbosity/length bias is a documented, separate failure mode from
// formatting bias in LLM-as-judge research: judges (like people) tend to
// rate longer answers as more thorough even when the extra length is
// padding, restatement, or hedging rather than additional substance. The
// arms being compared here differ systematically in length for reasons
// unrelated to quality (tool-augmented arms tend to run longer), so this is
// named and warned against explicitly, the same way formatting bias is.
const LENGTH_BIAS_WARNING = `Ignore the length of each output entirely when judging quality. A longer output is not more thorough by virtue of being longer — it may simply restate the same point multiple ways, hedge, or include padding. A shorter output that makes its point once, precisely, should not be penalized relative to a longer one that makes the same point three times. Judge only the density and quality of actual substance, not the word count it took to deliver it.`;

const JSON_ONLY_INSTRUCTION = `Respond with ONLY a single valid JSON object and nothing else — no prose before or after it, no markdown code fences.`;

// 1. Framework application: does the output actually reason through a named
// framework to a specific conclusion, or just name-drop it?
//
// groundingContext (added 2026-09-04): a short block reporting each output's
// already-computed citation-verification results (see
// run-judgments.mjs's fetchCitationSummary / citationContextLine), so the
// judge can check whether a framework-derived conclusion is actually tied
// to real evidence rather than trusting the text's own citation formatting
// or the judge's sense of how rigorous the reasoning "feels."
export function frameworkApplicationPrompt(outputA, outputB, groundingContext = "") {
  return `You are evaluating two competitive-analysis outputs for the same product. Your job is to judge how well each one APPLIES named strategic/business frameworks (e.g. Porter's Five Forces, Jobs-to-be-Done, growth loops, the Bass diffusion model, wedge/platform strategy, etc.) rather than just mentioning them.

The key distinction you must make: an output that names a framework ("this looks like a classic Porter's Five Forces situation") but then states only generic or already-obvious observations is NOT applying the framework — it is name-dropping it. An output is actually applying a framework when it uses the framework's structure to derive a conclusion that is specific to this product and would not have been reached without that reasoning step — for example, walking through each of the five forces for this specific market and arriving at a non-obvious implication, or using JTBD to identify a specific underserved job that explains a specific feature or pricing choice.

${FORMATTING_BIAS_WARNING}

${LENGTH_BIAS_WARNING}

Do not reward an output merely for using more framework names than the other. A single framework applied rigorously to a real conclusion beats five frameworks that are each just namechecked.
${groundingContext ? `\nIndependent fact-checking on each output's citations already ran before this review — use it as ground truth for whether a framework-derived conclusion is actually backed by real evidence, not just confidently or fluently stated:\n${groundingContext}\n` : ""}
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
export function competitivePositioningPrompt(outputA, outputB, groundingContext = "") {
  return `You are evaluating two competitive-analysis outputs for the same product. Your job is to judge the DEPTH of competitive positioning analysis in each.

The key distinction you must make: a shallow output lists feature differences between competitors ("Competitor X has feature Y, this product doesn't"). A deep output goes further — it identifies market segmentation (who each competitor is actually building for), contrasts business models (how each makes money, what that implies about incentives), and explains WHY the strategic bets differ, not just THAT they differ. For example, explaining that a competitor under-invests in a feature because their business model depends on a different segment or a different monetization lever is deep positioning; simply noting the feature gap is not.

${FORMATTING_BIAS_WARNING}

${LENGTH_BIAS_WARNING}

Do not reward an output for listing more competitors or more features. Reward it for explaining the strategic logic behind competitive differences.
${groundingContext ? `\nIndependent fact-checking on each output's citations already ran before this review — use it as ground truth for whether a positioning claim is actually backed by real evidence, not just confidently or fluently stated:\n${groundingContext}\n` : ""}
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

// 3a. Grounded insight value, step 1: claim extraction. Deliberately a
// separate pass from scoring — combining extraction and scoring in one
// prompt tends to produce shallower results (the model conflates "spotting
// a claim" with "judging it" and shortcuts both).
//
// Renamed from "insight novelty" 2026-09-04. Novelty (is this claim unique
// across outputs, via claimEquivalencePrompt below) is only step 1 of what
// this dimension measures — the more important, and previously missing,
// part is whether a unique claim is actually TRUE, not just unique and
// confidently stated. "Novelty" undersold that; "grounded insight value" is
// the actual construct: unique + verified + useful.
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

// 3b. Grounded insight value, step 2: usefulness scoring.
//
// Redesigned 2026-09-04. This used to also ask the judge to rate "validity"
// — "how likely is this claim to be actually true, based on what a
// knowledgeable practitioner would believe." That instruction is the exact
// shape of the problem it was supposed to catch: a well-written hallucination
// is, by construction, a claim a knowledgeable practitioner would find
// believable. It cannot distinguish a true claim from a confident, plausible,
// false one — that's what makes a hallucination good at being one.
//
// Validity is no longer asked of the judge at all. It's computed
// programmatically by run-judgments.mjs's classifyGroundedness() before this
// prompt ever runs: checked against the real archive first (lib/archive-
// lookup.mjs — the same lookup citation-verification uses), then against
// live web search (lib/web-fact-check.mjs) if the archive has nothing. Only
// "usefulness" — an inherently judgment-based question even once you know a
// claim is true — is left for the judge here. Called for every unique claim,
// grounded or not: an ungrounded claim's usefulness is still needed, because
// run-judgments.mjs weights its penalty by how convincing/costly the
// fabrication would have been if believed, not just that it was fabricated.
export function claimUsefulnessPrompt(claims, productContext) {
  const claimsList = claims.map((c, i) => `${i + 1}. ${c}`).join("\n");
  return `You are rating a list of strategic claims about a product${productContext ? ` (${productContext})` : ""}. Do not judge whether each claim is true — that has already been checked separately. Rate only how useful each claim would be to a practitioner IF it is true.

usefulness (1-5): if this claim is true, how useful would it be to a practitioner making a strategic decision about this product? 1 = trivial or already obvious to anyone familiar with the product, 3 = a reasonable point worth knowing, 5 = a genuinely novel, decision-relevant insight that changes how you'd think about the product's strategy.

${FORMATTING_BIAS_WARNING} ${LENGTH_BIAS_WARNING} You are scoring the claim's content only — a claim stated as a plain sentence should be scored identically to the same claim stated as a bolded bullet point, and a longer-winded claim is not more useful than a terse one making the same point.

Claims to rate:
${claimsList}

${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "claims": [
    { "claim": "<the claim text>", "usefulness": <1-5> },
    ...
  ]
}

Return one entry per input claim, in the same order, with the exact claim text repeated back.`;
}

// 4. Coherence and actionability: organized, non-redundant, specific enough
// to act on, versus generic filler.
export function coherenceActionabilityPrompt(outputA, outputB, groundingContext = "") {
  return `You are evaluating two competitive-analysis outputs for the same product. Your job is to judge coherence and actionability: is the output organized, non-redundant, and specific enough that a practitioner could actually act on it — versus being generic filler that sounds analytical but doesn't say anything a practitioner could use?

Judge each output on:
- Organization: does the analysis build logically, or does it jump between unrelated points?
- Non-redundancy: does it avoid restating the same observation in different words across sections?
- Specificity / actionability: are the conclusions concrete enough that a reader could take a specific next action or make a specific decision from them, versus being generic statements that could apply to almost any product in the category (e.g. "should focus on user experience" or "could improve retention through better onboarding" with no specifics)?

${FORMATTING_BIAS_WARNING} A heavily bulleted output is not automatically better organized than a prose output, and a prose output is not automatically more coherent than a bulleted one — judge the underlying logical structure and specificity of the content, not its visual presentation.

${LENGTH_BIAS_WARNING} A longer output is not automatically less redundant or more organized — restating a point across more sentences is redundancy, not thoroughness.
${groundingContext ? `\nIndependent fact-checking on each output's citations already ran before this review — use it as ground truth for whether a claim is actually backed by real evidence, not just confidently or fluently stated:\n${groundingContext}\n` : ""}
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

// 5. Claim equivalence: the dedupe step `orchestration-design.md` calls
// `dedupeClaimsAcrossOutputs` — closes the gap flagged there ("this likely
// needs its own judge-backed equivalence prompt; judge-prompts.mjs doesn't
// currently export one"). Takes the two independent claim-extraction results
// (claimExtractionPrompt run once per output) and decides which claims are
// "the same point" made two different ways versus genuinely distinct, so
// grounded_insight_value (see claimUsefulnessPrompt above) scores only
// what's actually unique to each side.
export function claimEquivalencePrompt(claimsA, claimsB) {
  const listA = claimsA.map((c, i) => `A${i + 1}. ${c}`).join("\n");
  const listB = claimsB.map((c, i) => `B${i + 1}. ${c}`).join("\n");
  return `You are comparing two independently-extracted lists of strategic claims about the same product, from two different competitive-analysis outputs. Your job is to decide which claims are equivalent — the same underlying point, regardless of phrasing — versus genuinely distinct.

Two claims are equivalent if they assert the same substantive point about the product, its market, its competitors, or its strategy, even if worded completely differently, at different specificity, or supported by different evidence. Two claims are NOT equivalent merely because they're about the same general topic — "pricing is usage-based" and "pricing risks alienating budget-conscious customers" are both about pricing but assert different things, so they are distinct claims, not equivalent ones. Judge substance, not topic overlap.

${FORMATTING_BIAS_WARNING}

Claims from Output A:
${listA}

Claims from Output B:
${listB}

Identify every equivalent pair across the two lists, then determine which claims from each list have no equivalent on the other side — those are the claims genuinely unique to that output. ${JSON_ONLY_INSTRUCTION}

The JSON object must have exactly these fields:
{
  "unique_to_a": ["<exact claim text from Output A's list, repeated verbatim, for every A claim with no equivalent in B>"],
  "unique_to_b": ["<exact claim text from Output B's list, repeated verbatim, for every B claim with no equivalent in A>"]
}

If every claim on one side has an equivalent on the other, return an empty array for that side. Repeat claim text exactly as given — do not paraphrase, summarize, or renumber it — so the caller can match it back to the original list by string equality.`;
}
