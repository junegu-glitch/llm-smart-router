/**
 * Tests for src/cli/git-context.ts
 *
 * Tests git diff extraction, git log, file reading, and context building.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGitDiff, getGitLog, readFilesAsContext, buildContext } from "../../../src/cli/git-context.js";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { execSync, execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";

const mockedExecSync = vi.mocked(execSync);
const mockedExecFileSync = vi.mocked(execFileSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedExistsSync = vi.mocked(existsSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getGitDiff", () => {
  it("should return diff output for a valid ref", () => {
    // First call: git rev-parse check (uses execSync)
    mockedExecSync.mockReturnValueOnce(Buffer.from("true"));
    // Second call: git diff HEAD~3 (uses execFileSync for safety)
    mockedExecFileSync.mockReturnValueOnce("diff --git a/file.ts b/file.ts\n+added line\n" as any);

    const result = getGitDiff("HEAD~3");

    expect(result).toBe("diff --git a/file.ts b/file.ts\n+added line\n");
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["diff", "HEAD~3"],
      expect.objectContaining({ encoding: "utf-8" })
    );
  });

  it("should return '(Not a git repository)' when not in a git repo", () => {
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error("fatal: not a git repository (or any parent up to mount point /)");
    });

    const result = getGitDiff();

    expect(result).toBe("(Not a git repository)");
  });
});

describe("getGitLog", () => {
  it("should return log output", () => {
    const logOutput = "abc1234 Initial commit\n file.ts | 10 ++++\n";
    mockedExecSync.mockReturnValueOnce(logOutput as any);

    const result = getGitLog(5);

    expect(result).toBe(logOutput);
    expect(mockedExecSync).toHaveBeenCalledWith(
      "git log --oneline --stat -5",
      expect.objectContaining({ encoding: "utf-8" })
    );
  });
});

describe("buildContext", () => {
  it("should combine diff, files, and extraContext", () => {
    // Mock getGitDiff path: rev-parse (execSync) + git diff ref (execFileSync)
    mockedExecSync.mockReturnValueOnce(Buffer.from("true"));
    mockedExecFileSync.mockReturnValueOnce("diff --git a/x.ts\n+new code\n" as any);

    // Mock readFilesAsContext path
    mockedExistsSync.mockReturnValueOnce(true);
    mockedReadFileSync.mockReturnValueOnce("const a = 1;" as any);

    const result = buildContext({
      gitDiff: "HEAD~1",
      files: ["src/x.ts"],
      extraContext: "Please review carefully.",
    });

    expect(result).toContain("## Git Diff");
    expect(result).toContain("+new code");
    expect(result).toContain("## Files");
    expect(result).toContain("const a = 1;");
    expect(result).toContain("Please review carefully.");
  });
});

describe("readFilesAsContext", () => {
  it("should read multiple files and handle file not found", () => {
    // First file exists
    mockedExistsSync.mockReturnValueOnce(true);
    mockedReadFileSync.mockReturnValueOnce("file1 content" as any);

    // Second file does not exist
    mockedExistsSync.mockReturnValueOnce(false);

    const result = readFilesAsContext(["src/a.ts", "src/missing.ts"]);

    expect(result).toContain("--- src/a.ts ---");
    expect(result).toContain("file1 content");
    expect(result).toContain("--- src/missing.ts ---");
    expect(result).toContain("(File not found)");
  });
});
