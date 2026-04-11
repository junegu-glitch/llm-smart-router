/**
 * Tests for src/lib/cli-provider.ts
 *
 * Tests CLI detection, model mapping, registry architecture, and execution.
 * All spawn calls are mocked — no real CLI binaries needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cp from "child_process";
import {
  CLI_REGISTRY,
  detectCLI,
  detectAllCLIs,
  getCliConfigForModel,
  getCliProviderForModel,
  callViaCLI,
  formatCLIStatus,
  _clearCLICache,
} from "../../../src/lib/cli-provider.js";
import { getModelById } from "../../../src/lib/models.js";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

function mockSpawnSuccess(stdout: string) {
  const mockProc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  };

  mockProc.stdout.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
    if (event === "data") cb(Buffer.from(stdout));
  });
  mockProc.stderr.on.mockImplementation(() => {});
  mockProc.on.mockImplementation((event: string, cb: (code: number) => void) => {
    if (event === "close") setTimeout(() => cb(0), 0);
  });

  (cp.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);
  return mockProc;
}

function mockSpawnFailure(stderr: string, code: number = 1) {
  const mockProc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  };

  mockProc.stdout.on.mockImplementation(() => {});
  mockProc.stderr.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
    if (event === "data") cb(Buffer.from(stderr));
  });
  mockProc.on.mockImplementation((event: string, cb: (code: number) => void) => {
    if (event === "close") setTimeout(() => cb(code), 0);
  });

  (cp.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);
}

function mockSpawnError(errorMessage: string) {
  const mockProc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  };

  mockProc.stdout.on.mockImplementation(() => {});
  mockProc.stderr.on.mockImplementation(() => {});
  mockProc.on.mockImplementation((event: string, cb: (err: Error) => void) => {
    if (event === "error") setTimeout(() => cb(new Error(errorMessage)), 0);
  });

  (cp.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockProc);
}

beforeEach(() => {
  _clearCLICache();
  vi.clearAllMocks();
});

// ─── Registry Architecture ───

describe("CLI_REGISTRY", () => {
  it("should have at least 3 providers (Claude, Gemini, Codex)", () => {
    expect(CLI_REGISTRY.length).toBeGreaterThanOrEqual(3);
  });

  it("should have unique IDs", () => {
    const ids = CLI_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have unique binary names", () => {
    const bins = CLI_REGISTRY.map((c) => c.binary);
    expect(new Set(bins).size).toBe(bins.length);
  });

  it("should cover Anthropic, Google, and OpenAI providers", () => {
    const allProviders = CLI_REGISTRY.flatMap((c) => c.servesProviders);
    expect(allProviders).toContain("anthropic");
    expect(allProviders).toContain("google");
    expect(allProviders).toContain("openai");
  });

  it("should have buildArgs and parseOutput functions for each", () => {
    for (const config of CLI_REGISTRY) {
      expect(typeof config.buildArgs).toBe("function");
      expect(typeof config.parseOutput).toBe("function");
    }
  });
});

// ─── Model → CLI Mapping ───

describe("getCliConfigForModel", () => {
  it("should map Anthropic models → Claude CLI", () => {
    const config = getCliConfigForModel(getModelById("claude-sonnet")!);
    expect(config).toBeDefined();
    expect(config!.id).toBe("claude");
  });

  it("should map Google models → Gemini CLI", () => {
    const config = getCliConfigForModel(getModelById("gemini-2.5-flash")!);
    expect(config).toBeDefined();
    expect(config!.id).toBe("gemini");
  });

  it("should map OpenAI models → Codex CLI", () => {
    const config = getCliConfigForModel(getModelById("gpt-4.1")!);
    expect(config).toBeDefined();
    expect(config!.id).toBe("codex");
  });

  it("should map o3 → Codex CLI", () => {
    const config = getCliConfigForModel(getModelById("o3")!);
    expect(config).toBeDefined();
    expect(config!.id).toBe("codex");
  });

  it("should return null for DeepSeek (no CLI yet)", () => {
    expect(getCliConfigForModel(getModelById("deepseek-v3")!)).toBeNull();
  });

  it("should return null for xAI/Grok (no CLI yet)", () => {
    expect(getCliConfigForModel(getModelById("grok-4-fast")!)).toBeNull();
  });
});

describe("getCliProviderForModel (backward compat)", () => {
  it("should return string ID for Claude", () => {
    expect(getCliProviderForModel(getModelById("claude-sonnet")!)).toBe("claude");
  });

  it("should return null for unsupported providers", () => {
    expect(getCliProviderForModel(getModelById("deepseek-v3")!)).toBeNull();
  });
});

// ─── Detection ───

describe("detectCLI", () => {
  it("should detect Claude CLI", async () => {
    mockSpawnSuccess("1.0.33 (Claude Code)");
    const status = await detectCLI("claude");
    expect(status.installed).toBe(true);
    expect(status.config.id).toBe("claude");
    expect(status.version).toBe("1.0.33 (Claude Code)");
  });

  it("should detect Gemini CLI", async () => {
    mockSpawnSuccess("1.0.5");
    const status = await detectCLI("gemini");
    expect(status.installed).toBe(true);
    expect(status.config.id).toBe("gemini");
  });

  it("should detect Codex CLI", async () => {
    mockSpawnSuccess("0.1.2025");
    const status = await detectCLI("codex");
    expect(status.installed).toBe(true);
    expect(status.config.id).toBe("codex");
  });

  it("should report not installed when binary not found", async () => {
    mockSpawnError("ENOENT");
    const status = await detectCLI("claude");
    expect(status.installed).toBe(false);
  });

  it("should cache results", async () => {
    mockSpawnSuccess("1.0.33");
    await detectCLI("claude");
    await detectCLI("claude");
    expect(cp.spawn).toHaveBeenCalledTimes(1);
  });
});

describe("detectAllCLIs", () => {
  it("should check all registered CLIs", async () => {
    mockSpawnSuccess("1.0.0");
    const result = await detectAllCLIs();
    expect(Object.keys(result).length).toBe(CLI_REGISTRY.length);
    expect(result.claude).toBeDefined();
    expect(result.gemini).toBeDefined();
    expect(result.codex).toBeDefined();
  });
});

// ─── Build Args ───

describe("CLI buildArgs", () => {
  it("Claude: should include -p, --output-format json, --max-turns 1", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "claude")!;
    const args = config.buildArgs("Hello", "Be helpful", "claude-sonnet");
    expect(args).toContain("-p");
    expect(args).toContain("Hello");
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
    expect(args).toContain("--max-turns");
    expect(args).toContain("1");
    expect(args).toContain("--append-system-prompt");
    expect(args).toContain("Be helpful");
    expect(args).toContain("--model");
    expect(args).toContain("sonnet");
  });

  it("Gemini: should include -p, -y, prepend system prompt", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "gemini")!;
    const args = config.buildArgs("Hello", "Be helpful");
    expect(args).toContain("-p");
    expect(args).toContain("-y");
    expect(args[1]).toContain("[System Instructions]");
    expect(args[1]).toContain("Be helpful");
    expect(args[1]).toContain("Hello");
  });

  it("Codex: should use 'exec' subcommand + --json", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "codex")!;
    const args = config.buildArgs("Hello", "Be helpful");
    expect(args[0]).toBe("exec");
    expect(args).toContain("--json");
    expect(args[1]).toContain("Hello");
    expect(args[1]).toContain("Be helpful");
  });
});

// ─── Parse Output ───

describe("CLI parseOutput", () => {
  it("Claude: should extract result from JSON", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "claude")!;
    expect(config.parseOutput('{"result":"Hello from Claude"}')).toBe("Hello from Claude");
  });

  it("Gemini: should extract response from JSON", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "gemini")!;
    expect(config.parseOutput('{"response":"Hello from Gemini"}')).toBe("Hello from Gemini");
  });

  it("Codex: should extract from JSONL events", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "codex")!;
    const jsonl = '{"type":"start"}\n{"message":{"content":"Hello from Codex"}}';
    expect(config.parseOutput(jsonl)).toBe("Hello from Codex");
  });

  it("Codex: should handle plain text fallback", () => {
    const config = CLI_REGISTRY.find((c) => c.id === "codex")!;
    expect(config.parseOutput("Plain text response")).toBe("Plain text response");
  });
});

// ─── Execution ───

describe("callViaCLI", () => {
  it("should call Claude CLI correctly", async () => {
    mockSpawnSuccess(JSON.stringify({ result: "Claude response" }));
    const result = await callViaCLI("claude", "Hello", "Be helpful");
    expect(result.success).toBe(true);
    expect(result.content).toBe("Claude response");
    expect(result.providerId).toBe("claude");
  });

  it("should call Gemini CLI correctly", async () => {
    mockSpawnSuccess(JSON.stringify({ response: "Gemini response" }));
    const result = await callViaCLI("gemini", "Hello");
    expect(result.success).toBe(true);
    expect(result.content).toBe("Gemini response");
    expect(result.providerId).toBe("gemini");
  });

  it("should call Codex CLI correctly", async () => {
    mockSpawnSuccess('{"message":{"content":"Codex response"}}');
    const result = await callViaCLI("codex", "Hello");
    expect(result.success).toBe(true);
    expect(result.content).toBe("Codex response");
    expect(result.providerId).toBe("codex");
  });

  it("should return failure for unknown provider", async () => {
    const result = await callViaCLI("nonexistent", "Hello");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown CLI provider");
  });

  it("should return failure on CLI error", async () => {
    mockSpawnFailure("Error", 1);
    const result = await callViaCLI("claude", "Hello");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── Format ───

describe("formatCLIStatus", () => {
  it("should format installed and not-installed CLIs", () => {
    const statuses = {
      claude: { installed: true, config: CLI_REGISTRY[0], version: "1.0.33" },
      gemini: { installed: false, config: CLI_REGISTRY[1] },
      codex: { installed: true, config: CLI_REGISTRY[2], version: "0.1.0" },
    };

    const output = formatCLIStatus(statuses);
    expect(output).toContain("✓ Claude Code 1.0.33");
    expect(output).toContain("✗ Gemini CLI");
    expect(output).toContain("✓ OpenAI Codex 0.1.0");
    expect(output).toContain("anthropic");
    expect(output).toContain("openai");
  });
});
