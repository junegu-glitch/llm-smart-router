import { ApiKeys, ModelProvider } from "./types";

const STORAGE_KEY = "llm-router-api-keys";

export function getApiKeys(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function hasAnyApiKey(keys: ApiKeys): boolean {
  return Object.values(keys).some((v) => v && v.trim().length > 0);
}

export function getConfiguredProviders(keys: ApiKeys): ModelProvider[] {
  return (Object.entries(keys) as [ModelProvider, string | undefined][])
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([k]) => k);
}

export const PROVIDER_INFO: Record<
  ModelProvider,
  { name: string; description: string; docsUrl: string; placeholder: string }
> = {
  deepseek: {
    name: "DeepSeek",
    description: "Ultra-low cost, great for routing & general tasks",
    docsUrl: "https://platform.deepseek.com/api_keys",
    placeholder: "sk-...",
  },
  anthropic: {
    name: "Anthropic (Claude)",
    description: "Best for coding, analysis, and reasoning",
    docsUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  openai: {
    name: "OpenAI (GPT)",
    description: "Excellent for writing and general tasks",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  google: {
    name: "Google (Gemini)",
    description: "Multimodal, 1M context window, image analysis",
    docsUrl: "https://aistudio.google.com/apikey",
    placeholder: "AI...",
  },
  xai: {
    name: "xAI (Grok)",
    description: "2M context window, fast reasoning",
    docsUrl: "https://console.x.ai/",
    placeholder: "xai-...",
  },
  mistral: {
    name: "Mistral",
    description: "Cost-effective European AI models",
    docsUrl: "https://console.mistral.ai/api-keys/",
    placeholder: "...",
  },
};
