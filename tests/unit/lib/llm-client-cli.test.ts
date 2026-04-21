/**
 * Tests for callLLM CLI hybrid path in src/lib/llm-client.ts
 *
 * The CLI hybrid path is the zero-cost mode:
 *   enableCLIMode() → callLLM() → callViaCLI() instead of fetch
 *
 * These tests verify the branch that was previously uncovered:
 * - Global cliModeEnabled toggle routes to CLI
 * - viaCLI: true propagates to caller
 * - Cost is 0 for CLI responses (no token billing)
 * - Falls back to fetch when CLI unavailable or fails
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as cliProvider from "../../../src/lib/cli-provider.js";
import { getModelById } from "../../../src/lib/models.js";
import { ALL_KEYS } from "../../fixtures/mock-api-keys.js";

// Must mock cli-provider before importing llm-client so module-level calls are intercepted
vi.mock("../../../src/lib/cli-provider.js", () => ({
  getCliConfigForModel: vi.fn(),
  detectCLI: vi.fn(),
  callViaCLI: vi.fn(),
  detectAllCLIs: vi.fn(),
  getCliProviderForModel: vi.fn(),
  formatCLIStatus: vi.fn(),
  _clearCLICache: vi.fn(),
  CLI_REGISTRY: [],
}));

import {
  callLLM,
  calculateCost,
  enableCLIMode,
  disableCLIMode,
} from "../../../src/lib/llm-client.js";

// ─── Fixtures ───

const claudeSonnet = getModelById("claude-sonnet")!;
const messages = [
  { role: "system" as const, content: "You are a helpful assistant." },
  { role: "user" as const, content: "Write a Python quicksort." },
];

const cliConfig = {
  id: "anthropic",
  name: "Claude CLI",
  provider: "anthropic",
  cmd: "claude",
  args: ["-p"],
  models: ["claude-sonnet"],
  parseOutput: (o: string) => o,
};

function mockAnthropicFetchSuccess(content: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        content: [{ type: "text", text: content }],
        usage: { input_tokens: 50, output_tokens: 30 },
      }),
  });
}

// ─── Setup / Teardown ───

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  disableCLIMode();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  disableCLIMode();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Tests ───

describe("callLLM — CLI hybrid path", () => {
  describe("CLI mode OFF (default)", () => {
    it("calls fetch (API path) when CLI mode is disabled", async () => {
      fetchMock = mockAnthropicFetchSuccess("def quicksort(arr): ...");
      vi.stubGlobal("fetch", fetchMock);

      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      expect(result.content).toBe("def quicksort(arr): ...");
      expect(result.viaCLI).toBeFalsy();
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(cliProvider.callViaCLI).not.toHaveBeenCalled();
    });
  });

  describe("CLI mode ON", () => {
    it("calls callViaCLI instead of fetch when CLI is available", async () => {
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(cliConfig as any);
      vi.mocked(cliProvider.detectCLI).mockResolvedValue({ installed: true, version: "1.0.0", id: "anthropic" });
      vi.mocked(cliProvider.callViaCLI).mockResolvedValue({
        success: true,
        content: "def quicksort(arr): pass",
        providerId: "anthropic",
      });

      enableCLIMode();
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      expect(result.content).toBe("def quicksort(arr): pass");
      expect(result.viaCLI).toBe(true);
      expect(cliProvider.callViaCLI).toHaveBeenCalledOnce();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns viaCLI: true on successful CLI response", async () => {
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(cliConfig as any);
      vi.mocked(cliProvider.detectCLI).mockResolvedValue({ installed: true, version: "1.0.0", id: "anthropic" });
      vi.mocked(cliProvider.callViaCLI).mockResolvedValue({
        success: true,
        content: "result",
        providerId: "anthropic",
      });

      enableCLIMode();
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      expect(result.viaCLI).toBe(true);
    });

    it("reports $0 cost when viaCLI is true", async () => {
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(cliConfig as any);
      vi.mocked(cliProvider.detectCLI).mockResolvedValue({ installed: true, version: "1.0.0", id: "anthropic" });
      vi.mocked(cliProvider.callViaCLI).mockResolvedValue({
        success: true,
        content: "result",
        providerId: "anthropic",
      });

      enableCLIMode();
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      // viaCLI: true → caller should treat cost as 0
      const cost = result.viaCLI ? 0 : calculateCost(claudeSonnet, result.inputTokens, result.outputTokens);
      expect(cost).toBe(0);
    });

    it("falls back to fetch when callViaCLI returns success: false", async () => {
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(cliConfig as any);
      vi.mocked(cliProvider.detectCLI).mockResolvedValue({ installed: true, version: "1.0.0", id: "anthropic" });
      vi.mocked(cliProvider.callViaCLI).mockResolvedValue({
        success: false,
        content: "",
        providerId: "anthropic",
        error: "CLI crashed",
      });

      fetchMock = mockAnthropicFetchSuccess("fallback response");
      vi.stubGlobal("fetch", fetchMock);

      enableCLIMode();
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      // Should have fallen through to API
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.viaCLI).toBeFalsy();
      expect(result.content).toBe("fallback response");
    });

    it("falls back to fetch when no CLI config exists for the model", async () => {
      // Model has no CLI provider registered
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(null);

      fetchMock = mockAnthropicFetchSuccess("api fallback");
      vi.stubGlobal("fetch", fetchMock);

      enableCLIMode();
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.viaCLI).toBeFalsy();
      expect(cliProvider.callViaCLI).not.toHaveBeenCalled();
    });

    it("falls back to fetch when CLI binary is not installed", async () => {
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(cliConfig as any);
      vi.mocked(cliProvider.detectCLI).mockResolvedValue({ installed: false, id: "anthropic" });

      fetchMock = mockAnthropicFetchSuccess("api fallback");
      vi.stubGlobal("fetch", fetchMock);

      enableCLIMode();
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.viaCLI).toBeFalsy();
      expect(cliProvider.callViaCLI).not.toHaveBeenCalled();
    });
  });

  describe("options.useCLI override", () => {
    it("respects options.useCLI: true even when global CLI mode is off", async () => {
      vi.mocked(cliProvider.getCliConfigForModel).mockReturnValue(cliConfig as any);
      vi.mocked(cliProvider.detectCLI).mockResolvedValue({ installed: true, version: "1.0.0", id: "anthropic" });
      vi.mocked(cliProvider.callViaCLI).mockResolvedValue({
        success: true,
        content: "via-cli result",
        providerId: "anthropic",
      });

      // Global mode OFF, but options override
      const result = await callLLM(claudeSonnet, messages, ALL_KEYS, { useCLI: true });

      expect(result.viaCLI).toBe(true);
      expect(cliProvider.callViaCLI).toHaveBeenCalledOnce();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
