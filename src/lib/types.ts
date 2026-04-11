export type ModelProvider = "deepseek" | "anthropic" | "openai" | "google" | "xai" | "mistral";

export type TaskCategory =
  | "coding"
  | "writing"
  | "analysis"
  | "math_reasoning"
  | "image_multimodal"
  | "large_document"
  | "general";

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  apiModel: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  bestFor: TaskCategory[];
  tier: "budget" | "mid" | "premium";
}

export interface ApiKeys {
  deepseek?: string;
  anthropic?: string;
  openai?: string;
  google?: string;
  xai?: string;
  mistral?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  provider?: ModelProvider;
  category?: TaskCategory;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface RouterResult {
  category: TaskCategory;
  selectedModel: ModelConfig;
  reasoning: string;
}

export interface UsageStats {
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  costByProvider: Record<ModelProvider, number>;
  costByCategory: Record<TaskCategory, number>;
}
