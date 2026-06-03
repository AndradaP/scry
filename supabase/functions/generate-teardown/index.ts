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

async function generateSearchQueries(
  mode: string,
  productName?: string,
  userTeardown?: string
): Promise<string[]> {
  const prompt = mode === "generate"
    ? `You are helping search a podcast and newsletter archive using a case-insensitive text search engine. The search supports pipe-delimited alternatives to match synonyms and related terms across titles, summaries, tags, and content.

The product to teardown is: "${productName}"

Generate exactly 4 search queries. Follow these rules strictly:
- Query 1: the product name exactly as given, nothing else
- Queries 2-4: pipe-delimited synonym sets covering different strategic angles relevant to this product's category
- Each pipe-delimited set should have 2-4 terms that mean similar things or are closely related
- Think about: go-to-market motion, growth model, competitive dynamics, product category

Good examples for a product like "Figma":
- "bottom-up|PLG|product-led growth"
- "design tools|creative software|collaboration software"
- "enterprise adoption|land and expand|B2B expansion"

Good examples for a product like "Notion":
- "all-in-one|workspace|productivity suite"
- "bottom-up|PLG|product-led growth"
- "knowledge management|docs|wiki|notes"

Bad examples (do not write like this):
- "how do design tools win adoption from the bottom up inside a company"
- "design tools collaboration growth strategy"
- "figma enterprise positioning competitive"

Return ONLY a JSON array of 4 strings. No explanation. No markdown. No preamble.`
    : `You are helping search a podcast and newsletter archive using a case-insensitive text search engine. The search supports pipe-delimited alternatives to match synonyms and related terms.

A user submitted a product teardown for critique. Your job is to generate 3 search queries that will retrieve the most relevant evaluative frameworks and expert perspectives from the archive.

Teardown excerpt: "${userTeardown?.slice(0, 800)}"

Generate exactly 3 search queries. Each must be a pipe-delimited synonym set targeting evaluative frameworks relevant to critiquing this type of product. Focus on the lenses a sharp analyst would use to assess this product's strategic position.

Good examples for critiquing a B2B SaaS product:
- "retention|churn|engagement|stickiness"
- "positioning|differentiation|competitive moat|7 powers"
- "PLG|product-led growth|freemium|bottom-up"

Good examples for critiquing a consumer product:
- "growth loops|viral coefficient|word of mouth|referral"
- "activation|onboarding|aha moment|time to value"
- "retention|habit formation|engagement|DAU MAU"

Bad examples (do not write like this):
- "product teardown"
- "design architecture engineering"
- "how do you evaluate whether a product has found product market fit"

Return ONLY a JSON array of 3 strings. No explanation. No markdown. No preamble.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content[0].text.trim();

  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const queries = JSON.parse(clean);
    if (Array.isArray(queries) && queries.length > 0) {
      return mode === "critique"
        ? [productName ?? "", ...queries]
        : queries;
    }
  } catch {
    console.error("Failed to parse query list:", text);
  }

  return mode === "generate"
    ? [productName ?? "", "bottom-up|PLG|product-led growth", "enterprise|land and expand|B2B", "retention|stickiness|engagement"]
    : [productName ?? "", "retention|churn|stickiness", "activation|onboarding|time to value", "PLG|product-led growth|freemium"];
}

async function searchLennyData(query: string, limit = 5): Promise<string> {
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
        arguments: { query, limit },
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
          max_tokens: 1000,
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

    // ── Step 1: Generate smart search queries ────────────────────────────────
    console.log("Generating search queries for:", productName || "critique");
    const searchQueries = await generateSearchQueries(mode, productName, userTeardown);
    console.log("Generated queries:", searchQueries);

    // ── Step 2: Search LennyData + web in parallel ───────────────────────────
    const webQuery = mode === "generate"
      ? `${productName} product strategy 2026`
      : `${searchQueries[0]} product strategy 2026`;

    const [lennyResults, webSearchResult] = await Promise.all([
      Promise.all(searchQueries.map(q => searchLennyData(q, 5))),
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

    // ── Step 3: Generate teardown or critique ────────────────────────────────
    const lennysLensInstruction = `For lennys_lens specifically: this section must always be substantive. If the archive returned direct mentions of this product or its founders, use them. If not, identify 2-3 frameworks, patterns, or principles that Lenny or his guests have articulated that directly apply to this product's strategic situation. Name the specific guest, episode theme, or recurring pattern you are drawing from and explain why it applies. Never disclaim lack of coverage. Never leave this section thin. The value of Lenny's Lens is applying the corpus intelligently to a specific product, not just quoting it.`;

    const sourceInstruction = `You have two knowledge sources:
1. LENNY'S ARCHIVE — use for frameworks, philosophy, mental models, and strategic patterns. This is your analytical lens.
2. CURRENT WEB CONTEXT — use for current facts, recent product developments, leadership, competitive landscape, and anything time-sensitive. Always anchor the teardown in what is true today.

When these sources conflict, trust web context for facts and the archive for frameworks.

CRITICAL: Your response must be valid JSON only. Do not use unescaped quotes inside string values. Do not use backticks inside strings. Escape any apostrophes or special characters properly. Never output markdown outside of the JSON structure.`;

    const systemPrompt = mode === "critique"
      ? `You are a world-class product coach with access to insights from Lenny Rachitsky's podcast and newsletter archive, plus current web context.

${sourceInstruction}

${lennySection}

${webSection}

Using both sources, produce a structured critique with exactly 6 sections. Be direct and specific. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst. Each section must be 3-5 sentences maximum. Prioritize insight density over coverage. Be ruthlessly concise.

Format your response as a JSON object with these exact keys: overall_assessment, strengths, gaps_and_blind_spots, framework_alignment, suggested_improvements, lennys_lens.

Throughout each section, attribute insights to specific experts by name and domain inline — format: (Expert Name, Domain).

${lennysLensInstruction}`
      : `You are a world-class product analyst with access to insights from Lenny Rachitsky's podcast and newsletter archive, plus current web context.

${sourceInstruction}

${lennySection}

${webSection}

Using both sources, produce a comprehensive full-stack product teardown with exactly 7 sections. Be specific and opinionated. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst. Each section must be 3-5 sentences maximum. Prioritize insight density over coverage. Be ruthlessly concise.

Format your response as a JSON object with these exact keys: product_url, product_overview, strategy_and_positioning, feature_breakdown, growth_model, design_analysis, key_insights, lennys_lens. For product_url, provide the official product homepage URL (e.g. "https://figma.com"). If unknown, use an empty string.

Throughout each section, attribute insights to specific experts by name and domain inline — format: (Expert Name, Domain).

Where the archive contains differing perspectives between experts, surface that tension explicitly rather than flattening it.

${lennysLensInstruction}`;

    const userMessage = mode === "critique"
      ? `Please critique this product teardown:\n\n${userTeardown}`
      : `Please produce a full-stack teardown of: ${productName}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("JSON parse failed, attempting salvage:", e.message);
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error(`Failed to parse Claude response: ${e.message}`);
      }
    }

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