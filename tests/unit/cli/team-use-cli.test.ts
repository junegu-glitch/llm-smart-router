/**
 * Tests for team mode CLI — zero-cost ($0) path via --use-cli flag
 *
 * Verifies that when teammates return viaCLI results (cost: 0):
 * - Total team cost rolls up to $0
 * - Sessions are saved with totalCost: 0
 * - Preset fast-path is preserved with CLI mode
 * - Mixed (CLI + API) runs sum costs correctly
 * - Single-model fallback (needsTeam: false) still works
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ALL_KEYS } from "../../fixtures/mock-api-keys.js";
import type { LeaderPlan, TeammatePlan, Task, TeammateResult } from "../../../src/cli/team-types.js";

// ─── Mocks ───

vi.mock("../../../src/cli/leader.js", () => ({
  analyzeAndPlan: vi.fn(),
  synthesizeResults: vi.fn(),
  setLeaderModel: vi.fn(),
}));

vi.mock("../../../src/cli/teammate.js", () => ({
  runTeammatesParallel: vi.fn(),
}));

vi.mock("../../../src/cli/output.js", () => ({
  renderMarkdown: vi.fn((text: string) => text),
  printError: vi.fn(),
}));

vi.mock("../../../src/cli/live-display.js", () => ({
  LiveDashboard: class MockLiveDashboard {
    addTeammate = vi.fn();
    render = vi.fn();
    updateStatus = vi.fn();
    finalize = vi.fn();
  },
}));

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
import { saveTeamSession } from "../../../src/cli/team-session.js";
import { getPreset } from "../../../src/cli/presets.js";

// ─── Fixtures ───

const claudeSonnetModel = {
  id: "claude-sonnet",
  name: "Claude Sonnet 4",
  provider: "anthropic" as const,
  apiModel: "claude-sonnet-4-20250514",
  inputCostPer1M: 3,
  outputCostPer1M: 15,
  contextWindow: 200_000,
  bestFor: ["coding" as const],
  tier: "premium" as const,
};

const geminiFlashModel = {
  id: "gemini-2.5-flash",
  name: "Gemini 2.5 Flash",
  provider: "google" as const,
  apiModel: "gemini-2.5-flash",
  inputCostPer1M: 0.6,
  outputCostPer1M: 2.4,
  contextWindow: 1_000_000,
  bestFor: ["analysis" as const],
  tier: "budget" as const,
};

const sampleTeammates: TeammatePlan[] = [
  { name: "Coder", role: "Write code", category: "coding", modelId: "claude-sonnet", taskIds: ["t1"] },
  { name: "Analyst", role: "Analyze approach", category: "analysis", modelId: "gemini-2.5-flash", taskIds: ["t2"] },
];

const sampleTasks: Task[] = [
  { id: "t1", title: "Implement feature", description: "Build it", assignee: "Coder", status: "pending", dependencies: [] },
  { id: "t2", title: "Analyze tradeoffs", description: "Assess it", assignee: "Analyst", status: "pending", dependencies: [] },
];

const samplePlan: LeaderPlan = {
  analysis: "Need coder and analyst",
  teammates: sampleTeammates,
  tasks: sampleTasks,
  reasoning: "Parallel specialists",
};

/** All teammates completed via CLI — cost: 0 each */
function makeCliResults(): TeammateResult[] {
  return [
    {
      name: "Coder",
      role: "Write code",
      model: claudeSonnetModel,
      tasks: [{ taskId: "t1", title: "Implement feature", result: "Here is code...", inputTokens: 100, outputTokens: 200, cost: 0, model: "claude-sonnet (via CLI)" }],
      status: "done",
      totalCost: 0,
    },
    {
      name: "Analyst",
      role: "Analyze approach",
      model: geminiFlashModel,
      tasks: [{ taskId: "t2", title: "Analyze tradeoffs", result: "Analysis complete...", inputTokens: 80, outputTokens: 150, cost: 0, model: "gemini-2.5-flash (via CLI)" }],
      status: "done",
      totalCost: 0,
    },
  ];
}

/** Mixed: Coder via CLI ($0), Analyst via API ($0.002) */
function makeMixedResults(): TeammateResult[] {
  return [
    {
      name: "Coder",
      role: "Write code",
      model: claudeSonnetModel,
      tasks: [{ taskId: "t1", title: "Implement feature", result: "Code...", inputTokens: 100, outputTokens: 200, cost: 0, model: "claude-sonnet (via CLI)" }],
      status: "done",
      totalCost: 0,
    },
    {
      name: "Analyst",
      role: "Analyze approach",
      model: geminiFlashModel,
      tasks: [{ taskId: "t2", title: "Analyze tradeoffs", result: "Analysis...", inputTokens: 80, outputTokens: 150, cost: 0.002, model: "Gemini 2.5 Flash" }],
      status: "done",
      totalCost: 0.002,
    },
  ];
}

// ─── Setup / Teardown ───

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-cli" });
  vi.stubGlobal("fetch", vi.fn()); // should NOT be called in CLI-mode tests
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Tests ───

describe("runTeam — --use-cli zero-cost path", () => {
  describe("all teammates via CLI ($0 total)", () => {
    it("totalCost is 0 when all teammates run via CLI", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: samplePlan,
        cost: 0,        // leader also via CLI
        needsTeam: true,
      });
      vi.mocked(runTeammatesParallel).mockResolvedValue(makeCliResults());
      vi.mocked(synthesizeResults).mockResolvedValue({ synthesis: "Synthesis done.", cost: 0 });

      const result = await runTeam("Build a feature", ALL_KEYS, { interactive: false });

      expect(result.totalCost).toBe(0);
      expect(result.status).toBe("done");
    });

    it("saves session with totalCost: 0 for --use-cli run", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({ plan: samplePlan, cost: 0, needsTeam: true });
      vi.mocked(runTeammatesParallel).mockResolvedValue(makeCliResults());
      vi.mocked(synthesizeResults).mockResolvedValue({ synthesis: "Done.", cost: 0 });

      await runTeam("Build a feature", ALL_KEYS, { interactive: false });

      expect(saveTeamSession).toHaveBeenCalledOnce();
      const savedSession = vi.mocked(saveTeamSession).mock.calls[0][0];
      expect(savedSession.totalCost).toBe(0);
    });
  });

  describe("preset fast-path with CLI mode", () => {
    it("skips leader planning when preset is provided (even with CLI mode)", async () => {
      vi.mocked(getPreset).mockReturnValue({
        id: "code-review",
        name: "Code Review",
        description: "Review code",
        build: vi.fn().mockReturnValue({ teammates: sampleTeammates, tasks: sampleTasks }),
      });
      vi.mocked(runTeammatesParallel).mockResolvedValue(makeCliResults());
      vi.mocked(synthesizeResults).mockResolvedValue({ synthesis: "Review done.", cost: 0 });

      const result = await runTeam("Review the auth module", ALL_KEYS, {
        preset: "code-review",
        interactive: false,
      });

      expect(analyzeAndPlan).not.toHaveBeenCalled();
      expect(result.status).toBe("done");
      expect(result.totalCost).toBe(0);
    });
  });

  describe("mixed CLI + API run", () => {
    it("sums costs correctly when one teammate uses CLI and another uses API", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({ plan: samplePlan, cost: 0, needsTeam: true });
      vi.mocked(runTeammatesParallel).mockResolvedValue(makeMixedResults());
      vi.mocked(synthesizeResults).mockResolvedValue({ synthesis: "Mixed done.", cost: 0.001 });

      const result = await runTeam("Mixed task", ALL_KEYS, { interactive: false });

      // 0 (Coder via CLI) + 0.002 (Analyst via API) + 0.001 (synthesis) = 0.003
      expect(result.totalCost).toBeCloseTo(0.003);
    });
  });

  describe("single-model path (needsTeam: false)", () => {
    it("returns without spawning teammates when leader decides no team is needed", async () => {
      vi.mocked(analyzeAndPlan).mockResolvedValue({
        plan: { analysis: "Simple question", teammates: [], tasks: [], reasoning: "No team needed" },
        cost: 0,
        needsTeam: false,
      });

      const result = await runTeam("What is 2+2?", ALL_KEYS, { interactive: false });

      expect(runTeammatesParallel).not.toHaveBeenCalled();
      expect(result.teammates).toHaveLength(0);
    });
  });
});
