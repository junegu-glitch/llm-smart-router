/**
 * Git Context Provider
 *
 * Extracts git information (diffs, file contents, commit history)
 * to provide as context to team presets like code-review and debug.
 *
 * Usage:
 *   smart-router team run --preset code-review --git-diff "Review latest changes"
 *   smart-router team run --preset code-review --git-diff HEAD~3 "Review recent commits"
 *   smart-router team run --preset debug --file src/auth.ts "Fix login bug"
 */

import { execSync, execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";

/**
 * Get the git diff for the working directory or a specific ref range.
 * @param ref - Optional git ref (e.g., "HEAD~3", "main", "abc123..def456")
 * @param dir - Optional working directory
 */
export function getGitDiff(ref?: string, dir?: string): string {
  try {
    const cwd = dir || process.cwd();

    // Check if we're in a git repo
    execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "pipe" });

    let diff: string;
    if (ref) {
      // Diff against a specific ref (use execFileSync to avoid shell injection)
      diff = execFileSync("git", ["diff", ref], { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 });
    } else {
      // Staged + unstaged changes
      const staged = execSync("git diff --cached", { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 });
      const unstaged = execSync("git diff", { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 });
      diff = staged + unstaged;

      // If no working changes, show the last commit
      if (!diff.trim()) {
        diff = execSync("git diff HEAD~1", { cwd, encoding: "utf-8", maxBuffer: 1024 * 1024 });
      }
    }

    if (!diff.trim()) {
      return "(No changes found)";
    }

    // Truncate very large diffs
    const MAX_CHARS = 50000;
    if (diff.length > MAX_CHARS) {
      return diff.slice(0, MAX_CHARS) + `\n\n... (truncated, ${diff.length} total chars)`;
    }

    return diff;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not a git repository")) {
      return "(Not a git repository)";
    }
    return `(Git error: ${message})`;
  }
}

/**
 * Get recent git log (commit messages and stats).
 */
export function getGitLog(count = 10, dir?: string): string {
  try {
    const cwd = dir || process.cwd();
    return execSync(
      `git log --oneline --stat -${count}`,
      { cwd, encoding: "utf-8", maxBuffer: 512 * 1024 }
    );
  } catch {
    return "(Could not read git log)";
  }
}

/**
 * Read one or more files and combine them as context.
 */
export function readFilesAsContext(paths: string[]): string {
  const parts: string[] = [];

  for (const p of paths) {
    if (!existsSync(p)) {
      parts.push(`--- ${p} ---\n(File not found)\n`);
      continue;
    }

    try {
      const content = readFileSync(p, "utf-8");
      const MAX_FILE_CHARS = 30000;
      const truncated = content.length > MAX_FILE_CHARS
        ? content.slice(0, MAX_FILE_CHARS) + `\n... (truncated, ${content.length} total chars)`
        : content;
      parts.push(`--- ${p} ---\n${truncated}\n`);
    } catch {
      parts.push(`--- ${p} ---\n(Could not read file)\n`);
    }
  }

  return parts.join("\n");
}

/**
 * Build context string from various git/file sources.
 */
export function buildContext(options: {
  gitDiff?: string | boolean;  // true = working dir diff, string = ref
  files?: string[];
  dir?: string;
  extraContext?: string;
}): string {
  const parts: string[] = [];

  if (options.gitDiff) {
    const ref = typeof options.gitDiff === "string" ? options.gitDiff : undefined;
    const diff = getGitDiff(ref, options.dir);
    parts.push(`## Git Diff\n\`\`\`diff\n${diff}\n\`\`\``);
  }

  if (options.files && options.files.length > 0) {
    const fileContent = readFilesAsContext(options.files);
    parts.push(`## Files\n${fileContent}`);
  }

  if (options.extraContext) {
    parts.push(options.extraContext);
  }

  return parts.join("\n\n");
}
