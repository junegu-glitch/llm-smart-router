/**
 * Terminal Output Formatting
 * Renders LLM responses with colors and markdown in the terminal
 */

import chalk from "chalk";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AVAILABLE_MODELS } from "../lib/models.js";
import { TaskCategory, ModelConfig } from "../lib/types.js";

// Setup marked with terminal renderer
const marked = new Marked(markedTerminal() as never);

const CATEGORY_COLORS: Record<TaskCategory, (s: string) => string> = {
  coding: chalk.blue,
  writing: chalk.green,
  analysis: chalk.magenta,
  math_reasoning: chalk.yellow,
  image_multimodal: chalk.cyan,
  large_document: chalk.hex("#FFA500"),
  general: chalk.gray,
};

const PROVIDER_COLORS: Record<string, (s: string) => string> = {
  anthropic: chalk.hex("#D4A574"),
  openai: chalk.hex("#74AA9C"),
  deepseek: chalk.hex("#4D6BFE"),
  google: chalk.hex("#4285F4"),
  xai: chalk.white,
  mistral: chalk.hex("#FF7000"),
};

export function printRouteInfo(
  model: ModelConfig,
  category: TaskCategory,
  reasoning: string
): void {
  const categoryColor = CATEGORY_COLORS[category] || chalk.white;
  const providerColor = PROVIDER_COLORS[model.provider] || chalk.white;

  console.log(
    chalk.dim("  Route: ") +
    categoryColor(`[${category}]`) +
    chalk.dim(" → ") +
    providerColor(model.name) +
    chalk.dim(` ($${model.inputCostPer1M}/$${model.outputCostPer1M} per 1M)`)
  );
  console.log(chalk.dim(`  Reason: ${reasoning}`));
  console.log();
}

export function printCostSummary(
  model: ModelConfig,
  inputTokens: number,
  outputTokens: number,
  cost: number
): void {
  console.log();
  console.log(
    chalk.dim("  ─────────────────────────────────────────")
  );
  console.log(
    chalk.dim("  Tokens: ") +
    chalk.white(`${inputTokens} in / ${outputTokens} out`) +
    chalk.dim("  Cost: ") +
    chalk.green(`$${cost.toFixed(6)}`) +
    chalk.dim(`  Model: `) +
    chalk.white(model.name)
  );
}

export function renderMarkdown(content: string): string {
  try {
    const rendered = marked.parse(content);
    if (typeof rendered === "string") {
      return rendered;
    }
    return content;
  } catch {
    return content;
  }
}

export function printWelcome(): void {
  console.log();
  console.log(chalk.bold("  LLM Smart Router") + chalk.dim(" — Multi-model AI in your terminal"));
  console.log(chalk.dim("  Your message is automatically routed to the best AI model."));
  console.log(chalk.dim("  Type 'exit' or Ctrl+C to quit. 'help' for commands."));
  console.log();
}

export function printHelp(): void {
  console.log();
  console.log(chalk.bold("  Commands:"));
  console.log(chalk.dim("  exit") + "           Quit the session");
  console.log(chalk.dim("  clear") + "          Clear conversation history");
  console.log(chalk.dim("  cost") + "           Show session cost summary");
  console.log(chalk.dim("  models") + "         List available models");
  console.log(chalk.dim("  config") + "         Show config file path");
  console.log();
}

export function printModels(apiKeys: Record<string, string | undefined>): void {
  console.log();
  console.log(chalk.bold("  Available Models:"));
  for (const model of AVAILABLE_MODELS) {
    const hasKey = apiKeys[model.provider];
    const status = hasKey ? chalk.green("  ✓ ") : chalk.red("  ✗ ");
    const providerColor = PROVIDER_COLORS[model.provider] || chalk.white;
    console.log(
      status +
      providerColor(model.name.padEnd(20)) +
      chalk.dim(`${model.tier.padEnd(8)} $${model.outputCostPer1M}/1M out`)
    );
  }
  console.log();
}

export function printError(message: string): void {
  console.error(chalk.red(`  Error: ${message}`));
}

export function printNoKeys(): void {
  console.log();
  console.log(chalk.yellow("  No API keys configured."));
  console.log(chalk.dim("  Run: ") + chalk.white("smart-router config set <provider> <key>"));
  console.log(chalk.dim("  Example: ") + chalk.white("smart-router config set deepseek sk-xxx"));
  console.log(chalk.dim("  Providers: deepseek, anthropic, openai, google, xai, mistral"));
  console.log();
}
