/**
 * Live Team Dashboard
 *
 * Renders a real-time status table during team execution.
 * Updates in-place using ANSI escape codes to overwrite previous output.
 *
 * ┌──────────────────────────────────────────────────────┐
 * │  Smart Team — Live Dashboard                         │
 * ├──────────────┬──────────────┬──────────┬─────────────┤
 * │  Teammate    │  Model       │  Status  │  Cost       │
 * ├──────────────┼──────────────┼──────────┼─────────────┤
 * │  Coder       │  Claude Son  │  ✓ done  │  $0.052     │
 * │  Writer      │  GPT-4o      │  ⏳ work │  —          │
 * │  Researcher  │  Gemini Fl   │  ▶ start │  —          │
 * └──────────────┴──────────────┴──────────┴─────────────┘
 */

import chalk from "chalk";

interface TeammateStatus {
  name: string;
  model: string;
  status: "pending" | "running" | "done" | "error";
  cost: number;
  taskCount: number;
  elapsed: number;  // seconds
}

const STATUS_ICONS: Record<string, string> = {
  pending: chalk.dim("○ pending"),
  running: chalk.yellow("◉ working"),
  done: chalk.green("✓ done"),
  error: chalk.red("✗ error"),
};

export class LiveDashboard {
  private teammates: Map<string, TeammateStatus> = new Map();
  private startTime: number;
  private lineCount = 0;
  private enabled: boolean;

  constructor(enabled = true) {
    this.startTime = Date.now();
    // Disable live updates if not a TTY (e.g., piped output)
    this.enabled = enabled && Boolean(process.stdout.isTTY);
  }

  addTeammate(name: string, model: string): void {
    this.teammates.set(name, {
      name,
      model,
      status: "pending",
      cost: 0,
      taskCount: 0,
      elapsed: 0,
    });
  }

  updateStatus(
    name: string,
    status: "pending" | "running" | "done" | "error",
    cost = 0,
    taskCount = 0
  ): void {
    const teammate = this.teammates.get(name);
    if (teammate) {
      teammate.status = status;
      teammate.cost = cost;
      teammate.taskCount = taskCount;
      teammate.elapsed = (Date.now() - this.startTime) / 1000;
    }
    this.render();
  }

  private clearPrevious(): void {
    if (this.lineCount > 0 && this.enabled) {
      // Move cursor up and clear each line
      process.stdout.write(`\x1B[${this.lineCount}A`);
      for (let i = 0; i < this.lineCount; i++) {
        process.stdout.write("\x1B[2K\n");
      }
      process.stdout.write(`\x1B[${this.lineCount}A`);
    }
  }

  render(): void {
    this.clearPrevious();

    const lines: string[] = [];
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);

    // Header
    const doneCount = [...this.teammates.values()].filter((t) => t.status === "done").length;
    const total = this.teammates.size;
    const progress = total > 0 ? `${doneCount}/${total}` : "0/0";

    lines.push(
      chalk.dim("  ┌─────────────────────────────────────────────────────────┐")
    );
    lines.push(
      chalk.dim("  │ ") +
      chalk.bold("Live Dashboard") +
      chalk.dim("                  ") +
      chalk.white(`${progress} complete`) +
      chalk.dim(`  ${elapsed}s`) +
      chalk.dim("  │")
    );
    lines.push(
      chalk.dim("  ├────────────────┬──────────────────┬───────────┬─────────┤")
    );
    lines.push(
      chalk.dim("  │ ") +
      chalk.bold("Teammate".padEnd(15)) +
      chalk.dim("│ ") +
      chalk.bold("Model".padEnd(17)) +
      chalk.dim("│ ") +
      chalk.bold("Status".padEnd(10)) +
      chalk.dim("│ ") +
      chalk.bold("Cost".padEnd(8)) +
      chalk.dim("│")
    );
    lines.push(
      chalk.dim("  ├────────────────┼──────────────────┼───────────┼─────────┤")
    );

    // Teammate rows
    for (const t of this.teammates.values()) {
      const statusStr = STATUS_ICONS[t.status] || t.status;
      const costStr = t.cost > 0 ? chalk.green(`$${t.cost.toFixed(4)}`) : chalk.dim("—");
      const nameStr = t.name.length > 14 ? t.name.slice(0, 13) + "…" : t.name.padEnd(14);
      const modelStr = t.model.length > 16 ? t.model.slice(0, 15) + "…" : t.model.padEnd(16);

      lines.push(
        chalk.dim("  │ ") +
        chalk.white(nameStr) +
        chalk.dim(" │ ") +
        chalk.cyan(modelStr) +
        chalk.dim(" │ ") +
        statusStr.padEnd(19) +  // includes ANSI codes, so pad more
        chalk.dim(" │ ") +
        costStr.padEnd(17) +
        chalk.dim("│")
      );
    }

    lines.push(
      chalk.dim("  └────────────────┴──────────────────┴───────────┴─────────┘")
    );

    const output = lines.join("\n") + "\n";
    process.stdout.write(output);
    this.lineCount = lines.length;
  }

  /** Final render — no more updates after this */
  finalize(): void {
    this.render();
    this.lineCount = 0;  // Prevent clearing on next call
  }
}
