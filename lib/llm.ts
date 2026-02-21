import { getEnv, envMissingMessage } from "@/lib/env";
import { StoredSnippet } from "@/lib/types";

type LlmAnswer = {
  answer: string;
  snippetIds: string[];
};

const REQUEST_TIMEOUT_MS = 25_000;

function hasLlmConfig(): boolean {
  const env = getEnv();
  return Boolean(env.apiKey && env.model);
}

function parseJsonFromText(content: string): LlmAnswer | null {
  const candidates = [content, content.replace(/```json|```/gi, "").trim()];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<LlmAnswer>;
      return {
        answer: String(parsed.answer || "No answer generated."),
        snippetIds: Array.isArray(parsed.snippetIds) ? parsed.snippetIds.map((id) => String(id)) : []
      };
    } catch {
      // ignore and continue
    }
  }

  return null;
}

function buildHeuristicAnswer(question: string, snippets: StoredSnippet[]): LlmAnswer {
  const top = snippets.slice(0, 3);
  const refs = top.map((s) => `${s.path}:${s.startLine}-${s.endLine}`).join(", ");
  return {
    answer: `Direct JSON answer generate nahi hua. Retrieved evidence ke basis par relevant locations: ${refs}. Question: "${question}".`,
    snippetIds: top.map((s) => s.id)
  };
}

async function callChat(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.apiKey}`
      },
      body: JSON.stringify({
        model: env.model,
        temperature: 0.2,
        max_tokens: 800,
        messages
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM call failed: ${text.slice(0, 180)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? "{}";
  } finally {
    clearTimeout(timer);
  }
}

export async function llmHealthCheck(): Promise<{ ok: boolean; detail: string }> {
  const env = getEnv();
  if (!hasLlmConfig()) {
    return { ok: false, detail: envMissingMessage(env.provider) };
  }

  try {
    await callChat([{ role: "user", content: "Reply with OK" }]);
    return { ok: true, detail: `LLM reachable (${env.provider}: ${env.model})` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "llm error" };
  }
}

export async function answerWithProof(question: string, snippets: StoredSnippet[]): Promise<LlmAnswer> {
  const env = getEnv();

  if (!hasLlmConfig()) {
    const fallback = snippets.slice(0, 2).map((s) => s.id);
    return {
      answer: `LLM is not configured. ${envMissingMessage(env.provider)}`,
      snippetIds: fallback
    };
  }

  const snippetBlock = snippets
    .map((s) => `Snippet ${s.id}\nPath: ${s.path}:${s.startLine}-${s.endLine}\n\n${s.code}`)
    .join("\n\n----\n\n");

  const system = [
    "You answer repository questions using only provided snippets.",
    "Output only a valid JSON object: {\"answer\": string, \"snippetIds\": string[] }.",
    "Be technically precise and concise.",
    "If question asks a symbol (e.g. Foo.bar), explain where it is used/defined in snippets.",
    "Only include snippet IDs that directly support your answer."
  ].join(" ");

  const user = `Question: ${question}\n\nSnippets:\n${snippetBlock}`;
  const content = await callChat([
    { role: "system", content: system },
    { role: "user", content: user }
  ]);

  const parsed = parseJsonFromText(content);
  if (parsed) return parsed;
  return buildHeuristicAnswer(question, snippets);
}
