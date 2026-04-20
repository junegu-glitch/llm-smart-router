/**
 * Tests for src/lib/llm-client.ts
 *
 * - calculateCost: pure function, no mocking needed
 * - callLLM: needs fetch mocking for API call tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateCost, callLLM } from "../../../src/lib/llm-client.js";
import { AVAILABLE_MODELS, getModelById } from "../../../src/lib/models.js";
import { ALL_KEYS } from "../../fixtures/mock-api-keys.js";

describe("calculateCost", () => {
  it("should calculate cost correctly for Claude Sonnet", () => {
    const model = getModelById("claude-sonnet")!;
    // 1000 input tokens + 500 output tokens
    const cost = calculateCost(model, 1000, 500);
    const expected = (1000 / 1_000_000) * 3.0 + (500 / 1_000_000) * 15.0;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it("should calculate cost correctly for DeepSeek V3 (cheapest)", () => {
    const model = getModelById("deepseek-v3")!;
    const cost = calculateCost(model, 10000, 5000);
    const expected = (10000 / 1_000_000) * 0.14 + (5000 / 1_000_000) * 0.28;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it("should return 0 for 0 tokens", () => {
    const model = getModelById("claude-sonnet")!;
    expect(calculateCost(model, 0, 0)).toBe(0);
  });

  it("should handle large token counts", () => {
    const model = getModelById("claude-sonnet")!;
    const cost = calculateCost(model, 1_000_000, 1_000_000);
    const expected = 3.0 + 15.0; // exactly 1M of each
    expect(cost).toBeCloseTo(expected, 5);
  });

  it("should always be non-negative", () => {
    for (const model of AVAILABLE_MODELS) {
      expect(calculateCost(model, 100, 100)).toBeGreaterThanOrEqual(0);
    }
  });

  it("should show DeepSeek V3 is much cheaper than Claude Sonnet", () => {
    const deepseek = getModelById("deepseek-v3")!;
    const claude = getModelById("claude-sonnet")!;
    const tokens = { input: 10000, output: 5000 };

    const deepseekCost = calculateCost(deepseek, tokens.input, tokens.output);
    const claudeCost = calculateCost(claude, tokens.input, tokens.output);

    // DeepSeek should be at least 10x cheaper for output
    expect(claudeCost / deepseekCost).toBeGreaterThan(10);
  });

  it("should calculate realistic team run overhead cost", () => {
    // Leader model (Gemini Flash): ~2K input, ~1K output for planning
    const gemini = getModelById("gemini-2.5-flash")!;
    const planCost = calculateCost(gemini, 2000, 1000);
    const synthCost = calculateCost(gemini, 5000, 2000);
    const totalOverhead = planCost + synthCost;

    // Leader overhead should be under $0.01 per team run
    expect(totalOverhead).toBeLessThan(0.01);
  });
});

describe("callLLM", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should call OpenAI-compatible endpoint for DeepSeek", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello from DeepSeek" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }),
    });

    const model = getModelById("deepseek-v3")!;
    const result = await callLLM(
      model,
      [{ role: "user", content: "Hello" }],
      ALL_KEYS
    );

    expect(result.content).toBe("Hello from DeepSeek");
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(20);

    // Verify it called DeepSeek endpoint
    expect(fetchMock).toHaveBeenCalledOnce();
    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toContain("api.deepseek.com");
  });

  it("should call Anthropic endpoint for Claude", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Hello from Claude" }],
        usage: { input_tokens: 15, output_tokens: 25 },
      }),
    });

    const model = getModelById("claude-sonnet")!;
    const result = await callLLM(
      model,
      [
        { role: "system", content: "Be helpful" },
        { role: "user", content: "Hello" },
      ],
      ALL_KEYS
    );

    expect(result.content).toBe("Hello from Claude");
    expect(result.inputTokens).toBe(15);
    expect(result.outputTokens).toBe(25);

    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toContain("api.anthropic.com");
  });

  it("should call Google endpoint for Gemini", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 18 },
      }),
    });

    const model = getModelById("gemini-2.5-flash")!;
    const result = await callLLM(
      model,
      [{ role: "user", content: "Hello" }],
      ALL_KEYS
    );

    expect(result.content).toBe("Hello from Gemini");
    expect(result.inputTokens).toBe(12);
    expect(result.outputTokens).toBe(18);

    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toContain("generativelanguage.googleapis.com");
  });

  it("should throw when no API key for provider", async () => {
    const model = getModelById("claude-sonnet")!;
    await expect(
      callLLM(model, [{ role: "user", content: "Hi" }], { deepseek: "key" })
    ).rejects.toThrow(/No API key/);
  });

  it("should throw on API error response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    const model = getModelById("deepseek-v3")!;
    await expect(
      callLLM(model, [{ role: "user", content: "Hi" }], ALL_KEYS)
    ).rejects.toThrow(/API error \(429\)/);
  });

  it("should handle Anthropic system message extraction", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "response" }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });

    const model = getModelById("claude-sonnet")!;
    await callLLM(
      model,
      [
        { role: "system", content: "System prompt" },
        { role: "user", content: "User message" },
      ],
      ALL_KEYS
    );

    // Verify the body sent to Anthropic includes system as top-level field
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe("System prompt");
    expect(body.messages).toHaveLength(1); // Only user message, not system
    expect(body.messages[0].content).toBe("User message");
  });
});
