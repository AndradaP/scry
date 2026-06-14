import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const DEV_EMAIL = "ioana.andrada.api@gmail.com";

function getTimezoneAbbr(timezone: string | undefined): string {
  if (!timezone) return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" }).formatToParts(new Date());
    return parts.find(p => p.type === "timeZoneName")?.value ?? "UTC";
  } catch {
    return "UTC";
  }
}

function getLocalDate(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getUserFromJwt(authHeader: string | null): { userId: string | null; userEmail: string | null } {
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, userEmail: null };
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return { userId: null, userEmail: null };
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { userId: payload.sub ?? null, userEmail: payload.email ?? null };
  } catch {
    return { userId: null, userEmail: null };
  }
}

const DIMENSION_SEEDS = [
  "positioning|differentiation|competitive moat",
  "feature design|usability|interaction design",
  "growth loops|go-to-market|PLG|distribution",
  "retention|habit|engagement|churn|stickiness",
  "business model|monetization|pricing|revenue model",
  "onboarding|UX|activation|aha moment|time to value",
];

async function generateSearchQueries(
  productName?: string,
): Promise<string[]> {
  const prompt = `You are preparing search queries for a product teardown of: "${productName}"

Each query targets a specific analytical dimension. For each dimension, you are given seed terms that always work. Extend each seed with 2-3 pipe-delimited terms specific to "${productName}"'s category, business model, and competitive context. Use your knowledge of the product. If the product is unfamiliar, return the seed terms unchanged.

Output ONLY a valid JSON array of exactly 6 strings, one per dimension, in this order:
1. Strategy & Positioning — seed: positioning|differentiation|competitive moat
2. Feature Breakdown — seed: feature design|usability|interaction design
3. Growth & Acquisition — seed: growth loops|go-to-market|PLG|distribution
4. Retention & Engagement — seed: retention|habit|engagement|churn|stickiness
5. Business & Revenue — seed: business model|monetization|pricing|revenue model
6. UX & Onboarding — seed: onboarding|UX|activation|aha moment|time to value

No explanation. No markdown. No preamble. Valid JSON array only.
Scry analyzes digital products only — software, apps, and SaaS. Do not generate terms related to hardware, manufacturing, supply chain, or physical products.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();
  if (!text) {
    console.error("generateSearchQueries API error:", JSON.stringify(data));
    return DIMENSION_SEEDS;
  }

  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const queries = JSON.parse(clean);
    if (Array.isArray(queries) && queries.length === 6) return queries;
  } catch {
    console.error("Failed to parse generate query list:", text);
  }

  return DIMENSION_SEEDS;
}

async function generateCritiqueContext(
  productName: string,
  userTeardown: string,
): Promise<{ scope: string; queries: string[] }> {
  const prompt = `You are analyzing a product teardown to prepare it for structured critique.
Read the full teardown text below and produce three things:

1. SUMMARY: 4-5 sentences covering what product is analyzed, which analytical angles the author took, and what appears missing or thin. Descriptive, not evaluative.

2. SCOPE: Classify as exactly one of: feature, product, company.
   - feature = specific feature or flow (e.g. onboarding, a checkout experience, a single modal)
   - product = full product or app, including core use cases, UX, and value proposition
   - company = company-level strategy, business model, competitive positioning
   Default to product if ambiguous.

3. QUERIES: Using your summary, extend each seed below with 2-3 product-specific pipe-delimited terms. Same 6 dimensions in order.
   1. Strategy & Positioning — seed: positioning|differentiation|competitive moat
   2. Feature Breakdown — seed: feature design|usability|interaction design
   3. Growth & Acquisition — seed: growth loops|go-to-market|PLG|distribution
   4. Retention & Engagement — seed: retention|habit|engagement|churn|stickiness
   5. Business & Revenue — seed: business model|monetization|pricing|revenue model
   6. UX & Onboarding — seed: onboarding|UX|activation|aha moment|time to value

Return ONLY valid JSON in this exact shape. No explanation. No markdown. No preamble.

{
  "summary": "...",
  "scope": "feature" | "product" | "company",
  "queries": ["...", "...", "...", "...", "...", "..."]
}

TEARDOWN TEXT:
${userTeardown}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim();

  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (parsed.scope && Array.isArray(parsed.queries) && parsed.queries.length === 6) {
      return { scope: parsed.scope, queries: parsed.queries };
    }
  } catch {
    console.error("Failed to parse critique context:", text);
  }

  return { scope: "product", queries: DIMENSION_SEEDS };
}


async function searchLennyData(query: string, limit = 5, contentType = ""): Promise<string> {
  const token = Deno.env.get("LENNYSDATA_TOKEN") ?? "";

  const response = await fetch("https://mcp.lennysdata.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: "search_content",
        arguments: { query, limit, content_type: contentType },
      },
    }),
  });

  console.log(`LennyData [${query}] status:`, response.status);

  const text = await response.text();

  const dataLines = text
    .split("\n")
    .filter(line => line.startsWith("data: "))
    .map(line => line.slice(6).trim())
    .filter(line => line && line !== "[DONE]");

  if (!dataLines.length) return "";

  for (const line of dataLines) {
    try {
      const parsed = JSON.parse(line);
      const results = parsed?.result?.content?.[0]?.text;
      if (!results) continue;

      const searchResults = JSON.parse(results);
      if (!searchResults.results?.length) {
        console.log(`LennyData [${query}]: 0 results`);
        continue;
      }

      console.log(`LennyData [${query}]: ${searchResults.results.length} results`);

      return searchResults.results.map((r: {
        title: string;
        type: string;
        date: string;
        snippet: string;
        snippets?: { text: string }[];
      }) => {
        const excerpts = r.snippets?.map((s) => s.text).join("\n") ?? r.snippet;
        return `SOURCE: ${r.title} (${r.type}, ${r.date})\n${excerpts}`;
      }).join("\n\n---\n\n");
    } catch {
      continue;
    }
  }

  return "";
}

function isVerifiedInCorpus(name: string, corpus: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const speakerPattern = new RegExp(`\\*\\*${escaped}\\*\\*\\s*\\(\\d`, "i");
  const sourceTitlePattern = new RegExp(`^SOURCE:.*${escaped}`, "im");
  return speakerPattern.test(corpus) || sourceTitlePattern.test(corpus);
}

function verifyArchiveCitations(text: string, corpus: string): string {
  const blockRegex = /\(([^)]+·\s*Lenny's Archive[^)]*)\)/g;
  let result = text;
  const blocks: Array<{ full: string; inner: string }> = [];
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    blocks.push({ full: match[0], inner: match[1] });
  }

  const strippedNames: string[] = [];

  for (const { full, inner } of blocks) {
    const parts = inner.split(";").map(p => p.trim());
    const verified: string[] = [];

    for (const part of parts) {
      // Extract name: before comma if present, otherwise before the · marker
      const nameMatch = part.match(/^([^,·]+)[,·]/);
      if (!nameMatch) {
        console.log(`Stripping malformed citation: ${part.trim()}`);
        continue;
      }
      const name = nameMatch[1].trim();
      if (isVerifiedInCorpus(name, corpus)) {
        verified.push(part);
      } else {
        strippedNames.push(name);
        console.log(`Stripping unverified citation: ${part.trim()}`);
      }
    }

    if (verified.length === 0) {
      result = result.replace(new RegExp("\\s*" + full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
    } else if (verified.length < parts.length) {
      result = result.replace(full, `(${verified.join("; ")})`);
    }
  }

  // Replace orphaned stripped names in prose with "the team"
  for (const name of strippedNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}'s\\b`, "gi"), "the team's");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "the team");
  }

  return result.trim();
}

function verifyTrainingKnowledgeCitations(text: string): string {
  // Strip (Name, Role) citations that are neither archive badges nor valid web citations.
  // Matches: two+ capitalized words followed by comma and non-month-year content.
  const suspectRegex = /\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),\s*([^)]+)\)/g;
  const monthYearPattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;
  const yearOnlyPattern = /^\d{4}/;

  let result = text;
  const toStrip: string[] = [];
  let match;

  while ((match = suspectRegex.exec(text)) !== null) {
    const full = match[0];
    const secondPart = match[2].trim();
    if (full.includes("Lenny's Archive")) continue;
    if (monthYearPattern.test(secondPart)) continue;
    if (yearOnlyPattern.test(secondPart)) continue;
    console.log(`Stripping training-knowledge citation: ${full}`);
    toStrip.push(full);
  }

  for (const citation of toStrip) {
    result = result.replace(new RegExp("\\s*" + citation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "");
  }

  return result;
}

function stripBareArchiveCitations(text: string): string {
  // Strip (Lenny's Archive, year) or (Lenny's Archive · anything) with no person name
  return text.replace(/\s*\(Lenny's Archive[^)]*\)/g, (match) => {
    // Keep it only if it contains a · preceded by a name (handled by verifyArchiveCitations)
    if (/·/.test(match)) return match;
    console.log(`Stripping bare archive citation: ${match.trim()}`);
    return "";
  });
}

function verifyParsedCitations(parsed: Record<string, unknown>, corpus: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      let v = verifyArchiveCitations(value, corpus);
      v = verifyTrainingKnowledgeCitations(v);
      v = stripBareArchiveCitations(v);
      result[key] = v;
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function generateLennysLens(
  productName: string,
  mode: string,
  lennyCorpus: string,
  teardownContext: string,
): Promise<string> {
  const context = mode === "critique"
    ? `a critique of a product teardown for ${productName}`
    : `a product teardown of ${productName}`;

  const corpusBlock = lennyCorpus.length > 0
    ? `LENNY'S ARCHIVE:\n${lennyCorpus}`
    : `LENNY'S ARCHIVE:\nNo relevant archive content found.`;

  const prompt = `You are writing the "Lenny's Lens" section for ${context}.

This section applies Lenny Rachitsky's perspective specifically to this product's situation. Use the archive excerpts and the product analysis below as your source material.

PRODUCT ANALYSIS:
${teardownContext}

${corpusBlock}

RULES:
- Do not include a title, heading, or label of any kind. The very first character of your response must be the start of the content itself. If your response begins with #, *, or any markdown syntax, that is a violation — start directly with a word.
- Do not mention any person by name — no guest names, no expert names, no one. Do not use inline citations of any kind.
- Do not draw comparisons to other companies by name. The section is about ${productName} specifically, not about what Atlassian or HubSpot or anyone else did.
- Ground every observation in something visible in the archive or the product analysis above. Do not import outside knowledge.
- Be specific about ${productName}'s situation — generic product wisdom that applies to any company is not acceptable.
- 3-5 sentences. No em dashes. No sycophancy. No AI filler phrases. Write with conviction.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (!data?.content?.[0]?.text) {
    console.error("Lenny's Lens API error:", JSON.stringify(data));
    return "";
  }
  return data.content[0].text.trim();
}

async function callMainModel(systemPrompt: string, userMessage: string): Promise<Record<string, unknown>> {
  const mainResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 3500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  }).then(r => r.json());

  const text = mainResponse?.content?.[0]?.text;
  if (!text) {
    console.error("callMainModel API error:", JSON.stringify(mainResponse));
    throw new Error("No content in Claude response");
  }
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON parse failed, attempting salvage:", e.message);
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Failed to parse Claude response: ${e.message}`);
  }
}

async function searchWeb(query: string): Promise<{ text: string; firstUrl: string }> {
  const apiKey = Deno.env.get("EXA_API_KEY") ?? "";

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query,
      num_results: 5,
      use_autoprompt: true,
      contents: {
        text: {
          max_characters: 1000,
        },
      },
    }),
  });

  console.log(`Exa search [${query}] status:`, response.status);

  if (!response.ok) {
    console.error("Exa search failed:", await response.text());
    return { text: "", firstUrl: "" };
  }

  const data = await response.json();

  if (!data.results?.length) {
    console.log(`Exa search [${query}]: 0 results`);
    return { text: "", firstUrl: "" };
  }

  console.log(`Exa search [${query}]: ${data.results.length} results`);

  const firstUrl: string = data.results[0]?.url ?? "";
  const text = data.results.map((r: {
    title: string;
    url: string;
    publishedDate?: string;
    text?: string;
  }) => {
    const date = r.publishedDate ? ` (${r.publishedDate.slice(0, 10)})` : "";
    return `WEB SOURCE: ${r.title}${date}\nURL: ${r.url}\n${r.text ?? ""}`;
  }).join("\n\n---\n\n");

  return { text, firstUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, mode, userTeardown, chatMessages, teardownContext, teardownId, timezone } = body;

    const { userId, userEmail } = getUserFromJwt(req.headers.get("Authorization"));
    const isDevUser = userEmail === DEV_EMAIL;
    const tz = getTimezoneAbbr(typeof timezone === "string" ? timezone : undefined);
    const today = getLocalDate(typeof timezone === "string" ? timezone : "UTC");

    // ── Chat mode ────────────────────────────────────────────────────────────
    if (mode === "chat") {
      // Chat rate limit: 10 messages per teardown
      if (!isDevUser && teardownId) {
        const { data: teardownRow } = await supabase
          .from("teardowns")
          .select("chat_message_count")
          .eq("id", teardownId)
          .single();

        if ((teardownRow?.chat_message_count ?? 0) >= 10) {
          return new Response(JSON.stringify({
            error: "chat_limit_exceeded",
            message: `You've reached the 10 message limit for this teardown. Your limit resets at midnight ${tz}.`,
          }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const systemPrompt = `You are a product expert. The user has received a product teardown or critique shown below. Answer their follow-up questions using the teardown as your primary reference. Be concise, specific, and insightful. Build on the teardown rather than repeating it. No em dashes. Topic-locked to product strategy.

TEARDOWN CONTEXT:
${teardownContext}`;

      const messages = chatMessages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1500,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      });

      if (!anthropicResponse.body) {
        throw new Error("No streaming body from Anthropic");
      }

      if (teardownId) {
        await supabase.rpc("increment_chat_count", { p_teardown_id: teardownId });
      }

      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        const reader = anthropicResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
                }
              } catch { /* skip malformed */ }
            }
          }
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          console.error("Chat stream error:", e);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // ── Daily teardown rate limit ────────────────────────────────────────────
    if (userId && !isDevUser) {
      const { data: usageRow } = await supabase
        .from("usage_limits")
        .select("teardown_count")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if ((usageRow?.teardown_count ?? 0) >= 5) {
        return new Response(JSON.stringify({
          error: "daily_limit_exceeded",
          message: `You've used all 5 of your teardowns today. Your limit resets at midnight ${tz}.`,
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── Input validation for critique mode ───────────────────────────────────
    if (mode === "critique") {
      const text = userTeardown?.trim() ?? "";

      if (text.length < 150) {
        return new Response(JSON.stringify({
          error: "Your teardown is too short to critique. Please provide more analysis.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const nonPrintable = text.split("").filter(
        (c: string) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126
      ).length;
      if (nonPrintable / text.length > 0.1) {
        return new Response(JSON.stringify({
          error: "We couldn't read your teardown. Please paste the text directly.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const words = text.split(/\s+/).filter((w: string) => w.length > 2);
      if (words.length < 30) {
        return new Response(JSON.stringify({
          error: "This doesn't look like a product teardown. Please write or paste your analysis.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── Step 1: Generate search queries ─────────────────────────────────────
    let searchQueries: string[];
    let scope = "product";

    if (mode === "generate") {
      console.log("Generating search queries for:", productName);
      searchQueries = await generateSearchQueries(productName);
    } else {
      console.log("Generating critique context for:", productName);
      const critiqueContext = await generateCritiqueContext(productName ?? "", userTeardown ?? "");
      scope = critiqueContext.scope;
      searchQueries = critiqueContext.queries;
    }

    console.log("Scope:", scope);
    console.log("Generated queries:", searchQueries);

    // ── Step 2: Search LennyData + web in parallel ───────────────────────────
    const webQuery = `${productName} product strategy 2026`;

    const allLennyQueries = [productName ?? "", ...searchQueries];
    const [lennyResults, webSearchResult] = await Promise.all([
      Promise.all(allLennyQueries.map(q => searchLennyData(q, 5))),
      searchWeb(webQuery),
    ]);

    const lennyCorpus = lennyResults.filter(Boolean).join("\n\n===\n\n");
    console.log("Lenny corpus length:", lennyCorpus.length);
    console.log("Web context length:", webSearchResult.text.length);

    const lennySection = lennyCorpus.length > 0
      ? `LENNY'S ARCHIVE — FRAMEWORKS & PHILOSOPHY:\n${lennyCorpus}`
      : `LENNY'S ARCHIVE — FRAMEWORKS & PHILOSOPHY:\nNo direct archive coverage found. In Lenny's Lens, identify relevant frameworks or patterns from the corpus by name, citing the guest or episode theme, and explain why each applies.`;

    const webSection = webSearchResult.text.length > 0
      ? `CURRENT WEB CONTEXT (use for facts, recent developments, current state):\n${webSearchResult.text}`
      : `CURRENT WEB CONTEXT:\nNo recent web results found. Note where current information would strengthen the analysis.`;

    // ── Step 3: Generate teardown/critique + isolated Lenny's Lens in parallel ─

    const sourceInstruction = `You have two knowledge sources:
1. LENNY'S ARCHIVE — use for frameworks, philosophy, mental models, and strategic patterns. Only use ideas and frameworks that appear directly in the provided excerpts.
2. CURRENT WEB CONTEXT — use for current facts, recent developments, and anything time-sensitive.

CITATION FORMAT — apply to every section:
- Archive: (Full Name, Role · Lenny's Archive) — use the person's full first and last name, always. Never use last name only. The person's full name always comes first — never lead with the outlet, source, or product name. Never write a bare (Lenny's Archive, year) reference without a person's full name. Only cite an archive guest when the retrieved excerpt explicitly and directly supports the specific claim — do not attribute a framework by name based on general expertise. Only attribute a concept to the person who explicitly originated it in the excerpt — do not attribute ideas to other people merely mentioned nearby. Cite at most 3 archive sources per section.
- Web: (Outlet, Month Year) — outlet name only, never an individual's name. Only cite a web source if it directly covers ${productName ?? "this product"}. Do not cite web sources whose primary subject is a different company, product, or industry.
- Training knowledge: welcome for analysis and frameworks. Never attach a person's name to it.
- Do not present case studies from the archive about other companies as if they happened to the product you are analyzing.

When sources conflict, trust web context for facts and the archive for frameworks.

CRITICAL: Your response must be valid JSON only. Do not use unescaped quotes inside string values. Do not use backticks inside strings. Escape any apostrophes or special characters properly. Never output markdown outside of the JSON structure.`;

    const digitalProductsConstraint = `Scry analyzes digital products only — software, apps, and SaaS. If a submission references hardware, manufacturing, or physical products, note this is outside scope and redirect analysis to the digital product layer only.`;

    const scopeConditionalBlock = `The user's teardown has been classified as scope: ${scope}.

Apply scope-aware evaluation inside gaps_and_blind_spots and framework_alignment only. suggested_improvements follows from gaps — stay within the same scope boundary.

If scope is "feature": evaluate against UX quality, interaction design, user flow, edge cases, usability. Do not flag missing growth model, business model, or company-level strategy.
If scope is "product": evaluate against product strategy, positioning, UX, onboarding, growth model, retention. Flag missing business model or pricing only if monetization is clearly central to the product being analyzed.
If scope is "company": evaluate against the full spectrum — strategy, competitive positioning, business model, distribution, growth loops, retention, UX quality. No restrictions.

strengths and lennys_lens are unconditional regardless of scope.`;

    const critiqueSourceConstraint = `ADDITIONAL CITATION RULE FOR CRITIQUE MODE: Do not cite any person whose name appears in the user's submitted teardown — names inherited from the user's text do not qualify as Lenny's Archive sources regardless of whether they are real experts. The citation rules in sourceInstruction above apply in full.`;

    const systemPrompt = mode === "critique"
      ? `You are a world-class product coach with access to insights from Lenny Rachitsky's podcast and newsletter archive, plus current web context.

${sourceInstruction}

${critiqueSourceConstraint}

${lennySection}

${webSection}

Using both sources, produce a structured critique with exactly 5 sections. Be direct and specific. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst. Each section must be 3-5 sentences maximum. Prioritize insight density over coverage. Be ruthlessly concise.

Format your response as a JSON object with these exact keys: overall_assessment, strengths, gaps_and_blind_spots, framework_alignment, suggested_improvements.

Throughout each section, attribute insights inline using the formats defined above: (Name, Role · Lenny's Archive) for corpus guests, (Outlet, Month Year) for web sources.

${scopeConditionalBlock}

${digitalProductsConstraint}`
      : `You are a world-class product analyst with access to insights from Lenny Rachitsky's podcast and newsletter archive, plus current web context.

${sourceInstruction}

${lennySection}

${webSection}

Using both sources, produce a comprehensive full-stack product teardown with exactly 6 sections. Be specific and opinionated. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst. Each section must be 3-5 sentences maximum. Prioritize insight density over coverage. Be ruthlessly concise.

Format your response as a JSON object with these exact keys: product_url, product_overview, strategy_and_positioning, feature_breakdown, growth_model, design_analysis, key_insights. For product_url, provide the official product homepage URL (e.g. "https://figma.com"). If unknown, use an empty string.

Throughout each section, attribute insights inline using the formats defined above: (Name, Role · Lenny's Archive) for corpus guests, (Outlet, Month Year) for web sources.

Where the archive contains differing perspectives between experts, surface that tension explicitly rather than flattening it.

If the input refers to a specific feature or flow rather than a full product or company, scope all sections to that feature. Do not extrapolate to company-level strategy or growth models beyond what directly relates to the feature being analyzed.

${digitalProductsConstraint}`;

    const userMessage = mode === "critique"
      ? `Please critique this product teardown:\n\n${userTeardown}`
      : `Please produce a full-stack teardown of: ${productName}`;

    let parsed: Record<string, unknown>;
    try {
      parsed = await callMainModel(systemPrompt, userMessage);
    } catch (firstError) {
      console.error("Main call failed, retrying once:", firstError.message);
      parsed = await callMainModel(systemPrompt, userMessage);
    }

    // ── Verify archive citations across all sections ──────────────────────────
    parsed = verifyParsedCitations(parsed, lennyCorpus);

    // ── Lenny's Lens: sequential, informed by main teardown output ────────────
    const lensContext = [
      parsed.strategy_and_positioning,
      parsed.key_insights,
      parsed.overall_assessment,
    ].filter(Boolean).join("\n\n");

    let lennysLens = await generateLennysLens(
      productName ?? "",
      mode,
      lennyCorpus,
      lensContext,
    );
    lennysLens = lennysLens.replace(/^#[^\n]*\n+/, "").trim();
    parsed.lennys_lens = lennysLens;

    if (userId && !isDevUser) {
      await supabase.rpc("increment_usage", { p_user_id: userId, p_date: today });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});