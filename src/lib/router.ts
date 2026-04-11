import { TaskCategory, ModelConfig, ApiKeys, RouterResult } from "./types";
import { AVAILABLE_MODELS } from "./models";

interface GoogleGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

const ROUTER_SYSTEM_PROMPT = `You are a task classifier for an LLM routing system. Analyze the user's message and classify it into exactly ONE category.

Categories:
- coding: Programming, debugging, code review, refactoring, technical implementation
- writing: Creative writing, essays, blog posts, emails, copywriting, translation
- analysis: Data analysis, research, summarization, comparison, evaluation
- math_reasoning: Mathematics, logic puzzles, scientific calculations, formal proofs
- image_multimodal: Image analysis, generation descriptions, visual content
- large_document: Processing documents over 50K tokens, long text analysis
- general: Casual conversation, simple questions, factual lookups, brainstorming

Respond with ONLY a JSON object in this exact format:
{"category": "<category>", "reasoning": "<brief explanation>"}`;

/**
 * Router model fallback chain for classification.
 * Priority: cheapest models with good classification accuracy.
 */
const ROUTER_MODELS = [
  { provider: "google" as const, model: "gemini-2.5-flash", endpoint: "google" },
  { provider: "deepseek" as const, model: "deepseek-chat", endpoint: "https://api.deepseek.com/chat/completions" },
  { provider: "openai" as const, model: "gpt-4.1-mini", endpoint: "https://api.openai.com/v1/chat/completions" },
];

export async function classifyTask(
  userMessage: string,
  apiKeys: ApiKeys
): Promise<{ category: TaskCategory; reasoning: string }> {
  // Try each router model in priority order
  for (const router of ROUTER_MODELS) {
    const apiKey = apiKeys[router.provider];
    if (!apiKey) continue;

    try {
      let content: string;

      if (router.endpoint === "google") {
        // Google Gemini API format
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${router.model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: userMessage }] }],
              systemInstruction: { parts: [{ text: ROUTER_SYSTEM_PROMPT }] },
              generationConfig: { maxOutputTokens: 100, temperature: 0 },
            }),
            signal: AbortSignal.timeout(10_000),
          }
        );
        if (!response.ok) continue;
        const data = (await response.json()) as GoogleGenerateContentResponse;
        content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") || "";
      } else {
        // OpenAI-compatible API format
        const response = await fetch(router.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: router.model,
            messages: [
              { role: "system", content: ROUTER_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
            max_tokens: 100,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) continue;
        const data = await response.json();
        content = data.choices[0]?.message?.content || "";
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          category: parsed.category as TaskCategory,
          reasoning: parsed.reasoning,
        };
      }
    } catch {
      // Try next model
      continue;
    }
  }

  // Final fallback: keyword-based classification
  return classifyByKeywords(userMessage);
}

function classifyByKeywords(message: string): {
  category: TaskCategory;
  reasoning: string;
} {
  const lower = message.toLowerCase();

  // English patterns use \b word boundaries; Korean patterns use lookahead/lookbehind-free matching
  // since \b doesn't work with CJK characters.
  const patterns: [RegExp, TaskCategory, string][] = [
    [/\b(code|function|bug|debug|refactor|implement|api|class|import|export|async|await|const|let|var|def |return|if\s*\(|for\s*\(|while\s*\()\b/i, "coding", "Contains programming keywords"],
    [/(?:\b(write|essay|blog|article|email|story|poem|translate|draft)\b|(편지|글쓰기|작성|번역))/i, "writing", "Contains writing-related keywords"],
    [/(?:\b(analyze|compare|summarize|research|evaluate)\b|(분석|비교|요약|평가))/i, "analysis", "Contains analysis keywords"],
    [/(?:\b(calculate|math|equation|prove|theorem|integral|derivative)\b|(수학|계산|증명))/i, "math_reasoning", "Contains math/reasoning keywords"],
    [/(?:\b(image|photo|picture|visual)\b|(이미지|사진|그림))/i, "image_multimodal", "Contains image/visual keywords"],
    [/(?:\b(document|pdf|file|paper)\b|(논문|문서|파일))/i, "large_document", "Contains document keywords"],
  ];

  for (const [pattern, category, reasoning] of patterns) {
    if (pattern.test(lower)) {
      return { category, reasoning };
    }
  }

  return { category: "general", reasoning: "No specific category detected" };
}

export function selectModel(
  category: TaskCategory,
  apiKeys: ApiKeys,
  preferredTier?: "budget" | "mid" | "premium"
): ModelConfig {
  const ranked = selectModelsRanked(category, apiKeys, preferredTier);
  return ranked[0];
}

/**
 * Returns all candidate models ranked by preference for the given category.
 * Used for fallback: if the first model fails, try the next one.
 */
export function selectModelsRanked(
  category: TaskCategory,
  apiKeys: ApiKeys,
  preferredTier?: "budget" | "mid" | "premium"
): ModelConfig[] {
  // Get models that are best for this category AND have API keys
  const availableModels = AVAILABLE_MODELS.filter(
    (m) => m.bestFor.includes(category) && apiKeys[m.provider]
  );

  if (availableModels.length === 0) {
    // Fallback: any model with an API key
    const anyAvailable = AVAILABLE_MODELS.filter((m) => apiKeys[m.provider]);
    if (anyAvailable.length === 0) {
      throw new Error("No API keys configured. Please add at least one API key in Settings.");
    }
    return anyAvailable;
  }

  // If preferred tier specified, sort preferred tier first
  if (preferredTier) {
    const preferred = availableModels.filter((m) => m.tier === preferredTier);
    const rest = availableModels.filter((m) => m.tier !== preferredTier);
    return [...preferred, ...rest];
  }

  // For general tasks, sort by cost (cheapest first)
  if (category === "general") {
    return [...availableModels].sort(
      (a, b) => a.outputCostPer1M - b.outputCostPer1M
    );
  }

  // For specialized tasks, rank by category-specific optimal order
  const CATEGORY_PRIORITY: Record<string, string[]> = {
    coding: ["claude-sonnet", "gpt-4.1", "claude-haiku", "deepseek-r1", "gemini-2.5-pro", "gpt-4.1-mini", "gemini-2.5-flash", "gpt-5.2", "deepseek-v3"],
    writing: ["gpt-4.1", "gpt-5.2", "gpt-4.1-mini", "claude-sonnet", "claude-haiku", "gemini-2.5-flash", "deepseek-v3"],
    analysis: ["claude-sonnet", "gpt-4.1", "gemini-2.5-pro", "gpt-5.2", "gpt-4.1-mini", "deepseek-v3", "gemini-2.5-flash"],
    math_reasoning: ["deepseek-r1", "claude-sonnet", "gemini-2.5-pro", "gemini-2.5-flash", "gpt-4.1"],
    image_multimodal: ["gemini-2.5-flash", "gemini-2.5-pro", "gpt-5.2", "gpt-4.1"],
    large_document: ["gemini-2.5-pro", "gemini-2.5-flash", "grok-4-fast", "gpt-4.1", "claude-sonnet"],
  };

  const priority = CATEGORY_PRIORITY[category];
  if (priority) {
    return [...availableModels].sort((a, b) => {
      const aIdx = priority.indexOf(a.id);
      const bIdx = priority.indexOf(b.id);
      const aPrio = aIdx === -1 ? 999 : aIdx;
      const bPrio = bIdx === -1 ? 999 : bIdx;
      return aPrio - bPrio;
    });
  }

  return availableModels;
}

export async function route(
  userMessage: string,
  apiKeys: ApiKeys
): Promise<RouterResult> {
  const { category, reasoning } = await classifyTask(userMessage, apiKeys);
  const selectedModel = selectModel(category, apiKeys);

  return {
    category,
    selectedModel,
    reasoning,
  };
}
