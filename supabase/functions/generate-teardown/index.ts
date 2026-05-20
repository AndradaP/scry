const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const { productName, mode, userTeardown } = body;

    const systemPrompt = mode === "critique"
      ? `You are a world-class product coach. Produce a structured critique with exactly 6 sections. Be direct and specific. No em dashes. No sycophancy. No superlatives. Format your response as a JSON object with these exact keys: overall_assessment, strengths, gaps_and_blind_spots, framework_alignment, suggested_improvements, lennys_lens. Each value should be 2-4 paragraphs.`
      : `You are a world-class product analyst. Produce a full-stack product teardown with exactly 7 sections. Be specific and opinionated. No em dashes. No sycophancy. Format your response as a JSON object with these exact keys: product_overview, strategy_and_positioning, feature_breakdown, growth_model, design_analysis, key_insights, lennys_lens. Each value should be 2-4 paragraphs.`;

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});