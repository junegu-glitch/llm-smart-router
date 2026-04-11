/**
 * Tests for src/lib/models.ts
 * Pure functions — no mocking needed.
 */
import { describe, it, expect } from "vitest";
import {
  AVAILABLE_MODELS,
  getModelById,
  getModelsForCategory,
  getModelsByProvider,
} from "../../../src/lib/models.js";

describe("AVAILABLE_MODELS catalog", () => {
  it("should have at least 23 models", () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThanOrEqual(23);
  });

  it("should have unique model IDs", () => {
    const ids = AVAILABLE_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have all required fields for every model", () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(model.apiModel).toBeTruthy();
      expect(model.inputCostPer1M).toBeGreaterThanOrEqual(0);
      expect(model.outputCostPer1M).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.bestFor.length).toBeGreaterThan(0);
      expect(["budget", "mid", "premium"]).toContain(model.tier);
    }
  });

  it("should have at least one model per major category", () => {
    const categories = ["coding", "writing", "analysis", "math_reasoning", "general"];
    for (const cat of categories) {
      const models = AVAILABLE_MODELS.filter((m) => m.bestFor.includes(cat as never));
      expect(models.length, `No model found for category: ${cat}`).toBeGreaterThan(0);
    }
  });

  it("should have at least one model per tier", () => {
    for (const tier of ["budget", "mid", "premium"] as const) {
      const models = AVAILABLE_MODELS.filter((m) => m.tier === tier);
      expect(models.length, `No model in tier: ${tier}`).toBeGreaterThan(0);
    }
  });

  it("should have output cost >= input cost for all models", () => {
    for (const model of AVAILABLE_MODELS) {
      expect(
        model.outputCostPer1M,
        `${model.id}: output cost should be >= input cost`
      ).toBeGreaterThanOrEqual(model.inputCostPer1M);
    }
  });
});

describe("getModelById", () => {
  it("should find existing models by ID", () => {
    const model = getModelById("claude-sonnet");
    expect(model).toBeDefined();
    expect(model!.name).toBe("Claude Sonnet 4.6");
    expect(model!.provider).toBe("anthropic");
  });

  it("should return undefined for non-existent ID", () => {
    expect(getModelById("nonexistent-model")).toBeUndefined();
  });

  it("should find all models by their respective IDs", () => {
    for (const model of AVAILABLE_MODELS) {
      expect(getModelById(model.id)).toBeDefined();
      expect(getModelById(model.id)!.id).toBe(model.id);
    }
  });
});

describe("getModelsForCategory", () => {
  it("should return coding-capable models", () => {
    const codingModels = getModelsForCategory("coding");
    expect(codingModels.length).toBeGreaterThan(0);
    // Claude Sonnet should be in coding models
    expect(codingModels.some((m) => m.id === "claude-sonnet")).toBe(true);
  });

  it("should return writing-capable models", () => {
    const writingModels = getModelsForCategory("writing");
    expect(writingModels.length).toBeGreaterThan(0);
    // GPT models should be in writing models
    expect(writingModels.some((m) => m.provider === "openai")).toBe(true);
  });

  it("should return math_reasoning models", () => {
    const mathModels = getModelsForCategory("math_reasoning");
    expect(mathModels.length).toBeGreaterThan(0);
    // DeepSeek R1 should be here
    expect(mathModels.some((m) => m.id === "deepseek-r1")).toBe(true);
  });

  it("should return empty array for invalid category", () => {
    const models = getModelsForCategory("nonexistent_category");
    expect(models).toEqual([]);
  });
});

describe("getModelsByProvider", () => {
  it("should return all Anthropic models", () => {
    const models = getModelsByProvider("anthropic");
    expect(models.length).toBeGreaterThanOrEqual(3); // Haiku + Sonnet + Opus
    expect(models.every((m) => m.provider === "anthropic")).toBe(true);
  });

  it("should return all OpenAI models", () => {
    const models = getModelsByProvider("openai");
    expect(models.length).toBeGreaterThanOrEqual(6); // 4.1-nano + 4.1-mini + 5.2 + 5.3-codex + 4.1 + o4-mini + o3
    expect(models.every((m) => m.provider === "openai")).toBe(true);
  });

  it("should return all DeepSeek models", () => {
    const models = getModelsByProvider("deepseek");
    expect(models.length).toBeGreaterThanOrEqual(2); // V3 + R1
    expect(models.every((m) => m.provider === "deepseek")).toBe(true);
  });

  it("should return empty for unknown provider", () => {
    expect(getModelsByProvider("unknown")).toEqual([]);
  });
});
