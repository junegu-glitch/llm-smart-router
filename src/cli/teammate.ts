/**
 * Teammate Agent
 *
 * Each teammate is an independent worker that:
 * 1. Receives assigned tasks from the leader
 * 2. Calls the designated AI model to complete each task
 * 3. Returns results with token/cost metadata
 *
 * Teammates run in parallel via Promise.allSettled.
 */

import { callLLM, calculateCost } from "../lib/llm-client.js";
import { AVAILABLE_MODELS } from "../lib/models.js";
import { selectModelsRanked } from "../lib/router.js";
import { ApiKeys, ModelConfig, TaskCategory } from "../lib/types.js";
import { Task, TaskResult, TeammateResult, TeammatePlan } from "./team-types.js";

/** Max number of fallback models to try before giving up */
const MAX_FALLBACK_ATTEMPTS = 3;

const TEAMMATE_SYSTEM_PROMPT = `You are a specialized AI teammate working as part of a multi-model agent team.

Your role: {ROLE}
Your name: {NAME}

You have been assigned specific tasks. Complete each one thoroughly and precisely.
Focus on your area of expertise. Be detailed but concise.
If a task involves code, include well-commented code with explanations.
If a task involves analysis, provide structured findings.
If a task involves writing, produce polished output.

Important: You are one of several teammates. Other specialists are handling other aspects.
Focus only on YOUR assigned tasks — do not try to cover other teammates' work.`;

export async function runTeammate(
  plan: TeammatePlan,
  tasks: Task[],
  apiKeys: ApiKeys,
  context?: string
): Promise<TeammateResult> {
  const model = AVAILABLE_MODELS.find((m) => m.id === plan.modelId);
  if (!model) {
    return {
      name: plan.name,
      role: plan.role,
      model: AVAILABLE_MODELS[0], // fallback
      tasks: [],
      status: "error",
      error: `Model not found: ${plan.modelId}`,
      totalCost: 0,
    };
  }

  if (!apiKeys[model.provider]) {
    return {
      name: plan.name,
      role: plan.role,
      model,
      tasks: [],
      status: "error",
      error: `No API key for provider: ${model.provider}`,
      totalCost: 0,
    };
  }

  const assignedTasks = tasks.filter((t) => plan.taskIds.includes(t.id));
  const taskResults: TaskResult[] = [];
  let totalCost = 0;

  for (const task of assignedTasks) {
    try {
      const result = await executeTask(task, model, plan, apiKeys, context);
      taskResults.push(result);
      totalCost += result.cost;
    } catch (err) {
      taskResults.push({
        taskId: task.id,
        title: task.title,
        result: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        model: model.name,
      });
    }
  }

  return {
    name: plan.name,
    role: plan.role,
    model,
    tasks: taskResults,
    status: taskResults.some((t) => t.result.startsWith("Error:")) ? "error" : "done",
    totalCost,
  };
}

async function executeTask(
  task: Task,
  model: ModelConfig,
  plan: TeammatePlan,
  apiKeys: ApiKeys,
  context?: string
): Promise<TaskResult> {
  const systemPrompt = TEAMMATE_SYSTEM_PROMPT
    .replace("{ROLE}", plan.role)
    .replace("{NAME}", plan.name);

  const userContent = context
    ? `Context:\n${context}\n\nTask: ${task.title}\n\n${task.description}`
    : `Task: ${task.title}\n\n${task.description}`;

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  // Build fallback chain: primary model → category-ranked alternatives
  const fallbackModels = buildFallbackChain(model, plan.category, apiKeys);

  let lastError: Error | null = null;

  for (const candidateModel of fallbackModels) {
    try {
      const result = await callLLM(candidateModel, messages, apiKeys);
      const cost = calculateCost(candidateModel, result.inputTokens, result.outputTokens);

      return {
        taskId: task.id,
        title: task.title,
        result: result.content,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost,
        model: candidateModel.name + (candidateModel.id !== model.id ? " (fallback)" : ""),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Continue to next model in fallback chain
    }
  }

  // All models failed
  throw lastError || new Error("All fallback models failed");
}

/**
 * Build a fallback chain: preferred model first, then category-ranked alternatives.
 * Deduplicates and limits to MAX_FALLBACK_ATTEMPTS models.
 */
function buildFallbackChain(
  primaryModel: ModelConfig,
  category: string,
  apiKeys: ApiKeys
): ModelConfig[] {
  const chain: ModelConfig[] = [primaryModel];

  try {
    const ranked = selectModelsRanked(
      category as TaskCategory,
      apiKeys
    );
    for (const m of ranked) {
      if (chain.length >= MAX_FALLBACK_ATTEMPTS) break;
      if (!chain.some((c) => c.id === m.id)) {
        chain.push(m);
      }
    }
  } catch {
    // No alternative models available — just use primary
  }

  return chain;
}

/**
 * Run multiple teammates in parallel.
 * Uses Promise.allSettled so one failure doesn't block others.
 */
export async function runTeammatesParallel(
  teammates: TeammatePlan[],
  tasks: Task[],
  apiKeys: ApiKeys,
  context?: string,
  onTeammateStart?: (name: string, model: string) => void,
  onTeammateDone?: (name: string, model: string, taskCount: number, cost: number) => void,
  onTeammateError?: (name: string, error: string) => void
): Promise<TeammateResult[]> {
  const promises = teammates.map(async (plan) => {
    const model = AVAILABLE_MODELS.find((m) => m.id === plan.modelId);
    const modelName = model?.name || plan.modelId;

    onTeammateStart?.(plan.name, modelName);

    const result = await runTeammate(plan, tasks, apiKeys, context);

    if (result.status === "error") {
      onTeammateError?.(plan.name, result.error || "Unknown error");
    } else {
      onTeammateDone?.(plan.name, modelName, result.tasks.length, result.totalCost);
    }

    return result;
  });

  const settled = await Promise.allSettled(promises);

  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      name: teammates[i].name,
      role: teammates[i].role,
      model: AVAILABLE_MODELS[0],
      tasks: [],
      status: "error" as const,
      error: s.reason instanceof Error ? s.reason.message : "Unknown error",
      totalCost: 0,
    };
  });
}
