/**
 * Type definitions for the multi-model agent team system.
 *
 * The team follows a leader-teammate pattern inspired by Claude Code Agent Teams,
 * but each teammate can use a different AI model (multi-vendor).
 */

import { ModelConfig, TaskCategory } from "../lib/types.js";

// ─── Team ───

export interface Team {
  id: string;
  userRequest: string;
  leader: LeaderPlan;
  teammates: TeammateResult[];
  tasks: Task[];
  synthesis: string | null;
  status: TeamStatus;
  totalCost: number;
  startedAt: number;
  completedAt: number | null;
}

export type TeamStatus =
  | "planning"      // Leader is analyzing the request
  | "running"       // Teammates are working in parallel
  | "synthesizing"  // Leader is combining results
  | "done"          // All complete
  | "failed";       // Unrecoverable error

// ─── Leader ───

export interface LeaderPlan {
  analysis: string;
  teammates: TeammatePlan[];
  tasks: Task[];
  reasoning: string;
}

export interface TeammatePlan {
  name: string;
  role: string;
  category: TaskCategory;
  modelId: string;
  taskIds: string[];
}

// ─── Teammate ───

export interface TeammateResult {
  name: string;
  role: string;
  model: ModelConfig;
  tasks: TaskResult[];
  status: "idle" | "working" | "done" | "error";
  error?: string;
  totalCost: number;
}

// ─── Tasks ───

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee?: string;         // Teammate name
  status: "pending" | "in_progress" | "done" | "failed";
  dependencies: string[];    // Task IDs that must complete first
}

export interface TaskResult {
  taskId: string;
  title: string;
  result: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}

// ─── Leader LLM response schemas ───

export interface LeaderAnalysisResponse {
  needs_team: boolean;
  reasoning: string;
  teammates: {
    name: string;
    role: string;
    category: string;
    model_preference: string;
  }[];
  tasks: {
    id: string;
    title: string;
    description: string;
    assignee: string;
    dependencies: string[];
  }[];
}

export interface LeaderSynthesisResponse {
  summary: string;
  key_findings: string[];
  recommendations: string[];
  detailed_report: string;
}
