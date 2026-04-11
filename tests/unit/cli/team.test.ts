/**
 * Tests for src/cli/team.ts — Team Orchestrator
 *
 * Tests the full team workflow: plan → execute → synthesize,
 * including preset mode, error handling, and session saving.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ALL_KEYS } from "../../fixtures/mock-api-keys.js";
import type { LeaderPlan, TeammatePlan, Task, TeammateResult } from "../../../src/cli/team-types.js";

// ─── Mocks ───

vi.mock("../../../src/cli/leader.js", () => ({
  analyzeAndPlan: vi.fn(),
  synthesizeResults: vi.fn(),
}));

vi.mock("../../../src/cli/teammate.js", () => ({
  runTeammatesParallel: vi.fn(),
}));

vi.mock("../../../src/cli/output.js", () => ({
  renderMarkdown: vi.fn((text: string) => text),
  printError: vi.fn(),
}));

vi.mock("../../../src/cli/live-display.js", () => {
  return {
    LiveDashboard: class MockLiveDashboard {
      addTeammate = vi.fn();
      render = vi.fn();
      updateStatus = vi.fn();
      finalize = vi.fn();
    },
  };
});

vi.mock("../../../src/cli/team-session.js", () => ({
  saveTeamSession: vi.fn(() => "/mock/session/path.json"),
}));

vi.mock("../../../src/cli/presets.js", () => ({
  getPreset: vi.fn(),
}));

vi.mock("chalk", () => {
  const passthrough = (s: string) => s;
  const handler: ProxyHandler<any> = {
    get: () => new Proxy(passthrough, handler),
    apply: (_target: any, _this: any, args: any[]) => args[0],
  };
  return { default: new Proxy(passthrough, handler) };
});

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

// ─── Import after mocks ───

import { runTeam } from "../../../src/cli/team.js";
import { analyzeAndPlan, synthesizeResults } from "../../../src/cli/leader.js";
import { runTeammatesParallel } from "../../../src/cli/teammate.js";
import { printError } from "../../../src/cli/output.js";
import { saveTeamSession } from "../../../src/cli/team-session.js";
import { getPreset } from "../../../src/cli/presets.js";

// ─── Fixtures ───

const sampleTeammates: TeammatePlan[] = [
  {
    name: "Coder",
    role: "Write implementation code",
    category: "coding",
    modelId: "claude-sonnet",
    taskIds: ["t1"],
  },
  {
    name: "Reviewer",
    role: "Review code quality",
    category: "coding",
    modelId: "gpt-5.2",
    taskIds: ["t2"],
  },
];

const sampleTasks: Task[] = [
  { id: "t1", title: "Implement feature", description: "Build it", assignee: "Coder", status: "pending", dependencies: [] },
  { id: "t2", title: "Review feature", description: "Review it", assignee: "Reviewer", status: "pending", dependencies: ["t1"] },
];

const samplePlan: LeaderPlan = {
  analysis: "Need a coder and reviewer",
  teammates: sampleTeammates,
  tasks: sampleTasks,
  reasoning: "Two-person team is optimal",
};

const sampleTeammateResults: TeammateResult[] = [
  {
    name: "Coder",
    role: "Write implementation code",
    model: { id: "claude-sonnet", name: "Claude Sonnet 4", provider: "anthropic", apiModel: "claude-sonnet-4-20250514", inputCostPer1M: 3, outputCostPer1M: 15, contextWindow: 200000, bestFor: ["coding" as const], tier: "premium" as const },
    tasks: [{ taskId: "t1", title: "Implement feature", result: "Here is the code...", inputTokens: 100, outputTokens: 200, cost: 0.003, model: "Claude Sonnet 4" }],
    status: "done",
    totalCost: 0.003,
  },
  {
    name: "Reviewer",
    role: "Review code quality",
    model: { id: "gpt-5.2", name: "GPT-5.2", provider: "openai", apiModel: "gpt-5.2", inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000, bestFor: ["coding" as const], tier: "mid" as const },
    tasks: [{ taskId: "t2", title: "Review feature", result: "Code looks good...", inputTokens: 150, outputTokens: 250, cost: 0.005, model: "GPT-5.2" }],
    status: "done",
    totalCost: 0.005,
  },
];

// ─── Setup / Teardown ───

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Tests ───

describe("runTeam", () => {
  describe("preset happy path", () => {
    it("should orchestrate: preset → parallel execute → synthesis", async () => {
      // Preset returns teammates + tasks directly (skips leader planning)
      vi.mocked(getPreset).mockReturnValue({
        id: "code-review",
        name: "Code Review Team",
        description: "3-person code review",
        build: vi.fn().mockReturnValue({
          teammates: sampleTeammates,
          tasks: sampleTasks,
        }),
      });

      vi.mocked(runTeammatesParallel).mockResolvedValue(sampleTeammateResults);
      vi.mocked(synthesizeResults).mockResolvedValue({
        synthesis: "## Final Report\nEverything looks great.",
        cost: 0.001,
      });

      const result = await runTeam("Review the auth module", ALL_KEYS, {
        preset: "code-review",
        interactive: false,
      });

      expect(result.status).toBe("done");
      expect(result.id).toBe("test-uuid-1234");
      expect(result.userRequest).toBe("Review the auth module");
      expect(result.synthesis).toBe("## Final Report\nEverything looks great.");
      expect(result.teammates).toHaveLength(2);
      expect(result.totalCost).toBeGreaterThan(0);

      // Leader planning should NOT have been called (preset mode)
      expect(analyzeAndPlan).not.toHaveBeenCalled();
      // Teammates should have been executed
      expect(runTeammatesParallel).toHaveBeenCalledOnce();
      // Synthesis should have been called
      expect(synthesizeResults).toHaveBeenCalledOnce();
      // Session should have been saved
      expect(saveTeamSession).toHaveBeenCalledOnce();
    });
  });

  describe("custom query (no preset)", () => {
    it("should orchestrate: leader plan → parallel execute → synthesis", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: samplePlan,
        cost: 0.0006,
        needsTeam: true,
      });

      vi.mocked(runTeammatesParallel).mockResolvedValue(sampleTeammateResults);
      vi.mocked(synthesizeResults).mockResolvedValue({
        synthesis: "Combined analysis complete.",
        cost: 0.001,
      });

      const result = await runTeam("Explain caching layer", ALL_KEYS, {
        interactive: false,
      });

      expect(result.status).toBe("done");
      expect(result.synthesis).toBe("Combined analysis complete.");
      expect(result.leader).toEqual(samplePlan);
      expect(result.totalCost).toBeCloseTo(0.0006 + 0.003 + 0.005 + 0.001, 4);

      // Leader planning SHOULD have been called (no preset)
      expect(analyzeAndPlan).toHaveBeenCalledWith("Explain caching layer", ALL_KEYS, undefined);
      expect(runTeammatesParallel).toHaveBeenCalledOnce();
      expect(synthesizeResults).toHaveBeenCalledOnce();
    });
  });

  describe("error handling: leader fails", () => {
    it("should return failed team gracefully when leader planning throws", async () => {
      vi.mocked(analyzeAndPlan).mockRejectedValue(new Error("API rate limited"));

      const result = await runTeam("Do something", ALL_KEYS, {
        interactive: false,
      });

      expect(result.status).toBe("failed");
      expect(result.leader.reasoning).toBe("Planning failed");
      expect(result.teammates).toHaveLength(0);
      expect(result.synthesis).toBeNull();

      // Should not proceed to teammate execution
      expect(runTeammatesParallel).not.toHaveBeenCalled();
      expect(synthesizeResults).not.toHaveBeenCalled();

      // printError should have been called
      expect(printError).toHaveBeenCalledWith("API rate limited");
    });
  });

  describe("error handling: all teammates fail", () => {
    it("should still attempt synthesis with partial/empty results", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: samplePlan,
        cost: 0.0006,
        needsTeam: true,
      });

      const failedResults: TeammateResult[] = [
        {
          name: "Coder",
          role: "Write code",
          model: { id: "claude-sonnet", name: "Claude Sonnet 4", provider: "anthropic", apiModel: "claude-sonnet-4-20250514", inputCostPer1M: 3, outputCostPer1M: 15, contextWindow: 200000, bestFor: ["coding" as const], tier: "premium" as const },
          tasks: [{ taskId: "t1", title: "Implement feature", result: "Error: API failed", inputTokens: 0, outputTokens: 0, cost: 0, model: "Claude Sonnet 4" }],
          status: "error",
          error: "All models exhausted",
          totalCost: 0,
        },
        {
          name: "Reviewer",
          role: "Review code",
          model: { id: "gpt-5.2", name: "GPT-5.2", provider: "openai", apiModel: "gpt-5.2", inputCostPer1M: 2.5, outputCostPer1M: 10, contextWindow: 128000, bestFor: ["coding" as const], tier: "mid" as const },
          tasks: [{ taskId: "t2", title: "Review feature", result: "Error: timeout", inputTokens: 0, outputTokens: 0, cost: 0, model: "GPT-5.2" }],
          status: "error",
          error: "Timeout",
          totalCost: 0,
        },
      ];

      vi.mocked(runTeammatesParallel).mockResolvedValue(failedResults);
      vi.mocked(synthesizeResults).mockResolvedValue({
        synthesis: "Both teammates failed. No useful results.",
        cost: 0.001,
      });

      const result = await runTeam("Build feature", ALL_KEYS, {
        interactive: false,
      });

      // Synthesis is still attempted even with failed teammates
      expect(result.status).toBe("done");
      expect(synthesizeResults).toHaveBeenCalledOnce();
      expect(result.teammates).toHaveLength(2);
      expect(result.teammates.every((t) => t.status === "error")).toBe(true);
    });
  });

  describe("error handling: some teammates fail", () => {
    it("should synthesize successfully with partial results", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: samplePlan,
        cost: 0.0006,
        needsTeam: true,
      });

      const mixedResults: TeammateResult[] = [
        sampleTeammateResults[0], // Coder succeeds
        {
          ...sampleTeammateResults[1],
          status: "error",
          error: "Model unavailable",
          tasks: [{ taskId: "t2", title: "Review feature", result: "Error: Model unavailable", inputTokens: 0, outputTokens: 0, cost: 0, model: "GPT-5.2" }],
          totalCost: 0,
        },
      ];

      vi.mocked(runTeammatesParallel).mockResolvedValue(mixedResults);
      vi.mocked(synthesizeResults).mockResolvedValue({
        synthesis: "Partial results synthesized successfully.",
        cost: 0.001,
      });

      const result = await runTeam("Analyze module", ALL_KEYS, {
        interactive: false,
      });

      expect(result.status).toBe("done");
      expect(result.synthesis).toBe("Partial results synthesized successfully.");
      expect(result.teammates[0].status).toBe("done");
      expect(result.teammates[1].status).toBe("error");

      // synthesizeResults receives both results (successful and failed)
      expect(synthesizeResults).toHaveBeenCalledOnce();
      const synthCall = vi.mocked(synthesizeResults).mock.calls[0];
      expect(synthCall[1]).toHaveLength(2);
    });
  });

  describe("unknown preset", () => {
    it("should return a failed team when preset is not found", async () => {
      vi.mocked(getPreset).mockReturnValue(undefined);

      const result = await runTeam("Do something", ALL_KEYS, {
        preset: "nonexistent-preset",
        interactive: false,
      });

      expect(result.status).toBe("failed");
      expect(result.id).toBe("test-uuid-1234");
      expect(result.teammates).toHaveLength(0);
      expect(result.synthesis).toBeNull();
      expect(result.leader.reasoning).toBe("Unknown preset");

      // printError should have been called with helpful message
      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining("Unknown preset: nonexistent-preset")
      );

      // No further execution should happen
      expect(runTeammatesParallel).not.toHaveBeenCalled();
      expect(synthesizeResults).not.toHaveBeenCalled();
      expect(saveTeamSession).not.toHaveBeenCalled();
    });
  });

  describe("context injection", () => {
    it("should pass context through to teammates via runTeammatesParallel", async () => {
      const context = "const authenticate = (user) => { ... }";

      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: samplePlan,
        cost: 0.0006,
        needsTeam: true,
      });

      vi.mocked(runTeammatesParallel).mockResolvedValue(sampleTeammateResults);
      vi.mocked(synthesizeResults).mockResolvedValue({
        synthesis: "Report with context.",
        cost: 0.001,
      });

      await runTeam("Review this code", ALL_KEYS, {
        context,
        interactive: false,
      });

      // analyzeAndPlan should receive context
      expect(analyzeAndPlan).toHaveBeenCalledWith("Review this code", ALL_KEYS, context);

      // runTeammatesParallel should receive context as 4th arg
      const parallelCall = vi.mocked(runTeammatesParallel).mock.calls[0];
      expect(parallelCall[3]).toBe(context);
    });
  });

  describe("session save", () => {
    it("should save team result to session file after completion", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: samplePlan,
        cost: 0.0006,
        needsTeam: true,
      });

      vi.mocked(runTeammatesParallel).mockResolvedValue(sampleTeammateResults);
      vi.mocked(synthesizeResults).mockResolvedValue({
        synthesis: "Final report.",
        cost: 0.001,
      });

      const result = await runTeam("Build feature", ALL_KEYS, {
        interactive: false,
      });

      expect(saveTeamSession).toHaveBeenCalledOnce();

      // Verify the saved team object matches the returned result
      const savedTeam = vi.mocked(saveTeamSession).mock.calls[0][0];
      expect(savedTeam.id).toBe(result.id);
      expect(savedTeam.userRequest).toBe("Build feature");
      expect(savedTeam.status).toBe("done");
      expect(savedTeam.synthesis).toBe("Final report.");
      expect(savedTeam.teammates).toHaveLength(2);
      expect(savedTeam.totalCost).toBe(result.totalCost);
      expect(savedTeam.startedAt).toBeLessThanOrEqual(savedTeam.completedAt!);
    });
  });
});
