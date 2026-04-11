import { NextRequest, NextResponse } from "next/server";
import { classifyTask, selectModelsRanked } from "@/lib/router";
import { streamLLM } from "@/lib/llm-stream";
import { callLLM } from "@/lib/llm-client";
import { ApiKeys, ModelProvider } from "@/lib/types";
import { detectAllCLIs } from "@/lib/cli-provider";

/** Check if running in local CLI mode (set by `smart-router serve`) */
function isCLIMode(): boolean {
  return process.env.USE_CLI === "true";
}

/** Build a fake ApiKeys object that marks CLI-served providers as available */
async function getCLIApiKeys(): Promise<ApiKeys> {
  const statuses = await detectAllCLIs();
  const keys: ApiKeys = {};
  for (const [id, status] of Object.entries(statuses)) {
    if (status.installed) {
      for (const provider of status.config.servesProviders) {
        keys[provider as ModelProvider] = `cli:${id}`;
      }
    }
  }
  return keys;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKeys: clientApiKeys } = (await req.json()) as {
      messages: { role: "user" | "assistant" | "system"; content: string }[];
      apiKeys: ApiKeys;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!latestUserMessage) {
      return NextResponse.json({ error: "No user message found" }, { status: 400 });
    }

    // In CLI mode, use detected CLIs instead of client-provided API keys
    const cliMode = isCLIMode();
    const apiKeys = cliMode
      ? { ...await getCLIApiKeys(), ...clientApiKeys }
      : clientApiKeys;

    // Step 1: Classify the task (keyword fallback works without API keys)
    const { category, reasoning } = await classifyTask(
      latestUserMessage.content,
      apiKeys
    );

    // Step 2: Get ranked models
    const rankedModels = selectModelsRanked(category, apiKeys);

    if (rankedModels.length === 0) {
      const errorMsg = cliMode
        ? "No CLI tools detected. Install claude, gemini, or codex CLI."
        : "No models available for this task. Check your API keys in Settings.";
      return NextResponse.json({ error: errorMsg }, { status: 502 });
    }

    const selectedModel = rankedModels[0];

    // Step 3: Respond — CLI mode uses non-streaming, API mode uses streaming
    const encoder = new TextEncoder();

    if (cliMode) {
      // CLI mode: call via CLI binary (non-streaming), return as streamed chunks
      const result = await callLLM(selectedModel, messages, apiKeys, { useCLI: true });

      const metaHeader = JSON.stringify({
        model: selectedModel.name,
        modelId: selectedModel.id,
        provider: selectedModel.provider,
        category,
        reasoning,
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        viaCLI: true,
        fallbackModels: rankedModels.slice(1).map((m) => m.name),
      });

      const meta = JSON.stringify({
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      const outputStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`[ROUTE]${metaHeader}\n\n`));
          controller.enqueue(encoder.encode(result.content));
          controller.enqueue(encoder.encode(`\n\n[META]${meta}`));
          controller.close();
        },
      });

      return new Response(outputStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // API mode: stream the response
    const metaHeader = JSON.stringify({
      model: selectedModel.name,
      modelId: selectedModel.id,
      provider: selectedModel.provider,
      category,
      reasoning,
      inputCostPer1M: selectedModel.inputCostPer1M,
      outputCostPer1M: selectedModel.outputCostPer1M,
      fallbackModels: rankedModels.slice(1).map((m) => m.name),
    });

    const llmStream = streamLLM(selectedModel, messages, apiKeys);

    const outputStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(`[ROUTE]${metaHeader}\n\n`));

        const reader = llmStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });

    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
