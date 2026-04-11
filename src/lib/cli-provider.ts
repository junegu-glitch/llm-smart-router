/**
 * CLI Provider — Universal Hybrid Strategy
 *
 * For users with ANY AI subscription, routes requests through their
 * installed CLI binaries instead of API calls. Uses subscription
 * tokens (cost = $0) instead of per-token API billing.
 *
 * Strategy:
 *   1. Auto-detect ALL installed CLI binaries at startup
 *   2. Map model providers → CLI binaries
 *   3. If CLI available → spawn binary → parse output → cost = $0
 *   4. If CLI unavailable or fails → fall back to direct API call
 *
 * Supported CLIs (extensible — add new entries to CLI_REGISTRY):
 *   - Claude Code: `claude -p "prompt" --output-format json`     (Anthropic subscription)
 *   - Gemini CLI:  `gemini -p "prompt" --output-format json`     (Google subscription)
 *   - Codex CLI:   `codex exec "prompt" --json`                  (OpenAI/ChatGPT subscription)
 *
 * Architecture: Data-driven registry. To add a new CLI provider,
 * just add an entry to CLI_REGISTRY — no other code changes needed.
 */

import { spawn } from "child_process";
import { ModelConfig, ModelProvider } from "./types";

// ─── Registry: Single source of truth for all CLI providers ───

export interface CLIProviderConfig {
  /** Internal identifier */
  id: string;
  /** Display name for UI */
  name: string;
  /** Binary name (must be in PATH) */
  binary: string;
  /** Which model providers this CLI can serve */
  servesProviders: ModelProvider[];
  /** How to invoke non-interactively */
  buildArgs: (prompt: string, systemPrompt?: string, modelId?: string) => string[];
  /** How to extract text content from stdout JSON */
  parseOutput: (stdout: string) => string;
  /** Version check flag */
  versionFlag: string;
}

/**
 * CLI Registry — add new CLI providers here.
 * Each entry defines how to detect, invoke, and parse a CLI binary.
 */
export const CLI_REGISTRY: CLIProviderConfig[] = [
  {
    id: "claude",
    name: "Claude Code",
    binary: "claude",
    servesProviders: ["anthropic"],
    versionFlag: "--version",
    buildArgs: (prompt, systemPrompt, modelId) => {
      const args = ["-p", prompt, "--output-format", "json", "--max-turns", "1"];
      if (systemPrompt) args.push("--append-system-prompt", systemPrompt);
      if (modelId) {
        const mapped = { "claude-sonnet": "sonnet", "claude-haiku": "haiku" }[modelId];
        if (mapped) args.push("--model", mapped);
      }
      return args;
    },
    parseOutput: (stdout) => {
      const parsed = JSON.parse(stdout);
      return parsed.result || parsed.text || stdout;
    },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    binary: "gemini",
    servesProviders: ["google"],
    versionFlag: "--version",
    buildArgs: (prompt, systemPrompt) => {
      // Gemini CLI has no --system-prompt flag, prepend to prompt
      const fullPrompt = systemPrompt
        ? `[System Instructions]: ${systemPrompt}\n\n[User]: ${prompt}`
        : prompt;
      return ["-p", fullPrompt, "--output-format", "json", "-y"];
    },
    parseOutput: (stdout) => {
      const parsed = JSON.parse(stdout);
      return parsed.response || parsed.text || stdout;
    },
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    binary: "codex",
    servesProviders: ["openai"],
    versionFlag: "--version",
    buildArgs: (prompt, systemPrompt) => {
      // Codex uses `codex exec "prompt"` for non-interactive mode
      // System prompt is prepended since no dedicated flag exists
      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${prompt}`
        : prompt;
      return ["exec", fullPrompt, "--json"];
    },
    parseOutput: (stdout) => {
      // Codex outputs JSON events that may be on one line or multiple lines.
      // Extract all JSON objects using regex, then find the text content.
      const jsonObjects: unknown[] = [];
      const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      let match;
      while ((match = jsonRegex.exec(stdout)) !== null) {
        try {
          jsonObjects.push(JSON.parse(match[0]));
        } catch {
          continue;
        }
      }

      // Look for item.completed event with agent_message text
      for (const obj of jsonObjects) {
        const o = obj as Record<string, unknown>;
        if (o.type === "item.completed") {
          const item = o.item as Record<string, unknown> | undefined;
          if (item?.text) return item.text as string;
        }
      }

      // Fallback: any object with message.content, text, or content
      for (const obj of jsonObjects) {
        const o = obj as Record<string, unknown>;
        if (o.message && (o.message as Record<string, unknown>).content) {
          return (o.message as Record<string, unknown>).content as string;
        }
        if (o.text) return o.text as string;
        if (o.content) return o.content as string;
      }

      // Last resort: return raw stdout
      return stdout;
    },
  },
  // ─── Add new CLI providers here ───
  // {
  //   id: "grok",
  //   name: "Grok CLI",
  //   binary: "grok",
  //   servesProviders: ["xai"],
  //   versionFlag: "--version",
  //   buildArgs: (prompt, systemPrompt) => [...],
  //   parseOutput: (stdout) => ...,
  // },
];

// ─── Types ───

export type CLIProviderId = string;

export interface CLIResult {
  content: string;
  success: boolean;
  providerId?: string;
  error?: string;
}

export interface CLIStatus {
  installed: boolean;
  config: CLIProviderConfig;
  version?: string;
}

// ─── Detection ───

const cliStatusCache = new Map<string, CLIStatus>();

/**
 * Check if a specific CLI binary is installed and accessible.
 * Results are cached for the process lifetime.
 */
export async function detectCLI(providerId: string): Promise<CLIStatus> {
  const cached = cliStatusCache.get(providerId);
  if (cached) return cached;

  const config = CLI_REGISTRY.find((c) => c.id === providerId);
  if (!config) {
    const status: CLIStatus = {
      installed: false,
      config: { id: providerId, name: providerId, binary: providerId, servesProviders: [], versionFlag: "--version", buildArgs: () => [], parseOutput: (s) => s },
    };
    return status;
  }

  try {
    const version = await runCommand(config.binary, [config.versionFlag], 5000);
    const status: CLIStatus = {
      installed: true,
      config,
      version: version.trim().split("\n")[0],
    };
    cliStatusCache.set(providerId, status);
    return status;
  } catch {
    const status: CLIStatus = { installed: false, config };
    cliStatusCache.set(providerId, status);
    return status;
  }
}

/**
 * Detect ALL registered CLIs and return their status.
 * This tells us exactly which subscriptions the user has available.
 */
export async function detectAllCLIs(): Promise<Record<string, CLIStatus>> {
  const results = await Promise.all(
    CLI_REGISTRY.map(async (config) => {
      const status = await detectCLI(config.id);
      return [config.id, status] as const;
    })
  );
  return Object.fromEntries(results);
}

/**
 * Find the CLI provider that can serve a given model.
 * Returns null if no CLI can serve this model's provider.
 */
export function getCliConfigForModel(model: ModelConfig): CLIProviderConfig | null {
  return CLI_REGISTRY.find((c) => c.servesProviders.includes(model.provider)) || null;
}

/**
 * @deprecated Use getCliConfigForModel instead. Kept for backward compatibility.
 */
export function getCliProviderForModel(model: ModelConfig): string | null {
  const config = getCliConfigForModel(model);
  return config?.id || null;
}

// ─── Execution ───

/**
 * Call a model through its CLI binary.
 * Uses the registry to determine how to invoke and parse.
 */
export async function callViaCLI(
  providerId: string,
  prompt: string,
  systemPrompt?: string,
  options: {
    model?: string;
    timeoutMs?: number;
    cwd?: string;
  } = {}
): Promise<CLIResult> {
  const config = CLI_REGISTRY.find((c) => c.id === providerId);
  if (!config) {
    return { content: "", success: false, error: `Unknown CLI provider: ${providerId}` };
  }

  const timeoutMs = options.timeoutMs || 120_000;
  const args = config.buildArgs(prompt, systemPrompt, options.model);

  try {
    const output = await runCommand(config.binary, args, timeoutMs, options.cwd);
    const content = config.parseOutput(output);

    return {
      content,
      success: true,
      providerId: config.id,
    };
  } catch (err) {
    return {
      content: "",
      success: false,
      providerId: config.id,
      error: err instanceof Error ? err.message : `${config.name} CLI failed`,
    };
  }
}

/**
 * Get a human-readable summary of all detected CLIs.
 * Useful for --verbose output.
 */
export function formatCLIStatus(statuses: Record<string, CLIStatus>): string {
  return Object.values(statuses)
    .map((s) => {
      const icon = s.installed ? "✓" : "✗";
      const version = s.version ? ` ${s.version}` : "";
      const providers = s.config.servesProviders.join(", ");
      return `  ${icon} ${s.config.name}${version} → ${providers || "none"}`;
    })
    .join("\n");
}

// ─── Helpers ───

function runCommand(
  binary: string,
  args: string[],
  timeoutMs: number,
  cwd?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`CLI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `CLI exited with code ${code}: ${stderr || stdout}`.slice(0, 500)
          )
        );
      }
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ─── Clear cache (for testing) ───

export function _clearCLICache(): void {
  cliStatusCache.clear();
}
