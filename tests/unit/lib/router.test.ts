/**
 * Tests for src/lib/router.ts
 *
 * - classifyByKeywords: pure function, no mocking
 * - selectModel / selectModelsRanked: pure logic, tested with mock API keys
 * - classifyTask: needs fetch mocking (tested separately)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectModel, selectModelsRanked } from "../../../src/lib/router.js";
import { ALL_KEYS, BUDGET_KEYS, PREMIUM_KEYS, ANTHROPIC_ONLY, NO_KEYS } from "../../fixtures/mock-api-keys.js";

// We need to test classifyByKeywords which is not exported.
// Import the module and test it indirectly via classifyTask with no API keys (falls back to keywords).
// OR we can test it via the route function with mocked fetch that always fails.

describe("selectModelsRanked", () => {
  describe("coding category", () => {
    it("should prefer Claude Sonnet for coding when all keys available", () => {
      const ranked = selectModelsRanked("coding", ALL_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].id).toBe("claude-sonnet");
    });

    it("should fall back to available models when Anthropic key missing", () => {
      const ranked = selectModelsRanked("coding", BUDGET_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
      // Should still find coding-capable models
      expect(ranked[0].bestFor).toContain("coding");
    });
  });

  describe("writing category", () => {
    it("should prefer GPT-4.1 for writing when all keys available", () => {
      const ranked = selectModelsRanked("writing", ALL_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].id).toBe("gpt-4.1");
    });

    it("should fall back when OpenAI key missing", () => {
      const ranked = selectModelsRanked("writing", ANTHROPIC_ONLY);
      expect(ranked.length).toBeGreaterThan(0);
      // Should find some writing-capable model
    });
  });

  describe("math_reasoning category", () => {
    it("should prefer DeepSeek R1 for math", () => {
      const ranked = selectModelsRanked("math_reasoning", ALL_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].id).toBe("deepseek-r1");
    });

    it("should fall back to Claude Sonnet when DeepSeek unavailable", () => {
      const ranked = selectModelsRanked("math_reasoning", PREMIUM_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
      // Should still find math-capable model
      expect(ranked[0].bestFor).toContain("math_reasoning");
    });
  });

  describe("general category", () => {
    it("should sort by cost (cheapest first) for general tasks", () => {
      const ranked = selectModelsRanked("general", ALL_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
      // Verify cost ordering
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i].outputCostPer1M).toBeGreaterThanOrEqual(
          ranked[i - 1].outputCostPer1M
        );
      }
    });

    it("should use DeepSeek V3 as cheapest for general", () => {
      const ranked = selectModelsRanked("general", ALL_KEYS);
      expect(ranked[0].id).toBe("deepseek-v3");
    });
  });

  describe("tier preference", () => {
    it("should prioritize budget tier when requested", () => {
      const ranked = selectModelsRanked("coding", ALL_KEYS, "budget");
      const budgetIdx = ranked.findIndex((m) => m.tier === "budget");
      const premiumIdx = ranked.findIndex((m) => m.tier === "premium");
      if (budgetIdx !== -1 && premiumIdx !== -1) {
        expect(budgetIdx).toBeLessThan(premiumIdx);
      }
    });

    it("should prioritize premium tier when requested", () => {
      const ranked = selectModelsRanked("coding", ALL_KEYS, "premium");
      const premiumIdx = ranked.findIndex((m) => m.tier === "premium");
      const budgetIdx = ranked.findIndex((m) => m.tier === "budget");
      if (premiumIdx !== -1 && budgetIdx !== -1) {
        expect(premiumIdx).toBeLessThan(budgetIdx);
      }
    });
  });

  describe("edge cases", () => {
    it("should throw when no API keys configured", () => {
      expect(() => selectModelsRanked("coding", NO_KEYS)).toThrow(
        /No API keys configured/
      );
    });

    it("should fall back to any model for unknown category", () => {
      // "image_multimodal" with only budget keys
      const ranked = selectModelsRanked("image_multimodal", BUDGET_KEYS);
      expect(ranked.length).toBeGreaterThan(0);
    });
  });
});

describe("selectModel", () => {
  it("should return the top-ranked model", () => {
    const model = selectModel("coding", ALL_KEYS);
    const ranked = selectModelsRanked("coding", ALL_KEYS);
    expect(model.id).toBe(ranked[0].id);
  });

  it("should throw when no keys available", () => {
    expect(() => selectModel("coding", NO_KEYS)).toThrow();
  });
});

// Test keyword classification via classifyTask fallback
describe("classifyByKeywords (via classifyTask fallback)", () => {
  // Mock global fetch to always fail, forcing keyword fallback
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );
  });

  // We need to dynamically import classifyTask to use the mocked fetch
  async function classifyViaKeywords(message: string) {
    const { classifyTask } = await import("../../../src/lib/router.js");
    return classifyTask(message, ALL_KEYS);
  }

  it("should classify coding keywords", async () => {
    const result = await classifyViaKeywords("Fix the bug in my function");
    expect(result.category).toBe("coding");
  });

  it("should classify writing keywords", async () => {
    const result = await classifyViaKeywords("Write me a blog post about AI");
    expect(result.category).toBe("writing");
  });

  it("should classify math keywords", async () => {
    const result = await classifyViaKeywords("Calculate the integral of x^2");
    expect(result.category).toBe("math_reasoning");
  });

  it("should classify analysis keywords", async () => {
    const result = await classifyViaKeywords("Analyze this data and compare");
    expect(result.category).toBe("analysis");
  });

  it("should classify image keywords", async () => {
    const result = await classifyViaKeywords("Describe this image for me");
    expect(result.category).toBe("image_multimodal");
  });

  it("should classify Korean keywords", async () => {
    const result1 = await classifyViaKeywords("이 문서를 번역해줘");
    expect(result1.category).toBe("writing");

    const result2 = await classifyViaKeywords("이 데이터를 분석해줘");
    expect(result2.category).toBe("analysis");

    const result3 = await classifyViaKeywords("수학 문제 풀어줘");
    expect(result3.category).toBe("math_reasoning");
  });

  it("should default to general for ambiguous messages", async () => {
    const result = await classifyViaKeywords("What should I eat for lunch?");
    expect(result.category).toBe("general");
  });

  it("should default to general for empty messages", async () => {
    const result = await classifyViaKeywords("");
    expect(result.category).toBe("general");
  });
});
