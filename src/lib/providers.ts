/**
 * API Provider Endpoints
 *
 * Centralized constants for all LLM provider API endpoints.
 * Shared by llm-client.ts (non-streaming) and llm-stream.ts (streaming).
 */

export const PROVIDER_ENDPOINTS = {
  deepseek: "https://api.deepseek.com/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  /** Google uses model-specific URLs; this is the base path */
  googleBase: "https://generativelanguage.googleapis.com/v1beta/models",
} as const;

export const ANTHROPIC_VERSION = "2023-06-01";

/** Build the Google generateContent URL for a specific model */
export function googleGenerateUrl(model: string, apiKey: string): string {
  return `${PROVIDER_ENDPOINTS.googleBase}/${model}:generateContent?key=${apiKey}`;
}

/** Build the Google streamGenerateContent URL for a specific model */
export function googleStreamUrl(model: string, apiKey: string): string {
  return `${PROVIDER_ENDPOINTS.googleBase}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
}
