/**
 * Tests for src/cli/leader.ts
 *
 * - getLeaderModel: pure model selection logic
 * - resolveModelId: pure fallback logic
 * - analyzeAndPlan / synthesizeResults: need LLM mocking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GOOGLE_ONLY } from "../../fixtures/mock-api-keys.js";

// We test analyzeAndPlan with mocked fetch
describe("analyzeAndPlan", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockGeminiResponse(content: string) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: content }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
      }),
    });
  }

  it("should parse a valid team plan from leader LLM", async () => {
    const planJson = JSON.stringify({
      needs_team: true,
      reasoning: "This task benefits from parallel work",
      teammates: [
        { name: "Coder", role: "Write code", category: "coding", model_preference: "claude-sonnet" },
        { name: "Writer", role: "Write docs", category: "writing", model_preference: "gpt-5.2" },
      ],
      tasks: [
        { id: "t1", title: "Code it", description: "Write the code", assignee: "Coder", dependencies: [] },
        { id: "t2", title: "Doc it", description: "Write docs", assignee: "Writer", dependencies: [] },
      ],
    });

    mockGeminiResponse(planJson);

    const { analyzeAndPlan } = await import("../../../src/cli/leader.js");
    const result = await analyzeAndPlan("Build a REST API", GOOGLE_ONLY);

    expect(result.needsTeam).toBe(true);
    expect(result.plan.teammates).toHaveLength(2);
    expect(result.plan.tasks).toHaveLength(2);
    expect(result.cost).toBeGreaterThan(0);
  });

  it("should handle needs_team=false for simple questions", async () => {
    const planJson = JSON.stringify({
      needs_team: false,
      reasoning: "Simple question, no team needed",
      teammates: [],
      tasks: [],
    });

    mockGeminiResponse(planJson);

    const { analyzeAndPlan } = await import("../../../src/cli/leader.js");
    const result = await analyzeAndPlan("What is 2+2?", GOOGLE_ONLY);

    expect(result.needsTeam).toBe(false);
    expect(result.plan.teammates).toHaveLength(0);
    expect(result.plan.tasks).toHaveLength(0);
  });

  it("should handle JSON wrapped in markdown code blocks", async () => {
    const planJson = `\`\`\`json
{
  "needs_team": true,
  "reasoning": "Needs a team",
  "teammates": [{"name": "T1", "role": "R1", "category": "coding", "model_preference": "claude-sonnet"}],
  "tasks": [{"id": "t1", "title": "Task 1", "description": "Do something", "assignee": "T1", "dependencies": []}]
}
\`\`\``;

    mockGeminiResponse(planJson);

    const { analyzeAndPlan } = await import("../../../src/cli/leader.js");
    const result = await analyzeAndPlan("Complex task", GOOGLE_ONLY);

    expect(result.needsTeam).toBe(true);
    expect(result.plan.teammates).toHaveLength(1);
  });

  it("should throw on invalid JSON response", async () => {
    mockGeminiResponse("This is not JSON at all");

    const { analyzeAndPlan } = await import("../../../src/cli/leader.js");
    await expect(
      analyzeAndPlan("Some task", GOOGLE_ONLY)
    ).rejects.toThrow(/Leader failed to produce valid JSON/);
  });

  it("should resolve model IDs to available models", async () => {
    const planJson = JSON.stringify({
      needs_team: true,
      reasoning: "Test",
      teammates: [
        { name: "Coder", role: "Code", category: "coding", model_preference: "claude-sonnet" },
      ],
      tasks: [
        { id: "t1", title: "Code", description: "Code it", assignee: "Coder", dependencies: [] },
      ],
    });

    mockGeminiResponse(planJson);

    // Only Google key available — claude-sonnet preference should fall back
    const { analyzeAndPlan } = await import("../../../src/cli/leader.js");
    const result = await analyzeAndPlan("Write code", GOOGLE_ONLY);

    // Should resolve to a Google model since that's all we have
    const teammateModelId = result.plan.teammates[0].modelId;
    // It should find some available model, not crash
    expect(teammateModelId).toBeTruthy();
  });
});

describe("synthesizeResults", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should produce a synthesis from teammate results", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: "# Final Report\n\nSynthesis of all results..." }] } },
        ],
        usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
      }),
    });

    const { synthesizeResults } = await import("../../../src/cli/leader.js");
    const result = await synthesizeResults(
      "Review the code",
      [
        {
          name: "Reviewer",
          role: "Code review",
          model: "Claude Sonnet 4",
          results: [
            { taskId: "t1", title: "Review", result: "Code looks good", inputTokens: 100, outputTokens: 200, cost: 0.01, model: "Claude Sonnet 4" },
          ],
        },
      ],
      GOOGLE_ONLY
    );

    expect(result.synthesis).toContain("Final Report");
    expect(result.cost).toBeGreaterThan(0);
  });
});
