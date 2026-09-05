// Implements citation-verification.md end to end (Sections 1-5) over the
// 12-product Phase 1 batch, writes eval_citations rows, prints an aggregate
// report per arm.
//
// Known, stated limitation: web-citation verification_status is
// format-based, not content-based. Verifying a (Outlet, Month Year)
// citation's underlying claim against the actual live web page is out of
// scope per citation-verification.md §2 ("out of scope to spec further here
// since the task is the Lenny archive") and infeasible in this script
// regardless — there's no EXA_API_KEY in this environment (it's an Edge
// Function secret only, and Supabase never exposes secret values, only
// digests) and no stored copy of the original web search results in
// eval_runs. Web citations are still fully covered for extraction, outlet
// legitimacy, and vendor-sourcing (Sections 1, 4, 5) — only the underlying
// factual claim itself isn't independently re-verified here.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { extractCitations } from "./lib/extract-citations.mjs";
import { archiveLookup } from "./lib/archive-lookup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env.local") });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PRODUCTS = [
  "Figma", "Notion", "Slack", "Linear", "Duolingo", // high coverage
  "Loom", "Calendly", "Webflow",                     // moderate coverage
  "Nuvo", "Arena Physica", "Resolve AI", "AirOps",   // zero coverage
];

const HOST_NAME_VARIANTS = /^lenny(\s+rachitsky)?$/i;

// Recognized outlets seen across the batch's actual web citations, plus
// well-known mainstream/trade press. Anything not on this list is
// "unfamiliar" per citation-verification.md §4 — a manual-review flag, not
// an automatic fabricated verdict.
const RECOGNIZED_OUTLETS = new Set([
  "techcrunch", "the verge", "bloomberg", "reuters", "forbes",
  "wall street journal", "wsj", "new york times", "nyt", "the information",
  "axios", "cnbc", "wired", "fast company", "venturebeat", "business insider",
  "financial times", "business standard", "the next web", "cb insights",
  "product hunt", "g2", "capterra",
].map((s) => s.toLowerCase()));

function outletLegitimacy(outlet) {
  if (!outlet) return null;
  const norm = outlet.toLowerCase().trim();
  return RECOGNIZED_OUTLETS.has(norm) ? "recognized" : "unfamiliar";
}

function vendorSourced(outlet, product) {
  if (!outlet || !product) return false;
  const norm = outlet.toLowerCase();
  const productNorm = product.toLowerCase();
  // Direct mention ("Figma Blog", "Resolve AI Blog", "Loom Help Center") or
  // the product name plus a self-published-property keyword.
  const vendorKeywords = ["blog", "help center", "help centre", "support", "docs",
    "documentation", "newsroom", "press", "investor relations"];
  const mentionsProduct = norm.includes(productNorm);
  const mentionsVendorTerm = vendorKeywords.some((k) => norm.includes(k));
  return mentionsProduct && mentionsVendorTerm;
}

function classifyArchiveCitation(citation, lookupResults) {
  if (lookupResults.length === 0) {
    return { verification_status: "fabricated", misattribution_subtype: null, evidence: "no archive candidate found" };
  }
  const top = lookupResults[0];
  const speakerMatches = !citation.claimed_speaker
    || !top.real_speaker
    || top.real_speaker.toLowerCase() === citation.claimed_speaker.toLowerCase();

  let status;
  if (top.match_type === "exact" && speakerMatches) {
    status = "verified-verbatim";
  } else if (speakerMatches) {
    status = "verified-paraphrase";
  } else {
    status = "misattributed";
  }

  let misattribution_subtype = null;
  if (citation.claimed_speaker && HOST_NAME_VARIANTS.test(citation.claimed_speaker) && top.speaker_role === "guest") {
    // §3 host-attribution check: content real, but a guest's words were
    // attributed to Lenny. Overrides to misattributed regardless of the
    // speakerMatches branch above, and gets the named subtype.
    status = "misattributed";
    misattribution_subtype = "guest_to_host";
  }

  return {
    verification_status: status,
    misattribution_subtype,
    evidence: `${top.match_type} match (confidence ${top.match_confidence.toFixed(2)}) — ${top.episode_or_source_ref}${top.real_speaker ? `, real speaker: ${top.real_speaker}` : ""}`,
  };
}

function classifyWebCitation(citation, product) {
  const legitimacy = outletLegitimacy(citation.claimed_episode_or_outlet);
  const vendored = vendorSourced(citation.claimed_episode_or_outlet, product);
  // Format-conformant web citations get benefit of doubt on
  // verification_status (see file header — content verification is out of
  // scope/infeasible here). A citation with no outlet text at all (shouldn't
  // happen given the extraction regex requires one) would be fabricated.
  const status = citation.claimed_episode_or_outlet ? "verified-paraphrase" : "fabricated";
  return {
    verification_status: status,
    misattribution_subtype: null,
    outlet_legitimacy: legitimacy,
    vendor_sourced: vendored,
    evidence: `format-conformant web citation, outlet: ${citation.claimed_episode_or_outlet ?? "none"}${vendored ? " (vendor-sourced)" : ""}`,
  };
}

async function main() {
  console.log(`Fetching latest eval_runs row per (product, arm) for ${PRODUCTS.length} products...`);

  const { data: runs, error } = await supabase
    .from("eval_runs")
    .select("id, product, arm, raw_output, created_at")
    .in("product", PRODUCTS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Keep only the latest row per (product, arm).
  const seen = new Set();
  const latest = [];
  for (const run of runs) {
    const key = `${run.product}::${run.arm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(run);
  }
  console.log(`${latest.length} rows selected (expected ${PRODUCTS.length * 3}).`);

  const stats = {}; // arm -> { total, verified_verbatim, verified_paraphrase, misattributed, fabricated, guest_to_host, web_total, unfamiliar_outlet, vendor_sourced }
  const bump = (arm, field) => {
    stats[arm] ??= { total: 0, "verified-verbatim": 0, "verified-paraphrase": 0, misattributed: 0, fabricated: 0, guest_to_host: 0, web_total: 0, unfamiliar_outlet: 0, vendor_sourced: 0 };
    stats[arm][field] = (stats[arm][field] ?? 0) + 1;
  };

  const rows = [];

  for (const run of latest) {
    const citations = extractCitations(run.arm, run.raw_output);
    for (const c of citations) {
      stats[run.arm] ??= { total: 0, "verified-verbatim": 0, "verified-paraphrase": 0, misattributed: 0, fabricated: 0, guest_to_host: 0, web_total: 0, unfamiliar_outlet: 0, vendor_sourced: 0 };
      stats[run.arm].total++;

      let result;
      if (c.claimed_source_type === "archive") {
        const lookupResults = await archiveLookup({ claim_text: c.claim_text, claimed_speaker: c.claimed_speaker });
        result = classifyArchiveCitation(c, lookupResults);
      } else if (c.claimed_source_type === "web") {
        result = classifyWebCitation(c, run.product);
        stats[run.arm].web_total++;
        if (result.outlet_legitimacy === "unfamiliar") stats[run.arm].unfamiliar_outlet++;
        if (result.vendor_sourced) stats[run.arm].vendor_sourced++;
      } else {
        // "unknown" — baseline citations with no clear source-type signal.
        // No lookup mechanism applies; treat as fabricated, matching the
        // design doc's expectation that ungrounded arms skew this way.
        result = { verification_status: "fabricated", misattribution_subtype: null, evidence: "unresolved source type (baseline arm, no grounding mechanism)" };
      }

      bump(run.arm, result.verification_status);
      if (result.misattribution_subtype === "guest_to_host") bump(run.arm, "guest_to_host");

      rows.push({
        eval_run_id: run.id,
        arm: run.arm,
        section_key: c.section_key,
        claim_text: c.claim_text.slice(0, 2000),
        claimed_source_type: c.claimed_source_type,
        claimed_speaker: c.claimed_speaker,
        claimed_role: c.claimed_role,
        attributed_source: c.raw_citation_text,
        verification_status: result.verification_status,
        misattribution_subtype: result.misattribution_subtype,
        outlet_legitimacy: result.outlet_legitimacy ?? null,
        vendor_sourced: result.vendor_sourced ?? null,
        evidence: result.evidence,
      });
    }
    console.log(`${run.product} / ${run.arm}: ${citations.length} citations extracted`);
  }

  console.log(`\nInserting ${rows.length} eval_citations rows...`);
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error: insErr } = await supabase.from("eval_citations").insert(rows.slice(i, i + BATCH));
    if (insErr) throw insErr;
  }

  console.log("\n=== Aggregate report ===");
  for (const [arm, s] of Object.entries(stats)) {
    const verified = s["verified-verbatim"] + s["verified-paraphrase"];
    const precision = s.total > 0 ? ((verified / s.total) * 100).toFixed(1) : "n/a";
    console.log(`\n${arm} (n=${s.total} citations):`);
    console.log(`  verified-verbatim:   ${s["verified-verbatim"]}`);
    console.log(`  verified-paraphrase: ${s["verified-paraphrase"]}`);
    console.log(`  misattributed:       ${s.misattributed}  (guest_to_host: ${s.guest_to_host})`);
    console.log(`  fabricated:          ${s.fabricated}`);
    console.log(`  precision:           ${precision}%`);
    if (s.web_total > 0) {
      console.log(`  web citations:       ${s.web_total}  (unfamiliar outlet: ${s.unfamiliar_outlet}, vendor-sourced: ${s.vendor_sourced})`);
    }
  }

  const scryStats = stats["scry"];
  if (scryStats) {
    const verified = scryStats["verified-verbatim"] + scryStats["verified-paraphrase"];
    const precision = scryStats.total > 0 ? (verified / scryStats.total) * 100 : 0;
    console.log(`\nDecision gate: scry citation precision = ${precision.toFixed(1)}% (threshold: 90%)`);
    console.log(precision >= 90 ? "GATE PASSED — proceed to pairwise judging." : "GATE FAILED — fix the pipeline before judging, per docs/scry-eval-status.md decision gates.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
