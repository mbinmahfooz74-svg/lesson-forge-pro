import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.LESSONFORGE_MODEL || "claude-sonnet-4-6";

export function hasLLM(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
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
  inputTokens: number;
  outputTokens: number;
}

/**
 * Calls Claude and parses a JSON object from the response.
 * When ANTHROPIC_API_KEY is absent, returns `fallback` with usedLLM=false so the
 * whole pipeline runs deterministically offline and turns live the moment a key is set.
 */
export async function generateJSON<T>(call: LLMCall, fallback: T): Promise<LLMResult<T>> {
  if (!hasLLM()) {
    return { data: fallback, usedLLM: false, inputTokens: 0, outputTokens: 0 };
  }
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: call.maxTokens ?? 4096,
    temperature: call.temperature ?? 0.4,
    system: call.system + "\n\nRespond with a single valid JSON object and nothing else.",
    messages: [{ role: "user", content: call.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const data = parseJSON<T>(text, fallback);
  return {
    data,
    usedLLM: true,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}

export async function generateText(call: LLMCall, fallback: string): Promise<LLMResult<string>> {
  if (!hasLLM()) {
    return { data: fallback, usedLLM: false, inputTokens: 0, outputTokens: 0 };
  }
  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: call.maxTokens ?? 4096,
    temperature: call.temperature ?? 0.5,
    system: call.system,
    messages: [{ role: "user", content: call.prompt }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { data: text, usedLLM: true, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
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
