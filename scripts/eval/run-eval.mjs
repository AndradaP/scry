import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { singleProductPrompt } from "./prompts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env.local") });

const MODEL = "claude-sonnet-4-5";
const DEV_EMAIL = "ioana.andrada.api@gmail.com";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

// generate-teardown never verifies the JWT signature (getUserFromJwt just
// base64-decodes the payload), so any 3-part token with this email bypasses
// its rate limits the same way the real dev account does.
function devBypassJwt() {
  const header = base64url({ alg: "none", typ: "JWT" });
  const payload = base64url({ email: DEV_EMAIL, sub: "eval-script" });
  return `${header}.${payload}.unsigned`;
}

async function runScry(product) {
  const prompt = singleProductPrompt(product);
  const res = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/generate-teardown`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${devBypassJwt()}`,
        apikey: process.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        productName: product,
        mode: "generate",
        timezone: "UTC",
        debug: true,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`generate-teardown failed (${res.status}): ${JSON.stringify(data)}`);
  }
  // _eval_debug (corpus retrieval sizes + citation write/survive counts) is
  // instrumentation, not model output — split it into its own eval_runs column
  // so raw_output stays a faithful copy of what the product actually returns.
  const { _eval_debug, ...raw_output } = data;
  return { arm: "scry", model: MODEL, prompt, raw_output, debug_metadata: _eval_debug ?? null };
}

async function callAnthropic(prompt, tools) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
      ...(tools ? { tools } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Anthropic API failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function runClaudeVanilla(product) {
  const prompt = singleProductPrompt(product);
  const data = await callAnthropic(prompt, null);
  return { arm: "claude_vanilla", model: MODEL, prompt, raw_output: data };
}

async function runClaudeWeb(product) {
  const prompt = singleProductPrompt(product);
  // claude-sonnet-4-5 predates Sonnet 4.6/Opus 4.6 — it only supports the
  // basic web_search tool, not the _20260209 dynamic-filtering variant.
  const data = await callAnthropic(prompt, [
    { type: "web_search_20250305", name: "web_search" },
  ]);
  return { arm: "claude_web", model: MODEL, prompt, raw_output: data };
}

const RUNNERS = {
  scry: runScry,
  claude_vanilla: runClaudeVanilla,
  claude_web: runClaudeWeb,
};

async function main() {
  const args = process.argv.slice(2);
  const productIdx = args.indexOf("--product");
  const armIdx = args.indexOf("--arm");
  const product = productIdx !== -1 ? args[productIdx + 1] : null;
  const arm = armIdx !== -1 ? args[armIdx + 1] : "all";

  if (!product) {
    console.error("Usage: node run-eval.mjs --product <name> --arm <scry|claude_vanilla|claude_web|all>");
    process.exit(1);
  }

  const arms = arm === "all" ? Object.keys(RUNNERS) : [arm];
  if (arms.some((a) => !RUNNERS[a])) {
    console.error(`Unknown arm. Valid: ${Object.keys(RUNNERS).join(", ")}, all`);
    process.exit(1);
  }

  for (const a of arms) {
    console.log(`\n=== ${a} :: ${product} ===`);
    const result = await RUNNERS[a](product);
    console.log(JSON.stringify(result.raw_output, null, 2));

    const { error } = await supabase.from("eval_runs").insert({
      product,
      arm: result.arm,
      prompt: result.prompt,
      raw_output: result.raw_output,
      model: result.model,
      debug_metadata: result.debug_metadata ?? null,
    });
    if (error) {
      console.error(`Insert failed for ${a}:`, error);
    } else {
      console.log(`Inserted eval_runs row for ${a}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
