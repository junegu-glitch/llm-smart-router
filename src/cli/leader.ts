/**
 * Leader Agent
 *
 * The leader uses a cheap, capable model (Gemini 2.5 Flash by default) to:
 * 1. Analyze the user's request and decide if a team is needed
 * 2. Plan team composition (which models for which roles)
 * 3. Break work into subtasks and assign them
 * 4. Synthesize all teammate results into a final report
 *
 * Leader model priority: Gemini Flash → DeepSeek V3 → GPT-4.1 mini → Claude Haiku
 * The leader should be cheap + smart. Gemini Flash is the sweet spot:
 * ~$0.0006 per team run, 1M context, good planning quality.
 */

import { callLLM, calculateCost } from "../lib/llm-client.js";
import { AVAILABLE_MODELS } from "../lib/models.js";
import { ApiKeys, ModelConfig } from "../lib/types.js";
import {
  LeaderAnalysisResponse,
  LeaderPlan,
  Task,
  TeammatePlan,
  TaskResult,
} from "./team-types.js";

// Leader model fallback chain: cheapest + smartest first
const LEADER_MODEL_PRIORITY = [
  "gemini-2.5-flash",  // $0.60/1M, 1M context, good quality
  "deepseek-v3",       // $0.028/1M, 164K context, decent quality
  "gpt-4.1-mini",      // $1.60/1M, 1M context, good quality
  "claude-haiku",       // $1.25/1M, 200K context, good quality
];

let overrideLeaderModelId: string | undefined;

/**
 * Set a custom leader model (e.g., via --leader-model CLI flag).
 */
export function setLeaderModel(modelId: string): void {
  overrideLeaderModelId = modelId;
}

function getLeaderModel(apiKeys: ApiKeys): ModelConfig {
  // If user explicitly set a leader model, use it
  if (overrideLeaderModelId) {
    const model = AVAILABLE_MODELS.find(
      (m) => m.id === overrideLeaderModelId && apiKeys[m.provider]
    );
    if (model) return model;
    // Fall through to priority chain if override model not available
  }

  // Try each model in priority order
  for (const modelId of LEADER_MODEL_PRIORITY) {
    const model = AVAILABLE_MODELS.find(
      (m) => m.id === modelId && apiKeys[m.provider]
    );
    if (model) return model;
  }

  // Last resort: any available model
  const any = AVAILABLE_MODELS.find((m) => apiKeys[m.provider]);
  if (any) return any;

  throw new Error("No available model for leader. Configure at least one API key.");
}

function getAvailableModelsDescription(apiKeys: ApiKeys): string {
  return AVAILABLE_MODELS
    .filter((m) => apiKeys[m.provider])
    .map((m) => `- ${m.id} (${m.name}): best for ${m.bestFor.join(", ")}. Cost: $${m.outputCostPer1M}/1M output tokens.`)
    .join("\n");
}

// ─── Step 1: Analyze and plan ───

const ANALYSIS_PROMPT = `You are a team leader for a multi-model AI agent system. Your job is to analyze a user's request and decide:

1. Whether the task needs a team (multiple agents working in parallel) or can be handled by a single model.
2. If a team is needed, plan the team composition and task breakdown.

Rules:
- Only recommend a team if the task genuinely benefits from parallel work by specialists.
- Simple questions, single-domain tasks, or short requests should NOT use a team.
- Each teammate should have a clear, independent role that doesn't overlap with others.
- Keep teams small: 2-4 teammates. More than 4 is rarely needed.

CRITICAL — Model selection rules (you MUST follow these):
- The whole point of this system is to use DIFFERENT models for different tasks based on their strengths.
- DO NOT assign the same model to all teammates. Use diverse models.
- Match each teammate's model to their task type:
  * Coding/code review/debugging tasks → prefer "claude-sonnet" (best at code) or "gpt-4.1" (strong alternative)
  * Writing/copywriting/memos/emails → prefer "gpt-4.1" or "gpt-5.2" (best at writing), or "gpt-4.1-mini" for budget writing
  * Analysis/research/data comparison → prefer "claude-sonnet" or "gemini-2.5-flash"
  * Math/logic/formal reasoning → prefer "deepseek-r1"
  * Large document processing → prefer "gemini-2.5-flash" or "gemini-2.5-pro" (1M context)
  * Simple/general subtasks → prefer "deepseek-v3" (cheapest) or "gpt-4.1-mini" (cheap + capable)
- Only use "deepseek-v3" for truly trivial subtasks. For substantive work, use specialized models.

Available models (only those with API keys configured):
{MODELS}

Respond with ONLY a JSON object:
{
  "needs_team": true/false,
  "reasoning": "why a team is or isn't needed",
  "teammates": [
    {
      "name": "short_name",
      "role": "description of what this teammate does",
      "category": "coding|writing|analysis|math_reasoning|image_multimodal|large_document|general",
      "model_preference": "model_id from the list above"
    }
  ],
  "tasks": [
    {
      "id": "task_1",
      "title": "short title",
      "description": "detailed instructions for the teammate",
      "assignee": "teammate_name",
      "dependencies": []
    }
  ]
}

If needs_team is false, teammates and tasks should be empty arrays.`;

export async function analyzeAndPlan(
  userRequest: string,
  apiKeys: ApiKeys,
  context?: string
): Promise<{ plan: LeaderPlan; needsTeam: boolean; cost: number }> {
  const leaderModel = getLeaderModel(apiKeys);
  const modelsDesc = getAvailableModelsDescription(apiKeys);

  const systemPrompt = ANALYSIS_PROMPT.replace("{MODELS}", modelsDesc);

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context) {
    messages.push({
      role: "user",
      content: `Context:\n${context}\n\nUser request:\n${userRequest}`,
    });
  } else {
    messages.push({ role: "user", content: userRequest });
  }

  const result = await callLLM(leaderModel, messages, apiKeys);
  const cost = calculateCost(leaderModel, result.inputTokens, result.outputTokens);

  let parsed: LeaderAnalysisResponse;
  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      result.content.match(/(\{[\s\S]*\})/);
    parsed = JSON.parse(jsonMatch?.[1] || result.content);
  } catch {
    throw new Error(`Leader failed to produce valid JSON plan:\n${result.content}`);
  }

  // Resolve model configs for each teammate
  const teammates: TeammatePlan[] = parsed.teammates.map((t) => ({
    name: t.name,
    role: t.role,
    category: t.category as TeammatePlan["category"],
    modelId: resolveModelId(t.model_preference, t.category, apiKeys),
    taskIds: parsed.tasks
      .filter((task) => task.assignee === t.name)
      .map((task) => task.id),
  }));

  const tasks: Task[] = parsed.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    assignee: t.assignee,
    status: "pending" as const,
    dependencies: t.dependencies || [],
  }));

  return {
    needsTeam: parsed.needs_team,
    plan: {
      analysis: parsed.reasoning,
      teammates,
      tasks,
      reasoning: parsed.reasoning,
    },
    cost,
  };
}

// ─── Step 2: Synthesize results ───

const SYNTHESIS_PROMPT = `You are a team leader synthesizing results from multiple AI teammates who worked on subtasks in parallel.

The original user request was:
{REQUEST}

Each teammate completed their assigned tasks. Their results are below.

Synthesize all results into a coherent, well-structured final report. Include:
1. A brief summary (2-3 sentences)
2. Key findings from each teammate
3. Recommendations or action items (if applicable)
4. Any conflicts or disagreements between teammates' findings

Format your response as clean markdown. Be thorough but concise.`;

export async function synthesizeResults(
  userRequest: string,
  teammateResults: { name: string; role: string; model: string; results: TaskResult[] }[],
  apiKeys: ApiKeys
): Promise<{ synthesis: string; cost: number }> {
  const leaderModel = getLeaderModel(apiKeys);

  const resultsText = teammateResults
    .map((t) => {
      const taskResults = t.results
        .map((r) => `### ${r.title}\n${r.result}`)
        .join("\n\n");
      return `## Teammate: ${t.name} (${t.role}) — Model: ${t.model}\n\n${taskResults}`;
    })
    .join("\n\n---\n\n");

  const systemPrompt = SYNTHESIS_PROMPT.replace("{REQUEST}", userRequest);

  const result = await callLLM(
    leaderModel,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: resultsText },
    ],
    apiKeys
  );

  const cost = calculateCost(leaderModel, result.inputTokens, result.outputTokens);

  return { synthesis: result.content, cost };
}

// ─── Helpers ───

function resolveModelId(
  preferred: string,
  category: string,
  apiKeys: ApiKeys
): string {
  // Try preferred model first
  const preferredModel = AVAILABLE_MODELS.find(
    (m) => m.id === preferred && apiKeys[m.provider]
  );
  if (preferredModel) return preferred;

  // Fallback: find any available model good at this category
  const fallback = AVAILABLE_MODELS.find(
    (m) => m.bestFor.includes(category as never) && apiKeys[m.provider]
  );
  if (fallback) return fallback.id;

  // Last resort: any available model
  const any = AVAILABLE_MODELS.find((m) => apiKeys[m.provider]);
  if (any) return any.id;

  throw new Error(`No available model for category: ${category}`);
}
