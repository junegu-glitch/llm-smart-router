/**
 * Tests for src/cli/output.ts
 *
 * Tests terminal output formatting: markdown rendering, route info, and cost summary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModelConfig } from "../../../src/lib/types.js";

// Mock marked and marked-terminal before importing the module under test
vi.mock("marked", () => {
  class MockMarked {
    parse(content: string) {
      return `rendered:${content}`;
    }
  }
  return { Marked: MockMarked };
});

vi.mock("marked-terminal", () => ({
  markedTerminal: vi.fn().mockReturnValue({}),
}));

import {
  renderMarkdown,
  printRouteInfo,
  printCostSummary,
} from "../../../src/cli/output.js";

const mockModel: ModelConfig = {
  id: "test-model",
  name: "Test Model",
  provider: "openai",
  apiModel: "test-model",
  inputCostPer1M: 1.0,
  outputCostPer1M: 2.0,
  tier: "mid",
  contextWindow: 128000,
  bestFor: ["coding"],
};

describe("renderMarkdown", () => {
  it("should render plain text and code blocks via marked", () => {
    const result = renderMarkdown("hello world");
    expect(typeof result).toBe("string");
    expect(result).toContain("hello world");
  });
});

describe("printRouteInfo", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log model name, category, and reasoning", () => {
    printRouteInfo(mockModel, "coding", "Best for code tasks");

    expect(console.log).toHaveBeenCalled();

    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((call: unknown[]) => call.join(" "))
      .join("\n");

    expect(allOutput).toContain("Test Model");
    expect(allOutput).toContain("coding");
    expect(allOutput).toContain("Best for code tasks");
  });
});

describe("printCostSummary", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log cost with dollar sign and token counts", () => {
    printCostSummary(mockModel, 500, 200, 0.001234);

    expect(console.log).toHaveBeenCalled();

    const allOutput = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((call: unknown[]) => call.join(" "))
      .join("\n");

    expect(allOutput).toContain("$0.001234");
    expect(allOutput).toContain("500 in / 200 out");
    expect(allOutput).toContain("Test Model");
  });
});
