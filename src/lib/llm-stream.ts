import { ModelConfig, ApiKeys } from "./types";
import { PROVIDER_ENDPOINTS, ANTHROPIC_VERSION, googleStreamUrl } from "./providers";

interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Returns a ReadableStream that yields text chunks from the LLM.
 * The final chunk is a JSON metadata line prefixed with \n\n[DONE]
 */
export function streamLLM(
  model: ModelConfig,
  messages: LLMMessage[],
  apiKeys: ApiKeys
): ReadableStream<Uint8Array> {
  const apiKey = apiKeys[model.provider];
  if (!apiKey) {
    throw new Error(`No API key for provider: ${model.provider}`);
  }

  switch (model.provider) {
    case "deepseek":
      return streamOpenAICompatible(
        PROVIDER_ENDPOINTS.deepseek,
        model.apiModel,
        messages,
        apiKey
      );
    case "openai":
      return streamOpenAICompatible(
        PROVIDER_ENDPOINTS.openai,
        model.apiModel,
        messages,
        apiKey
      );
    case "xai":
      return streamOpenAICompatible(
        PROVIDER_ENDPOINTS.xai,
        model.apiModel,
        messages,
        apiKey
      );
    case "mistral":
      return streamOpenAICompatible(
        PROVIDER_ENDPOINTS.mistral,
        model.apiModel,
        messages,
        apiKey
      );
    case "anthropic":
      return streamAnthropic(model.apiModel, messages, apiKey);
    case "google":
      return streamGoogle(model.apiModel, messages, apiKey);
    default:
      throw new Error(`Unsupported provider: ${model.provider}`);
  }
}

function streamOpenAICompatible(
  endpoint: string,
  model: string,
  messages: LLMMessage[],
  apiKey: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
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
            stream: true,
            stream_options: { include_usage: true },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          controller.enqueue(encoder.encode(`Error (${response.status}): ${error}`));
          controller.close();
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let inputTokens = 0;
        let outputTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens || 0;
                outputTokens = parsed.usage.completion_tokens || 0;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        // Send metadata as final chunk
        const meta = JSON.stringify({ inputTokens, outputTokens });
        controller.enqueue(encoder.encode(`\n\n[META]${meta}`));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`Error: ${err instanceof Error ? err.message : "Unknown"}`)
        );
        controller.close();
      }
    },
  });
}

function streamAnthropic(
  model: string,
  messages: LLMMessage[],
  apiKey: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };
  if (systemMessage) {
    body.system = systemMessage.content;
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          controller.enqueue(encoder.encode(`Error (${response.status}): ${error}`));
          controller.close();
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let inputTokens = 0;
        let outputTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                controller.enqueue(encoder.encode(parsed.delta.text));
              }
              if (parsed.type === "message_start" && parsed.message?.usage) {
                inputTokens = parsed.message.usage.input_tokens || 0;
              }
              if (parsed.type === "message_delta" && parsed.usage) {
                outputTokens = parsed.usage.output_tokens || 0;
              }
            } catch {
              // skip
            }
          }
        }

        const meta = JSON.stringify({ inputTokens, outputTokens });
        controller.enqueue(encoder.encode(`\n\n[META]${meta}`));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`Error: ${err instanceof Error ? err.message : "Unknown"}`)
        );
        controller.close();
      }
    },
  });
}

function streamGoogle(
  model: string,
  messages: LLMMessage[],
  apiKey: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const contents = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };
  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(
          googleStreamUrl(model, apiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          controller.enqueue(encoder.encode(`Error (${response.status}): ${error}`));
          controller.close();
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let inputTokens = 0;
        let outputTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);

            try {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
              if (parsed.usageMetadata) {
                inputTokens = parsed.usageMetadata.promptTokenCount || inputTokens;
                outputTokens = parsed.usageMetadata.candidatesTokenCount || outputTokens;
              }
            } catch {
              // skip
            }
          }
        }

        const meta = JSON.stringify({ inputTokens, outputTokens });
        controller.enqueue(encoder.encode(`\n\n[META]${meta}`));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`Error: ${err instanceof Error ? err.message : "Unknown"}`)
        );
        controller.close();
      }
    },
  });
}
