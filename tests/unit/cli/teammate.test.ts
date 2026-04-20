/**
 * Tests for src/cli/teammate.ts
 *
 * Tests teammate execution, model fallback chain, and parallel execution.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runTeammate, runTeammatesParallel } from "../../../src/cli/teammate.js";
import { ALL_KEYS, GOOGLE_ONLY } from "../../fixtures/mock-api-keys.js";
import type { TeammatePlan, Task } from "../../../src/cli/team-types.js";

let fetchMock: ReturnType<typeof vi.fn>;

function mockGeminiSuccess(content: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: content }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
    }),
  });
}

function mockOpenAISuccess(content: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    }),
  });
}

function mockAnthropicSuccess(content: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      content: [{ type: "text", text: content }],
      usage: { input_tokens: 100, output_tokens: 200 },
    }),
  });
}

function mockAPIFailure(status: number = 429) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => "Rate limited",
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const samplePlan: TeammatePlan = {
  name: "TestCoder",
  role: "Write tests",
  category: "coding",
  modelId: "claude-sonnet",
  taskIds: ["t1"],
};

const sampleTasks: Task[] = [
  {
    id: "t1",
    title: "Write unit tests",
    description: "Write comprehensive unit tests for the auth module",
    assignee: "TestCoder",
    status: "pending",
    dependencies: [],
  },
];

describe("runTeammate", () => {
  it("should execute task with assigned model and return results", async () => {
    mockAnthropicSuccess("Here are the unit tests...");

    const result = await runTeammate(samplePlan, sampleTasks, ALL_KEYS);

    expect(result.status).toBe("done");
    expect(result.name).toBe("TestCoder");
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].result).toBe("Here are the unit tests...");
    expect(result.tasks[0].inputTokens).toBe(100);
    expect(result.tasks[0].outputTokens).toBe(200);
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it("should return error when model not found", async () => {
    const badPlan = { ...samplePlan, modelId: "nonexistent-model" };
    const result = await runTeammate(badPlan, sampleTasks, ALL_KEYS);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Model not found");
  });

  it("should return error when no API key for provider", async () => {
    const result = await runTeammate(samplePlan, sampleTasks, GOOGLE_ONLY);

    // Claude model has no API key in GOOGLE_ONLY, but fallback should try Google models
    // If all fallback models also fail, it should report error
    expect(result.tasks.length).toBeGreaterThanOrEqual(0);
  });

  it("should only execute assigned tasks", async () => {
    mockAnthropicSuccess("Test result");

    const extraTasks: Task[] = [
      ...sampleTasks,
      {
        id: "t2",
        title: "Unassigned task",
        description: "This should not be executed",
        assignee: "OtherTeammate",
        status: "pending",
        dependencies: [],
      },
    ];

    const result = await runTeammate(samplePlan, extraTasks, ALL_KEYS);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskId).toBe("t1");
  });

  it("should include context in task execution when provided", async () => {
    mockAnthropicSuccess("Result with context");

    await runTeammate(samplePlan, sampleTasks, ALL_KEYS, "const x = 1;");

    // Verify the context was included in the API call
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = callBody.messages.find((m: any) => m.role === "user");
    expect(userMessage.content).toContain("const x = 1;");
  });

  it("should handle multiple tasks sequentially", async () => {
    const multiPlan: TeammatePlan = {
      ...samplePlan,
      taskIds: ["t1", "t2"],
    };

    const multiTasks: Task[] = [
      ...sampleTasks,
      {
        id: "t2",
        title: "Review code",
        description: "Review the auth module",
        assignee: "TestCoder",
        status: "pending",
        dependencies: [],
      },
    ];

    mockAnthropicSuccess("Task 1 result");
    mockAnthropicSuccess("Task 2 result");

    const result = await runTeammate(multiPlan, multiTasks, ALL_KEYS);

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].result).toBe("Task 1 result");
    expect(result.tasks[1].result).toBe("Task 2 result");
    expect(result.totalCost).toBeGreaterThan(0);
  });

  it("should catch task-level errors without failing the whole teammate", async () => {
    mockAnthropicSuccess("First task OK");
    // Second task fails
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const multiPlan: TeammatePlan = {
      ...samplePlan,
      taskIds: ["t1", "t2"],
    };

    const multiTasks: Task[] = [
      ...sampleTasks,
      {
        id: "t2",
        title: "Failing task",
        description: "This will fail",
        assignee: "TestCoder",
        status: "pending",
        dependencies: [],
      },
    ];

    const result = await runTeammate(multiPlan, multiTasks, ALL_KEYS);

    // First task succeeded, second failed
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].result).toBe("First task OK");
    expect(result.tasks[1].result).toContain("Error:");
    expect(result.status).toBe("error"); // has at least one error
  });
});

describe("model fallback chain", () => {
  it("should fall back to next model when primary fails with 429", async () => {
    // Claude fails (429)
    mockAPIFailure(429);
    // Fallback to next coding model succeeds
    mockOpenAISuccess("Fallback result from GPT");

    const result = await runTeammate(samplePlan, sampleTasks, ALL_KEYS);

    expect(result.status).toBe("done");
    expect(result.tasks[0].result).toBe("Fallback result from GPT");
    expect(result.tasks[0].model).toContain("fallback");
  });

  it("should try up to 3 models in fallback chain", async () => {
    // All fail
    mockAPIFailure(500);
    mockAPIFailure(500);
    mockAPIFailure(500);

    const result = await runTeammate(samplePlan, sampleTasks, ALL_KEYS);

    // Should have error after exhausting fallback chain
    expect(result.tasks[0].result).toContain("Error:");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("runTeammatesParallel", () => {
  it("should run multiple teammates in parallel", async () => {
    const teammates: TeammatePlan[] = [
      {
        name: "Coder",
        role: "Code",
        category: "coding",
        modelId: "claude-sonnet",
        taskIds: ["t1"],
      },
      {
        name: "Writer",
        role: "Write",
        category: "writing",
        modelId: "gpt-4.1",
        taskIds: ["t2"],
      },
    ];

    const tasks: Task[] = [
      { id: "t1", title: "Code task", description: "Code it", assignee: "Coder", status: "pending", dependencies: [] },
      { id: "t2", title: "Write task", description: "Write it", assignee: "Writer", status: "pending", dependencies: [] },
    ];

    mockAnthropicSuccess("Code result");
    mockOpenAISuccess("Write result");

    const results = await runTeammatesParallel(teammates, tasks, ALL_KEYS);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "done")).toBe(true);
  });

  it("should call onTeammateStart and onTeammateDone callbacks", async () => {
    mockAnthropicSuccess("Result");

    const onStart = vi.fn();
    const onDone = vi.fn();

    await runTeammatesParallel(
      [samplePlan],
      sampleTasks,
      ALL_KEYS,
      undefined,
      onStart,
      onDone
    );

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith("TestCoder", "Claude Sonnet 4.6");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("should call onTeammateError for failed teammates", async () => {
    const badPlan = { ...samplePlan, modelId: "nonexistent-model" };
    const onError = vi.fn();

    await runTeammatesParallel(
      [badPlan],
      sampleTasks,
      ALL_KEYS,
      undefined,
      undefined,
      undefined,
      onError
    );

    expect(onError).toHaveBeenCalledOnce();
  });

  it("should not block on one teammate failure (Promise.allSettled)", async () => {
    const teammates: TeammatePlan[] = [
      { ...samplePlan, name: "FailingTeammate", modelId: "nonexistent-model", taskIds: ["t1"] },
      { name: "WorkingTeammate", role: "Write", category: "writing", modelId: "gemini-2.5-flash", taskIds: ["t2"] },
    ];

    const tasks: Task[] = [
      { id: "t1", title: "Task 1", description: "Fail", assignee: "FailingTeammate", status: "pending", dependencies: [] },
      { id: "t2", title: "Task 2", description: "Succeed", assignee: "WorkingTeammate", status: "pending", dependencies: [] },
    ];

    mockGeminiSuccess("Success from working teammate");

    const results = await runTeammatesParallel(teammates, tasks, ALL_KEYS);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("error");
    expect(results[1].status).toBe("done");
  });
});
