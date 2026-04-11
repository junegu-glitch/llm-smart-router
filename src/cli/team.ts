/**
 * Team Orchestrator
 *
 * High-level orchestration of the full team workflow:
 * 1. Leader analyzes request → produces a plan
 * 2. Live dashboard shows real-time teammate progress
 * 3. Teammates execute tasks in parallel
 * 4. Leader synthesizes all results
 * 5. Interactive post-run menu: view individual results, follow-up, save
 */

import chalk from "chalk";
import ora from "ora";
import { createInterface } from "readline";
import { ApiKeys } from "../lib/types.js";
import { callLLM, calculateCost } from "../lib/llm-client.js";
import { analyzeAndPlan, synthesizeResults } from "./leader.js";
import { runTeammatesParallel } from "./teammate.js";
import { renderMarkdown, printError } from "./output.js";
import { AVAILABLE_MODELS } from "../lib/models.js";
import { Team, TeammateResult } from "./team-types.js";
import { LiveDashboard } from "./live-display.js";
import { saveTeamSession } from "./team-session.js";
import { getPreset } from "./presets.js";

export interface TeamOptions {
  verbose?: boolean;
  context?: string;
  interactive?: boolean;
  preset?: string;
}

export async function runTeam(
  userRequest: string,
  apiKeys: ApiKeys,
  options: TeamOptions = {}
): Promise<Team> {
  const startTime = Date.now();
  let totalCost = 0;

  console.log();
  console.log(chalk.bold("  Smart Team") + chalk.dim(" — Multi-model agent team"));
  console.log(chalk.dim("  Request: ") + chalk.white(userRequest));
  if (options.preset) {
    console.log(chalk.dim("  Preset: ") + chalk.cyan(options.preset));
  }
  console.log();

  // ─── Phase 1: Plan (via preset or leader) ───

  let plan;

  if (options.preset) {
    // Use preset template — skip leader planning
    const preset = getPreset(options.preset);
    if (!preset) {
      printError(`Unknown preset: ${options.preset}. Use 'smart-router team presets' to see available presets.`);
      return {
        id: crypto.randomUUID(),
        userRequest,
        leader: { analysis: "", teammates: [], tasks: [], reasoning: "Unknown preset" },
        teammates: [],
        tasks: [],
        synthesis: null,
        status: "failed",
        totalCost,
        startedAt: startTime,
        completedAt: Date.now(),
      };
    }

    const { teammates, tasks } = preset.build(userRequest, options.context);
    plan = {
      analysis: `Preset: ${preset.name} — ${preset.description}`,
      teammates,
      tasks,
      reasoning: `Using preset template: ${preset.id}`,
    };

    console.log(
      chalk.green("  ✓ ") +
      chalk.white(`Preset "${preset.name}": ${teammates.length} teammates, ${tasks.length} tasks`) +
      chalk.dim(" (no planning cost)")
    );
  } else {
    // Leader-based planning
    const planSpinner = ora({
      text: "Leader analyzing request...",
      indent: 2,
    }).start();

    try {
      const result = await analyzeAndPlan(userRequest, apiKeys, options.context);
      plan = result.plan;
      totalCost += result.cost;

      if (!result.needsTeam) {
        planSpinner.info("Leader decided: single model is sufficient (no team needed)");
        console.log(chalk.dim(`  Reason: ${plan.reasoning}`));
        console.log(chalk.dim(`  Planning cost: $${result.cost.toFixed(6)}`));

        return {
          id: crypto.randomUUID(),
          userRequest,
          leader: plan,
          teammates: [],
          tasks: [],
          synthesis: null,
          status: "done",
          totalCost,
          startedAt: startTime,
          completedAt: Date.now(),
        };
      }

      planSpinner.succeed(
        `Leader planned: ${plan.teammates.length} teammates, ${plan.tasks.length} tasks`
      );
    } catch (err) {
      planSpinner.fail("Leader planning failed");
      printError(err instanceof Error ? err.message : "Unknown error");
      return {
        id: crypto.randomUUID(),
        userRequest,
        leader: { analysis: "", teammates: [], tasks: [], reasoning: "Planning failed" },
        teammates: [],
        tasks: [],
        synthesis: null,
        status: "failed",
        totalCost,
        startedAt: startTime,
        completedAt: Date.now(),
      };
    }
  }

  // Print team composition
  console.log();
  console.log(chalk.bold("  Team Composition:"));
  for (const t of plan.teammates) {
    const model = AVAILABLE_MODELS.find((m) => m.id === t.modelId);
    const modelName = model?.name || t.modelId;
    const taskCount = t.taskIds.length;
    console.log(
      chalk.dim("  ├─ ") +
      chalk.white(t.name.padEnd(16)) +
      chalk.cyan(modelName.padEnd(22)) +
      chalk.dim(`${taskCount} task(s)  `) +
      chalk.dim(t.role)
    );
  }
  console.log();

  if (options.verbose) {
    console.log(chalk.bold("  Task Breakdown:"));
    for (const task of plan.tasks) {
      const deps = task.dependencies.length > 0
        ? chalk.dim(` (depends on: ${task.dependencies.join(", ")})`)
        : "";
      console.log(
        chalk.dim("  ├─ ") +
        chalk.yellow(task.id.padEnd(10)) +
        chalk.white(task.title) +
        chalk.dim(` → ${task.assignee}`) +
        deps
      );
    }
    console.log();
  }

  // ─── Phase 2: Teammates work in parallel with live dashboard ───

  const dashboard = new LiveDashboard();

  // Initialize dashboard with all teammates
  for (const t of plan.teammates) {
    const model = AVAILABLE_MODELS.find((m) => m.id === t.modelId);
    dashboard.addTeammate(t.name, model?.name || t.modelId);
  }

  dashboard.render();

  const teammateResults: TeammateResult[] = await runTeammatesParallel(
    plan.teammates,
    plan.tasks,
    apiKeys,
    options.context,
    // onTeammateStart
    (name) => {
      dashboard.updateStatus(name, "running");
    },
    // onTeammateDone
    (name, _model, taskCount, cost) => {
      dashboard.updateStatus(name, "done", cost, taskCount);
    },
    // onTeammateError
    (name) => {
      dashboard.updateStatus(name, "error");
    }
  );

  dashboard.finalize();

  const teammateCost = teammateResults.reduce((sum, t) => sum + t.totalCost, 0);
  totalCost += teammateCost;

  console.log();

  // ─── Phase 3: Leader synthesizes ───

  const synthSpinner = ora({
    text: "Leader synthesizing results...",
    indent: 2,
  }).start();

  let synthesis = "";
  try {
    const synthResult = await synthesizeResults(
      userRequest,
      teammateResults.map((t) => ({
        name: t.name,
        role: t.role,
        model: t.model.name,
        results: t.tasks,
      })),
      apiKeys
    );
    synthesis = synthResult.synthesis;
    totalCost += synthResult.cost;
    synthSpinner.succeed("Leader synthesized all results");
  } catch {
    synthSpinner.fail("Synthesis failed — showing raw results");
    synthesis = teammateResults
      .map((t) => {
        const taskResults = t.tasks.map((r) => `### ${r.title}\n${r.result}`).join("\n\n");
        return `## ${t.name} (${t.role})\n\n${taskResults}`;
      })
      .join("\n\n---\n\n");
  }

  // ─── Output ───

  console.log();
  console.log(chalk.bold("  ═══════════════════════════════════════════"));
  console.log(chalk.bold("  Final Report"));
  console.log(chalk.bold("  ═══════════════════════════════════════════"));
  console.log();

  const rendered = renderMarkdown(synthesis);
  process.stdout.write(rendered);

  // ─── Cost summary ───

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log();
  console.log(chalk.dim("  ─────────────────────────────────────────"));
  console.log(chalk.bold("  Team Summary:"));
  console.log(
    chalk.dim("  Teammates: ") +
    chalk.white(String(teammateResults.length)) +
    chalk.dim("  Tasks: ") +
    chalk.white(String(plan.tasks.length)) +
    chalk.dim("  Time: ") +
    chalk.white(`${elapsed}s`)
  );

  for (const t of teammateResults) {
    const statusIcon = t.status === "done" ? chalk.green("✓") : chalk.red("✗");
    console.log(
      chalk.dim("  ") + statusIcon +
      chalk.dim(" ") +
      chalk.white(t.name.padEnd(16)) +
      chalk.dim(t.model.name.padEnd(22)) +
      chalk.green(`$${t.totalCost.toFixed(6)}`)
    );
  }

  console.log(
    chalk.dim("  Total cost: ") + chalk.green.bold(`$${totalCost.toFixed(6)}`)
  );

  // ─── Build team result ───

  const team: Team = {
    id: crypto.randomUUID(),
    userRequest,
    leader: plan,
    teammates: teammateResults,
    tasks: plan.tasks,
    synthesis,
    status: "done",
    totalCost,
    startedAt: startTime,
    completedAt: Date.now(),
  };

  // Auto-save session
  const sessionPath = saveTeamSession(team);
  console.log(chalk.dim(`  Session saved: ${sessionPath}`));
  console.log();

  // ─── Interactive post-run menu ───

  if (options.interactive !== false) {
    await postRunMenu(team, apiKeys);
  }

  return team;
}

// ─── Interactive post-run menu ───

async function postRunMenu(team: Team, apiKeys: ApiKeys): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    console.log(chalk.dim("  ─────────────────────────────────────────"));
    console.log(chalk.bold("  Post-run commands:"));
    console.log(chalk.dim("  [1-N]") + "    View teammate's raw output");
    console.log(chalk.dim("  ask") + "     Follow-up question about the results");
    console.log(chalk.dim("  exit") + "    Done");
    console.log();

    // List teammates by number
    team.teammates.forEach((t, i) => {
      console.log(
        chalk.dim(`  [${i + 1}] `) +
        chalk.white(t.name) +
        chalk.dim(` (${t.model.name})`)
      );
    });
    console.log();
  };

  prompt();

  return new Promise<void>((resolve) => {
    const askLine = () => {
      rl.question(chalk.blue("  team> "), async (input) => {
        const trimmed = input.trim().toLowerCase();

        if (trimmed === "exit" || trimmed === "quit" || trimmed === "q") {
          rl.close();
          resolve();
          return;
        }

        // View teammate by number
        const num = parseInt(trimmed);
        if (!isNaN(num) && num >= 1 && num <= team.teammates.length) {
          const teammate = team.teammates[num - 1];
          console.log();
          console.log(
            chalk.bold(`  ── ${teammate.name} `) +
            chalk.dim(`(${teammate.role}) — ${teammate.model.name}`)
          );
          console.log();

          for (const task of teammate.tasks) {
            console.log(chalk.bold(`  Task: ${task.title}`));
            console.log(chalk.dim(`  Model: ${task.model}  Cost: $${task.cost.toFixed(6)}`));
            console.log();
            const rendered = renderMarkdown(task.result);
            process.stdout.write(rendered);
            console.log();
          }

          askLine();
          return;
        }

        // Follow-up question
        if (trimmed.startsWith("ask ") || trimmed === "ask") {
          const question = trimmed === "ask" ? "" : input.trim().slice(4);

          if (!question) {
            rl.question(chalk.blue("  Question: "), async (q) => {
              await handleFollowUp(q, team, apiKeys);
              askLine();
            });
            return;
          }

          await handleFollowUp(question, team, apiKeys);
          askLine();
          return;
        }

        console.log(chalk.dim("  Unknown command. Type a number, 'ask', or 'exit'."));
        askLine();
      });
    };

    askLine();
  });
}

async function handleFollowUp(
  question: string,
  team: Team,
  apiKeys: ApiKeys
): Promise<void> {
  const spinner = ora({ text: "Thinking...", indent: 2 }).start();

  try {
    // Use cheapest available model for follow-ups
    const FOLLOWUP_PRIORITY = ["gemini-2.5-flash", "deepseek-v3", "gpt-4.1-mini", "claude-haiku"];
    let model = null;
    for (const id of FOLLOWUP_PRIORITY) {
      const candidate = AVAILABLE_MODELS.find((m) => m.id === id && apiKeys[m.provider]);
      if (candidate) { model = candidate; break; }
    }
    if (!model) {
      model = AVAILABLE_MODELS.find((m) => apiKeys[m.provider]);
    }
    if (!model) {
      spinner.fail("No model available for follow-up");
      return;
    }

    // Build context from team results
    const context = team.teammates
      .map((t) => {
        const tasks = t.tasks.map((r) => `### ${r.title}\n${r.result}`).join("\n\n");
        return `## ${t.name} (${t.role}, ${t.model.name})\n\n${tasks}`;
      })
      .join("\n\n---\n\n");

    const synthesisContext = team.synthesis ? `\n\n## Synthesis\n${team.synthesis}` : "";

    const result = await callLLM(
      model,
      [
        {
          role: "system",
          content: `You are answering follow-up questions about a team task. The original request was: "${team.userRequest}". Below are all teammate results and the synthesis. Answer based on this context.`,
        },
        {
          role: "user",
          content: `Context:\n${context}${synthesisContext}\n\nFollow-up question: ${question}`,
        },
      ],
      apiKeys
    );

    const cost = calculateCost(model, result.inputTokens, result.outputTokens);
    spinner.stop();

    console.log();
    const rendered = renderMarkdown(result.content);
    process.stdout.write(rendered);
    console.log(
      chalk.dim(`\n  Follow-up cost: $${cost.toFixed(6)} (${model.name})`)
    );
    console.log();
  } catch (err) {
    spinner.fail("Follow-up failed");
    printError(err instanceof Error ? err.message : "Unknown error");
  }
}
