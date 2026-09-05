// Section 1 of citation-verification.md, implemented. Extracts every
// citation-shaped span out of one eval_runs row's raw_output.

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

// Scry's fixed generate-mode section keys (confirmed against
// supabase/functions/generate-teardown/index.ts, 2026-08-30 — see
// orchestration-design.md §3). run-eval.mjs's runScry() hardcodes
// mode: "generate", so critique-mode keys are never seen in eval_runs today;
// kept here for completeness if that ever changes.
const GENERATE_SECTION_KEYS = [
  "product_overview", "strategy_and_positioning", "feature_breakdown",
  "growth_model", "design_analysis", "key_insights", "lennys_lens",
];
const CRITIQUE_SECTION_KEYS = [
  "overall_assessment", "strengths", "gaps_and_blind_spots",
  "framework_alignment", "suggested_improvements", "lennys_lens",
];

function findSentenceStart(text, idx) {
  // Walk backward from idx to the character after the nearest preceding
  // sentence terminator, or to the start of the string.
  const slice = text.slice(0, idx);
  const m = slice.match(/[.!?]\s+(?=[A-Z"'(]?[^.!?]*$)/);
  if (!m) return 0;
  return m.index + m[0].length;
}

function claimTextBefore(text, matchIndex) {
  const start = findSentenceStart(text, matchIndex);
  return text.slice(start, matchIndex).trim().replace(/^["'“]/, "").trim();
}

function isQuoted(claimText) {
  return /^["“].*["”]$/.test(claimText.trim());
}

// 1a. Scry — strict-grammar extraction.
function extractScrySection(sectionKey, text) {
  const records = [];
  if (sectionKey === "lennys_lens") {
    // lennys_lens is generated under a rule forbidding names/citations
    // entirely. If either pattern below matches inside it, that's itself a
    // defect (citation-format violation) — still extract it so the defect
    // is visible in aggregate, per citation-verification.md §1a.
  }

  const archiveBlock = /\(([^)]+·\s*Lenny's Archive[^)]*)\)/g;
  let m;
  while ((m = archiveBlock.exec(text)) !== null) {
    const claimText = claimTextBefore(text, m.index);
    for (const clause of m[1].split(";").map((c) => c.trim())) {
      const nameMatch = clause.match(/^([^,·]+)[,·]/);
      const roleMatch = clause.match(/,\s*([^·]+)·/);
      records.push({
        section_key: sectionKey,
        claim_text: claimText,
        claim_type: isQuoted(claimText) ? "verbatim_quote" : "paraphrase",
        claimed_source_type: "archive",
        claimed_speaker: nameMatch ? nameMatch[1].trim() : null,
        claimed_role: roleMatch ? roleMatch[1].trim() : null,
        claimed_episode_or_outlet: null,
        raw_citation_text: m[0],
      });
    }
  }

  const webBlock = new RegExp(`\\(([A-Z][^,)]*),\\s*(${MONTHS})\\s+(\\d{4})\\)`, "g");
  while ((m = webBlock.exec(text)) !== null) {
    const claimText = claimTextBefore(text, m.index);
    records.push({
      section_key: sectionKey,
      claim_text: claimText,
      claim_type: isQuoted(claimText) ? "verbatim_quote" : "paraphrase",
      claimed_source_type: "web",
      claimed_speaker: null,
      claimed_role: null,
      claimed_episode_or_outlet: m[1].trim(),
      raw_citation_text: m[0],
    });
  }

  return records;
}

function extractScry(rawOutput) {
  const hasKeys = "overall_assessment" in rawOutput ? CRITIQUE_SECTION_KEYS : GENERATE_SECTION_KEYS;
  const records = [];
  for (const key of hasKeys) {
    const value = rawOutput[key];
    if (typeof value !== "string" || !value) continue;
    records.push(...extractScrySection(key, value));
  }
  return records;
}

// 1b. Baselines — generic detector, no fixed grammar to rely on.
function extractBaselineText(rawOutput) {
  const blocks = Array.isArray(rawOutput?.content) ? rawOutput.content : [];
  return blocks
    .filter((b) => b?.type === "text")
    .map((b) => b.text ?? "")
    .join("\n\n");
}

function extractBaseline(rawOutput) {
  const text = extractBaselineText(rawOutput);
  const records = [];
  if (!text) return records;

  // Any parenthetical that's citation-shaped: (Name, ...) or (Outlet, Year).
  const parenBlock = /\(([A-Z][^()]{2,80})\)/g;
  let m;
  while ((m = parenBlock.exec(text)) !== null) {
    const inner = m[1];
    const claimText = claimTextBefore(text, m.index);
    const monthYear = inner.match(new RegExp(`^([^,]+),\\s*(${MONTHS})\\s+(\\d{4})$`));
    const nameLike = inner.match(/^([A-Z][a-zA-Z.\-]+(?:\s+[A-Z][a-zA-Z.\-]+)+)\s*,?\s*(.*)$/);
    records.push({
      section_key: "unsectioned",
      claim_text: claimText,
      claim_type: isQuoted(claimText) ? "verbatim_quote" : "paraphrase",
      claimed_source_type: monthYear ? "web" : "unknown",
      claimed_speaker: !monthYear && nameLike ? nameLike[1].trim() : null,
      claimed_role: !monthYear && nameLike ? (nameLike[2].trim() || null) : null,
      claimed_episode_or_outlet: monthYear ? monthYear[1].trim() : null,
      raw_citation_text: m[0],
    });
  }

  // Footnote markers [N].
  const footnote = /\[(\d{1,2})\]/g;
  while ((m = footnote.exec(text)) !== null) {
    records.push({
      section_key: "unsectioned",
      claim_text: claimTextBefore(text, m.index),
      claim_type: "paraphrase",
      claimed_source_type: "unknown",
      claimed_speaker: null,
      claimed_role: null,
      claimed_episode_or_outlet: null,
      raw_citation_text: m[0],
    });
  }

  return records;
}

// Public entrypoint. Returns extracted-citation records per
// citation-verification.md §1's shape (minus eval_run_id/arm/id, which the
// caller attaches — this module only knows about one row's raw_output).
export function extractCitations(arm, rawOutput) {
  if (arm === "scry") return extractScry(rawOutput);
  return extractBaseline(rawOutput);
}
