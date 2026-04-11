import { ModelConfig, ApiKeys } from "./types";
import { getCliConfigForModel, detectCLI, callViaCLI } from "./cli-provider";
import { PROVIDER_ENDPOINTS, ANTHROPIC_VERSION, googleGenerateUrl } from "./providers";

/** Default timeout for API calls (30 seconds). Prevents silent hangs. */
const DEFAULT_TIMEOUT_MS = 30_000;

interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  /** Whether the response was served via CLI (subscription) instead of API */
  viaCLI?: boolean;
}

/** Global toggle for CLI hybrid mode. Set via --use-cli flag. */
let cliModeEnabled = false;

export function enableCLIMode(): void {
  cliModeEnabled = true;
}

export function disableCLIMode(): void {
  cliModeEnabled = false;
}

export function isCLIModeEnabled(): boolean {
  return cliModeEnabled;
}

export async function callLLM(
  model: ModelConfig,
  messages: LLMMessage[],
  apiKeys: ApiKeys,
  options?: { useCLI?: boolean }
): Promise<LLMResponse> {
  // ─── Hybrid strategy: try CLI first if enabled ───
  // Prefer explicit parameter; fall back to global toggle for CLI entry point
  const useCLI = options?.useCLI ?? cliModeEnabled;
  if (useCLI) {
    const cliConfig = getCliConfigForModel(model);
    if (cliConfig) {
      const cliStatus = await detectCLI(cliConfig.id);
      if (cliStatus.installed) {
        const systemMsg = messages.find((m) => m.role === "system");
        const userMsg = messages
          .filter((m) => m.role !== "system")
          .map((m) => m.content)
          .join("\n\n");

        const cliResult = await callViaCLI(cliConfig.id, userMsg, systemMsg?.content, {
          model: model.id,
        });

        if (cliResult.success) {
          // CLI doesn't report token counts — estimate from character length
          // Average English token ≈ 4 characters; use 3.5 for safety margin
          const estimatedInputTokens = Math.ceil(userMsg.length / 3.5);
          const estimatedOutputTokens = Math.ceil(cliResult.content.length / 3.5);
          return {
            content: cliResult.content,
            inputTokens: estimatedInputTokens,
            outputTokens: estimatedOutputTokens,
            viaCLI: true,
          };
        }
        // CLI failed → fall through to API
      }
    }
  }

  // ─── Standard API path ───
  const apiKey = apiKeys[model.provider];
  if (!apiKey) {
    throw new Error(`No API key for provider: ${model.provider}`);
  }

  switch (model.provider) {
    case "deepseek":
      return callOpenAICompatible(
        PROVIDER_ENDPOINTS.deepseek,
        model.apiModel,
        messages,
        apiKey
      );
    case "openai":
      return callOpenAICompatible(
        PROVIDER_ENDPOINTS.openai,
        model.apiModel,
        messages,
        apiKey
      );
    case "xai":
      return callOpenAICompatible(
        PROVIDER_ENDPOINTS.xai,
        model.apiModel,
        messages,
        apiKey
      );
    case "mistral":
      return callOpenAICompatible(
        PROVIDER_ENDPOINTS.mistral,
        model.apiModel,
        messages,
        apiKey
      );
    case "anthropic":
      return callAnthropic(model.apiModel, messages, apiKey);
    case "google":
      return callGoogle(model.apiModel, messages, apiKey);
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}

async function callOpenAICompatible(
  endpoint: string,
  model: string,
  messages: LLMMessage[],
  apiKey: string
): Promise<LLMResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || "",
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

async function callAnthropic(
  model: string,
  messages: LLMMessage[],
  apiKey: string
): Promise<LLMResponse> {
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }

  const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const content = data.content
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { text: string }) => c.text)
    .join("");

  return {
    content,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

async function callGoogle(
  model: string,
  messages: LLMMessage[],
  apiKey: string
): Promise<LLMResponse> {
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const contents = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: 4096,
    },
  };

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const response = await fetch(
    googleGenerateUrl(model, apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((p: { text: string }) => p.text)
      .join("") || "";

  return {
    content,
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
  };
}

export function calculateCost(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number
): number {
  return (
    (inputTokens / 1_000_000) * model.inputCostPer1M +
    (outputTokens / 1_000_000) * model.outputCostPer1M
  );
}
