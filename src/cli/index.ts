#!/usr/bin/env node

/**
 * LLM Smart Router CLI
 * Route your messages to the best AI model from the terminal.
 */

import { Command } from "commander";
import { createInterface } from "readline";
import chalk from "chalk";
import ora from "ora";
import {
  getApiKeys,
  setApiKey,
  removeApiKey,
  hasAnyApiKey,
  getConfigPath,
} from "./config.js";
import {
  printRouteInfo,
  printCostSummary,
  renderMarkdown,
  printWelcome,
  printHelp,
  printError,
  printNoKeys,
} from "./output.js";
import { classifyTask, selectModelsRanked } from "../lib/router.js";
import { callLLM, calculateCost, enableCLIMode } from "../lib/llm-client.js";
import { AVAILABLE_MODELS } from "../lib/models.js";
import { ModelConfig, TaskCategory } from "../lib/types.js";
import { runTeam } from "./team.js";
import { listTeamSessions, loadTeamSession, getSessionsDir } from "./team-session.js";
import { listPresets } from "./presets.js";
import { buildContext } from "./git-context.js";
import { setLeaderModel } from "./leader.js";
import { detectAllCLIs, formatCLIStatus } from "../lib/cli-provider.js";

const program = new Command();

program
  .name("smart-router")
  .description("Route your messages to the best AI model")
  .version("0.1.0");

// ─── Single query mode ───
program
  .argument("[message...]", "Message to send (or use --interactive)")
  .option("-i, --interactive", "Start interactive REPL mode")
  .option("-m, --model <model>", "Force a specific model (e.g. claude-sonnet, gpt-5.2)")
  .option("-t, --tier <tier>", "Preferred tier: budget, mid, premium")
  .option("-v, --verbose", "Show routing details")
  .option("--use-cli", "Use CLI binaries (Claude/Gemini) instead of API when available (uses subscription tokens)")
  .action(async (messageParts: string[], options) => {
    if (options.useCli) {
      enableCLIMode();
      if (options.verbose) {
        const clis = await detectAllCLIs();
        console.log(chalk.dim("  CLI hybrid mode — detected subscriptions:"));
        console.log(chalk.dim(formatCLIStatus(clis)));
      }
    }
    if (options.interactive || messageParts.length === 0) {
      await interactiveMode(options);
    } else {
      const message = messageParts.join(" ");
      await singleQuery(message, options);
    }
  });

// ─── Config subcommand ───
const configCmd = program
  .command("config")
  .description("Manage API keys and settings");

configCmd
  .command("set <provider> <key>")
  .description("Set an API key for a provider")
  .action((provider: string, key: string) => {
    const validProviders = ["deepseek", "anthropic", "openai", "google", "xai", "mistral"];
    if (!validProviders.includes(provider)) {
      printError(`Invalid provider: ${provider}. Valid: ${validProviders.join(", ")}`);
      process.exit(1);
    }
    setApiKey(provider, key);
    console.log(chalk.green(`  ✓ API key for ${provider} saved.`));
  });

configCmd
  .command("remove <provider>")
  .description("Remove an API key")
  .action((provider: string) => {
    removeApiKey(provider);
    console.log(chalk.yellow(`  ✓ API key for ${provider} removed.`));
  });

configCmd
  .command("show")
  .description("Show current configuration")
  .action(() => {
    const keys = getApiKeys();
    console.log();
    console.log(chalk.bold("  Configuration:"));
    console.log(chalk.dim(`  Config file: ${getConfigPath()}`));
    console.log();

    const providers = ["deepseek", "anthropic", "openai", "google", "xai", "mistral"] as const;
    for (const p of providers) {
      const key = keys[p];
      if (key) {
        const masked = key.slice(0, 8) + "..." + key.slice(-4);
        console.log(chalk.green("  ✓ ") + chalk.white(p.padEnd(12)) + chalk.dim(masked));
      } else {
        console.log(chalk.red("  ✗ ") + chalk.dim(p));
      }
    }
    console.log();
  });

// ─── Team subcommand ───
const teamCmd = program
  .command("team")
  .description("Multi-model agent team commands");

teamCmd
  .command("run <message...>")
  .description("Run a multi-model agent team on a complex task")
  .option("-v, --verbose", "Show detailed task breakdown and routing")
  .option("-c, --context <text>", "Additional context for the team")
  .option("-p, --preset <preset>", "Use a preset team template (code-review, debug, explain, refactor)")
  .option("--git-diff [ref]", "Include git diff as context (optional: ref like HEAD~3 or branch name)")
  .option("-f, --file <paths...>", "Include file contents as context")
  .option("--leader-model <model>", "Override leader model (e.g., deepseek-v3, gemini-2.5-flash)")
  .option("--use-cli", "Use CLI binaries (Claude/Gemini) for teammates when available")
  .option("--no-interactive", "Disable interactive post-run menu")
  .action(async (messageParts: string[], options) => {
    // Set leader model override if specified
    if (options.leaderModel) {
      setLeaderModel(options.leaderModel);
    }

    // Enable CLI hybrid mode
    if (options.useCli) {
      enableCLIMode();
    }

    const apiKeys = getApiKeys();
    if (!hasAnyApiKey()) {
      printNoKeys();
      return;
    }

    // Leader needs at least one cheap model (Gemini Flash, DeepSeek, or GPT-4.1 mini)
    if (!options.preset && !apiKeys.google && !apiKeys.deepseek && !apiKeys.openai) {
      printError("Team leader needs at least one API key (Google, DeepSeek, or OpenAI). Run: smart-router config set <provider> <key>");
      return;
    }

    // Build context from git/files
    const context = buildContext({
      gitDiff: options.gitDiff,
      files: options.file,
      extraContext: options.context,
    });

    const message = messageParts.join(" ");
    await runTeam(message, apiKeys, {
      verbose: options.verbose,
      context: context || undefined,
      interactive: options.interactive,
      preset: options.preset,
    });
  });

// Allow `smart-router team "message"` as shortcut for `smart-router team run "message"`
teamCmd
  .argument("[message...]", "Shortcut: same as 'team run <message>'")
  .action(async (messageParts: string[], options) => {
    if (messageParts.length === 0) {
      teamCmd.help();
      return;
    }

    const apiKeys = getApiKeys();
    if (!hasAnyApiKey()) {
      printNoKeys();
      return;
    }

    if (!apiKeys.google && !apiKeys.deepseek && !apiKeys.openai) {
      printError("Team leader needs at least one API key (Google, DeepSeek, or OpenAI). Run: smart-router config set <provider> <key>");
      return;
    }

    const message = messageParts.join(" ");
    await runTeam(message, apiKeys, {
      verbose: options.verbose,
      context: options.context,
      interactive: true,
    });
  });

teamCmd
  .command("presets")
  .description("List available team preset templates")
  .action(() => {
    const presets = listPresets();
    console.log();
    console.log(chalk.bold("  Available Team Presets:"));
    console.log();

    for (const p of presets) {
      console.log(
        chalk.cyan(`  ${p.id.padEnd(14)}`) +
        chalk.white(p.name.padEnd(24)) +
        chalk.dim(p.description)
      );
    }

    console.log();
    console.log(chalk.dim("  Usage: smart-router team run --preset <name> \"your message\""));
    console.log(chalk.dim("  With git: smart-router team run --preset code-review --git-diff \"Review changes\""));
    console.log();
  });

teamCmd
  .command("sessions")
  .description("List saved team sessions")
  .action(() => {
    const sessions = listTeamSessions();

    if (sessions.length === 0) {
      console.log();
      console.log(chalk.dim("  No saved sessions yet."));
      console.log(chalk.dim(`  Sessions directory: ${getSessionsDir()}`));
      console.log();
      return;
    }

    console.log();
    console.log(chalk.bold("  Saved Team Sessions:"));
    console.log();

    sessions.forEach((s, i) => {
      console.log(
        chalk.dim(`  [${i + 1}] `) +
        chalk.white(s.request) +
        chalk.dim(`  ${s.teammateCount} teammates  `) +
        chalk.green(`$${s.cost.toFixed(4)}`) +
        chalk.dim(`  ${s.date}`)
      );
    });

    console.log();
    console.log(chalk.dim(`  Use: smart-router team review <number> to view details`));
    console.log();
  });

teamCmd
  .command("review <query>")
  .description("Review a saved team session (by number, filename, or partial ID)")
  .action((query: string) => {
    const team = loadTeamSession(query);

    if (!team) {
      printError(`Session not found: ${query}`);
      console.log(chalk.dim("  Run 'smart-router team sessions' to see available sessions."));
      return;
    }

    console.log();
    console.log(chalk.bold("  Team Session Review"));
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log(chalk.dim("  Request: ") + chalk.white(team.userRequest));
    console.log(chalk.dim("  Status: ") + chalk.white(team.status));
    console.log(chalk.dim("  Cost: ") + chalk.green(`$${team.totalCost.toFixed(6)}`));
    console.log(
      chalk.dim("  Time: ") +
      chalk.white(`${(((team.completedAt ?? Date.now()) - team.startedAt) / 1000).toFixed(1)}s`)
    );
    console.log();

    if (team.teammates.length > 0) {
      console.log(chalk.bold("  Teammates:"));
      for (const t of team.teammates) {
        const statusIcon = t.status === "done" ? chalk.green("✓") : chalk.red("✗");
        console.log(
          chalk.dim("  ") + statusIcon +
          chalk.dim(" ") +
          chalk.white(t.name.padEnd(16)) +
          chalk.dim(t.model.name.padEnd(22)) +
          chalk.green(`$${t.totalCost.toFixed(6)}`)
        );
      }
      console.log();
    }

    if (team.synthesis) {
      console.log(chalk.bold("  ═══════════════════════════════════════════"));
      console.log(chalk.bold("  Synthesis:"));
      console.log(chalk.bold("  ═══════════════════════════════════════════"));
      console.log();
      const rendered = renderMarkdown(team.synthesis);
      process.stdout.write(rendered);
    }

    console.log();
  });

// ─── Models subcommand ───
program
  .command("models")
  .description("List available models and their status")
  .action(() => {
    const keys = getApiKeys();
    console.log();
    console.log(chalk.bold("  Available Models:"));
    console.log();

    const PROVIDER_COLORS: Record<string, (s: string) => string> = {
      anthropic: chalk.hex("#D4A574"),
      openai: chalk.hex("#74AA9C"),
      deepseek: chalk.hex("#4D6BFE"),
      google: chalk.hex("#4285F4"),
      xai: chalk.white,
      mistral: chalk.hex("#FF7000"),
    };

    for (const model of AVAILABLE_MODELS) {
      const hasKey = keys[model.provider];
      const status = hasKey ? chalk.green("  ✓ ") : chalk.red("  ✗ ");
      const providerColor = PROVIDER_COLORS[model.provider] || chalk.white;
      console.log(
        status +
        providerColor(model.name.padEnd(22)) +
        chalk.dim(`${model.tier.padEnd(9)}`) +
        chalk.dim(`$${model.outputCostPer1M.toString().padEnd(6)}/1M out  `) +
        chalk.dim(model.bestFor.join(", "))
      );
    }
    console.log();
  });

// ─── Serve subcommand ───
program
  .command("serve")
  .description("Start the web UI locally, powered by your CLI subscriptions ($0 cost)")
  .option("-p, --port <port>", "Port to serve on", "3000")
  .option("--no-open", "Don't auto-open browser")
  .action(async (options) => {
    const { spawn } = await import("child_process");
    const { resolve } = await import("path");

    console.log();
    console.log(chalk.bold("  🚀 LLM Smart Router — Local Server Mode"));
    console.log(chalk.dim("  Using CLI subscriptions instead of API keys ($0 cost)"));
    console.log();

    // Detect installed CLIs
    const spinner = ora({ text: "Detecting CLI tools...", indent: 2 }).start();
    const clis = await detectAllCLIs();
    spinner.stop();

    const available = Object.entries(clis).filter(([, s]) => s.installed);
    if (available.length === 0) {
      printError("No CLI tools detected. Install at least one of: claude, gemini, codex");
      console.log(chalk.dim("  Install Claude: npm i -g @anthropic-ai/claude-cli"));
      console.log(chalk.dim("  Install Gemini: npm i -g @google/gemini-cli"));
      console.log(chalk.dim("  Install Codex:  npm i -g @openai/codex"));
      console.log();
      process.exit(1);
    }

    console.log(chalk.dim(formatCLIStatus(clis)));
    console.log();

    const port = options.port;
    const projectRoot = resolve(import.meta.dirname, "../..");

    console.log(chalk.dim(`  Starting server on http://localhost:${port} ...`));
    console.log();

    const child = spawn("npx", ["next", "dev", "--port", port], {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        USE_CLI: "true",
        PORT: port,
      },
    });

    // Auto-open browser after a short delay
    if (options.open !== false) {
      setTimeout(async () => {
        const { exec } = await import("child_process");
        const url = `http://localhost:${port}`;
        const openCmd = process.platform === "darwin" ? "open"
          : process.platform === "win32" ? "start"
          : "xdg-open";
        exec(`${openCmd} ${url}`);
      }, 3000);
    }

    child.on("close", (code) => {
      process.exit(code ?? 0);
    });

    // Forward signals for clean shutdown
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        child.kill(signal);
      });
    }
  });

// ─── Core logic ───

async function singleQuery(
  message: string,
  options: { model?: string; tier?: string; verbose?: boolean }
): Promise<{ model: ModelConfig; inputTokens: number; outputTokens: number; cost: number } | null> {
  const apiKeys = getApiKeys();
  if (!hasAnyApiKey()) {
    printNoKeys();
    return null;
  }

  // Route
  const spinner = ora({ text: "Routing to best model...", indent: 2 }).start();

  let model: ModelConfig;
  let category: TaskCategory;
  let reasoning: string;

  try {
    if (options.model) {
      // Force specific model
      const found = AVAILABLE_MODELS.find((m) => m.id === options.model || m.name.toLowerCase() === options.model!.toLowerCase());
      if (!found) {
        spinner.fail("Model not found: " + options.model);
        return null;
      }
      if (!apiKeys[found.provider]) {
        spinner.fail(`No API key for ${found.provider}. Run: smart-router config set ${found.provider} <key>`);
        return null;
      }
      model = found;
      category = "general";
      reasoning = "Manually selected model";
    } else {
      const classification = await classifyTask(message, apiKeys);
      category = classification.category;
      reasoning = classification.reasoning;

      const tier = options.tier as "budget" | "mid" | "premium" | undefined;
      const ranked = selectModelsRanked(category, apiKeys, tier);
      model = ranked[0];
    }

    spinner.stop();

    if (options.verbose) {
      printRouteInfo(model, category, reasoning);
    } else {
      console.log(
        chalk.dim("  → ") +
        chalk.white(model.name) +
        chalk.dim(` [${category}]`)
      );
      console.log();
    }
  } catch (err) {
    spinner.fail("Routing failed");
    printError(err instanceof Error ? err.message : "Unknown error");
    return null;
  }

  // Call LLM
  const llmSpinner = ora({ text: `Waiting for ${model.name}...`, indent: 2 }).start();

  try {
    const result = await callLLM(
      model,
      [{ role: "user", content: message }],
      apiKeys
    );

    llmSpinner.stop();

    // Render markdown
    const rendered = renderMarkdown(result.content);
    process.stdout.write(rendered);

    // Cost
    const cost = calculateCost(model, result.inputTokens, result.outputTokens);
    printCostSummary(model, result.inputTokens, result.outputTokens, cost);

    return { model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, cost };
  } catch (err) {
    llmSpinner.fail("LLM call failed");
    printError(err instanceof Error ? err.message : "Unknown error");
    return null;
  }
}

async function interactiveMode(options: { model?: string; tier?: string; verbose?: boolean }): Promise<void> {
  const apiKeys = getApiKeys();
  if (!hasAnyApiKey()) {
    printNoKeys();
    return;
  }

  printWelcome();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue("  > "),
  });

  let totalCost = 0;
  let messageCount = 0;
  const conversationHistory: { role: "user" | "assistant"; content: string }[] = [];

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    switch (input.toLowerCase()) {
      case "exit":
      case "quit":
        console.log();
        console.log(
          chalk.dim(`  Session: ${messageCount} messages, total cost: `) +
          chalk.green(`$${totalCost.toFixed(6)}`)
        );
        console.log();
        rl.close();
        return;

      case "help":
        printHelp();
        rl.prompt();
        return;

      case "clear":
        conversationHistory.length = 0;
        console.log(chalk.dim("  Conversation cleared."));
        rl.prompt();
        return;

      case "cost":
        console.log(
          chalk.dim(`  Session: ${messageCount} messages, total cost: `) +
          chalk.green(`$${totalCost.toFixed(6)}`)
        );
        rl.prompt();
        return;

      case "models": {
        const keys = getApiKeys();
        console.log();
        for (const model of AVAILABLE_MODELS) {
          const hasKey = keys[model.provider];
          const status = hasKey ? chalk.green("  ✓ ") : chalk.red("  ✗ ");
          console.log(status + chalk.white(model.name.padEnd(22)) + chalk.dim(model.bestFor.join(", ")));
        }
        console.log();
        rl.prompt();
        return;
      }

      case "config":
        console.log(chalk.dim(`  Config: ${getConfigPath()}`));
        rl.prompt();
        return;
    }

    // Send message
    conversationHistory.push({ role: "user", content: input });

    // Route
    const spinner = ora({ text: "Routing...", indent: 2 }).start();

    try {
      let model: ModelConfig;
      let category: TaskCategory;
      let reasoning: string;

      if (options.model) {
        const found = AVAILABLE_MODELS.find((m) => m.id === options.model || m.name.toLowerCase() === options.model!.toLowerCase());
        if (!found) {
          spinner.fail("Model not found");
          rl.prompt();
          return;
        }
        model = found;
        category = "general";
        reasoning = "Manually selected";
      } else {
        const classification = await classifyTask(input, apiKeys);
        category = classification.category;
        reasoning = classification.reasoning;
        const tier = options.tier as "budget" | "mid" | "premium" | undefined;
        model = selectModelsRanked(category, apiKeys, tier)[0];
      }

      spinner.stop();

      if (options.verbose) {
        printRouteInfo(model, category, reasoning);
      } else {
        console.log(
          chalk.dim("  → ") + chalk.white(model.name) + chalk.dim(` [${category}]`)
        );
        console.log();
      }

      // Call LLM with conversation history
      const llmSpinner = ora({ text: `${model.name}...`, indent: 2 }).start();
      const result = await callLLM(model, conversationHistory, apiKeys);
      llmSpinner.stop();

      conversationHistory.push({ role: "assistant", content: result.content });

      const rendered = renderMarkdown(result.content);
      process.stdout.write(rendered);

      const cost = calculateCost(model, result.inputTokens, result.outputTokens);
      totalCost += cost;
      messageCount++;

      printCostSummary(model, result.inputTokens, result.outputTokens, cost);
      console.log();
    } catch (err) {
      spinner.stop();
      printError(err instanceof Error ? err.message : "Unknown error");
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

program.parse();
