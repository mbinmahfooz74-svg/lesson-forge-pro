import Anthropic from "@anthropic-ai/sdk";

/**
 * Multi-provider LLM client with automatic resolution:
 *   ANTHROPIC_API_KEY -> Claude (production primary)
 *   GROQ_API_KEY      -> Groq llama-3.3-70b (test phase)
 *   OPENAI_API_KEY    -> OpenAI chat (production fallback)
 *   none              -> deterministic fallback content (offline mode)
 * Provider errors (rate limits etc.) retry once, then degrade to the fallback so
 * autonomous cycles never crash mid-run.
 */
export type LLMProvider = "anthropic" | "groq" | "openai" | "none";

const ANTHROPIC_MODEL = process.env.LESSONFORGE_MODEL || "claude-sonnet-4-6";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export function activeLLM(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

export function hasLLM(): boolean {
  return activeLLM() !== "none";
}

export interface LLMCall {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResult<T> {
  data: T;
  usedLLM: boolean;
  provider: LLMProvider;
  inputTokens: number;
  outputTokens: number;
}

interface Completion {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

let anthropic: Anthropic | null = null;

async function complete(call: LLMCall): Promise<Completion | null> {
  const provider = activeLLM();
  if (provider === "none") return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (provider === "anthropic") return await completeAnthropic(call);
      return await completeOpenAICompatible(call, provider);
    } catch (e) {
      const msg = (e as Error).message;
      console.warn(`[llm] ${provider} attempt ${attempt + 1} failed: ${msg}`);
      if (attempt === 0 && /429|rate|overloaded/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 20_000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function completeAnthropic(call: LLMCall): Promise<Completion> {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: call.maxTokens ?? 4096,
    temperature: call.temperature ?? 0.4,
    system: call.system,
    messages: [{ role: "user", content: call.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

async function completeOpenAICompatible(call: LLMCall, provider: "groq" | "openai"): Promise<Completion> {
  const base = provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
  const key = provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  const model = provider === "groq" ? GROQ_MODEL : OPENAI_CHAT_MODEL;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: call.maxTokens ?? 4096,
      temperature: call.temperature ?? 0.4,
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: call.prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${provider} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: json.choices[0]?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
  };
}

/** Calls the active LLM and parses a JSON object; returns `fallback` offline or on failure. */
export async function generateJSON<T>(call: LLMCall, fallback: T): Promise<LLMResult<T>> {
  const res = await complete({
    ...call,
    system: call.system + "\n\nRespond with a single valid JSON object and nothing else.",
  });
  if (!res) return { data: fallback, usedLLM: false, provider: activeLLM(), inputTokens: 0, outputTokens: 0 };
  return {
    data: parseJSON<T>(res.text, fallback),
    usedLLM: true,
    provider: activeLLM(),
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
  };
}

export async function generateText(call: LLMCall, fallback: string): Promise<LLMResult<string>> {
  const res = await complete(call);
  if (!res) return { data: fallback, usedLLM: false, provider: activeLLM(), inputTokens: 0, outputTokens: 0 };
  return { data: res.text, usedLLM: true, provider: activeLLM(), inputTokens: res.inputTokens, outputTokens: res.outputTokens };
}

function parseJSON<T>(text: string, fallback: T): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return fallback;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}
