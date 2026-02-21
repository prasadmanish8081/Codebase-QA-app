const SUPPORTED_PROVIDERS = ["groq", "openai"] as const;

type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export type AppEnv = {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl: string;
};

function parseProvider(input: string | undefined): Provider {
  const value = (input || "groq").toLowerCase();
  if (value === "openai") return "openai";
  return "groq";
}

export function getEnv(): AppEnv {
  const provider = parseProvider(process.env.LLM_PROVIDER);

  if (provider === "openai") {
    return {
      provider,
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "",
      baseUrl: "https://api.openai.com/v1"
    };
  }

  return {
    provider,
    apiKey: process.env.GROQ_API_KEY || "",
    model: process.env.GROQ_MODEL || "",
    baseUrl: "https://api.groq.com/openai/v1"
  };
}

export function envMissingMessage(provider: Provider): string {
  if (provider === "openai") {
    return "OPENAI_API_KEY or OPENAI_MODEL missing";
  }
  return "GROQ_API_KEY or GROQ_MODEL missing";
}
