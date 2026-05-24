const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateSearchQueries(
  mode: string,
  productName?: string,
  userTeardown?: string
): Promise<string[]> {
  const prompt = mode === "generate"
    ? `You are helping search a podcast and newsletter archive of long-form conversations with product leaders, founders, and operators. The archive uses semantic search — it matches meaning, not keywords. Queries that sound like natural spoken sentences retrieve well. Keyword strings retrieve nothing.

The product to teardown is: "${productName}"

Generate exactly 4 search queries. Follow these rules strictly:
- Query 1: the product name exactly as given, nothing else
- Queries 2-4: conversational sentences of 10-15 words describing a concept, dynamic, or strategic question relevant to this product's category
- Every query must read like something a person would say out loud, not a search string
- Do not use comma-separated keywords
- Do not mention the product name in queries 2-4

Good examples for a product like "Figma":
- "how do design tools win adoption from the bottom up inside a company"
- "what makes a collaboration product sticky when multiple people use it together"
- "when does a prosumer tool successfully cross into enterprise sales"

Bad examples (do not write like this):
- "design tools collaboration growth strategy"
- "figma enterprise positioning competitive"
- "product led growth retention monetization"

Return ONLY a JSON array of 4 strings. No explanation. No markdown. No preamble.`
    : `You are helping search a podcast and newsletter archive of long-form conversations with product leaders, founders, and operators. The archive uses semantic search — queries that sound like natural spoken sentences retrieve well. Keyword strings retrieve nothing.

A user submitted a product teardown for critique. Generate exactly 4 search queries to find relevant frameworks and expert perspectives.

Teardown excerpt: "${userTeardown?.slice(0, 500)}"

Rules:
- Query 1: the name of the product being analyzed, exactly as it appears in the teardown
- Queries 2-4: conversational sentences of 10-15 words about frameworks or dynamics relevant to evaluating this type of product
- No keyword strings. No comma-separated terms.

Return ONLY a JSON array of 4 strings. No explanation. No markdown.`;

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
    if (Array.isArray(queries) && queries.length > 0) return queries;
  } catch {
    console.error("Failed to parse query list:", text);
  }

  return mode === "generate"
    ? [productName ?? "", "how does a bottom up product expand into enterprise accounts", "what makes a B2B product sticky enough that teams keep using it"]
    : ["product strategy framework teardown", "how do you evaluate whether a product has found real product market fit", "what separates a good product teardown from a shallow one"];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, mode, userTeardown, chatMessages, teardownContext } = body;

    // ── Chat mode ────────────────────────────────────────────────────────────
    if (mode === "chat") {
      const systemPrompt = `You are a product expert. The user has received a product teardown or critique shown below. Answer their follow-up questions using the teardown as your primary reference. Be concise, specific, and insightful. Build on the teardown rather than repeating it. No em dashes. Topic-locked to product strategy.

TEARDOWN CONTEXT:
${teardownContext}`;

      const messages = chatMessages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: systemPrompt,
          messages,
        }),
      });

      const data = await response.json();
      const text = data.content[0].text;
      return new Response(JSON.stringify({ reply: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: Generate smart search queries ────────────────────────────────
    console.log("Generating search queries for:", productName || "critique");
    const searchQueries = await generateSearchQueries(mode, productName, userTeardown);
    console.log("Generated queries:", searchQueries);

    // ── Step 2: Search LennyData in parallel ─────────────────────────────────
    const searchResults = await Promise.all(
      searchQueries.map(q => searchLennyData(q, 4))
    );

    const corpusContext = searchResults.filter(Boolean).join("\n\n===\n\n");
    console.log("Corpus context length:", corpusContext.length);

    const corpusSection = corpusContext.length > 0
      ? `LENNY'S ARCHIVE CONTEXT:\n${corpusContext}`
      : `LENNY'S ARCHIVE CONTEXT:\nNo direct archive coverage found for this product. Draw on your broader knowledge of product strategy, and in Lenny's Lens specifically, identify relevant frameworks or patterns from Lenny's corpus by name — citing the guest, episode theme, or principle — and explain why each applies to this product's situation.`;

    // ── Step 3: Generate teardown or critique ────────────────────────────────
    const lennysLensInstruction = `For lennys_lens specifically: this section must always be substantive. If the archive returned direct mentions of this product or its founders, use them. If not, identify 2-3 frameworks, patterns, or principles that Lenny or his guests have articulated that directly apply to this product's strategic situation. Name the specific guest, episode theme, or recurring pattern you are drawing from and explain why it applies. Never disclaim lack of coverage. Never leave this section thin. The value of Lenny's Lens is applying the corpus intelligently to a specific product, not just quoting it.`;

    const systemPrompt = mode === "critique"
      ? `You are a world-class product coach with access to insights from Lenny Rachitsky's podcast and newsletter archive. Below is relevant content from that archive to ground your analysis.

${corpusSection}

Using the archive above as your primary intelligence layer, produce a structured critique with exactly 6 sections. Be direct and specific. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst.

Format your response as a JSON object with these exact keys: overall_assessment, strengths, gaps_and_blind_spots, framework_alignment, suggested_improvements, lennys_lens.

Each section should be 2-4 paragraphs. Throughout each section, attribute insights to specific experts by name and domain inline — format: (Expert Name, Domain).

${lennysLensInstruction}`
      : `You are a world-class product analyst with access to insights from Lenny Rachitsky's podcast and newsletter archive. Below is relevant content from that archive to ground your analysis.

${corpusSection}

Using the archive above as your primary intelligence layer, produce a comprehensive full-stack product teardown with exactly 7 sections. Be specific and opinionated. No em dashes. No sycophancy. No superlatives. No AI filler phrases. Write factually, like a sharp analyst.

Format your response as a JSON object with these exact keys: product_overview, strategy_and_positioning, feature_breakdown, growth_model, design_analysis, key_insights, lennys_lens.

Each section should be 2-4 paragraphs of substantive analysis. Throughout each section, attribute insights to specific experts by name and domain inline — format: (Expert Name, Domain).

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
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

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