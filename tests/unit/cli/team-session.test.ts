/**
 * Tests for src/cli/team-session.ts
 *
 * Tests session save/load/list operations with mocked filesystem.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Team } from "../../../src/cli/team-types.js";

// Mock fs module
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Mock os module
vi.mock("os", () => ({
  homedir: vi.fn(() => "/mock-home"),
}));

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import {
  saveTeamSession,
  loadTeamSession,
  listTeamSessions,
  getSessionsDir,
} from "../../../src/cli/team-session.js";

const MOCK_SESSIONS_DIR = "/mock-home/.smart-router/sessions";

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "abcd1234-5678-9abc-def0-1234567890ab",
    userRequest: "Explain how async/await works in JavaScript",
    leader: {
      analysis: "Single task, one teammate needed",
      teammates: [
        {
          name: "Explainer",
          role: "Explain concept",
          category: "general",
          modelId: "gemini-2.5-flash",
          taskIds: ["t1"],
        },
      ],
      tasks: [
        {
          id: "t1",
          title: "Explain async/await",
          description: "Explain async/await in JS",
          assignee: "Explainer",
          status: "done",
          dependencies: [],
        },
      ],
      reasoning: "Simple explanation task",
    },
    teammates: [
      {
        name: "Explainer",
        role: "Explain concept",
        model: { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google", apiModel: "gemini-2.5-flash", inputCostPer1M: 0.15, outputCostPer1M: 0.6, contextWindow: 1000000, bestFor: ["general" as const], tier: "budget" as const },
        tasks: [
          {
            taskId: "t1",
            title: "Explain async/await",
            result: "Async/await is a syntax for handling promises...",
            inputTokens: 200,
            outputTokens: 500,
            cost: 0.0003,
            model: "gemini-2.5-flash",
          },
        ],
        status: "done",
        totalCost: 0.0003,
      },
    ],
    tasks: [
      {
        id: "t1",
        title: "Explain async/await",
        description: "Explain async/await in JS",
        assignee: "Explainer",
        status: "done",
        dependencies: [],
      },
    ],
    synthesis: "Async/await provides a cleaner way to work with promises...",
    status: "done",
    totalCost: 0.0003,
    startedAt: 1700000000000,
    completedAt: 1700000005000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-06-15T10:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveTeamSession", () => {
  it("should create sessions dir and write correct JSON file", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const team = createMockTeam();
    const filepath = saveTeamSession(team);

    // Should ensure directory exists
    expect(mkdirSync).toHaveBeenCalledWith(MOCK_SESSIONS_DIR, { recursive: true });

    // Should write file with timestamp and short ID
    expect(writeFileSync).toHaveBeenCalledOnce();
    const [writePath, content] = vi.mocked(writeFileSync).mock.calls[0] as [string, string];

    expect(writePath).toContain(MOCK_SESSIONS_DIR);
    expect(writePath).toContain("abcd1234");
    expect(writePath).toMatch(/\.json$/);
    // Timestamp replaces : and . with -
    expect(writePath).toContain("2025-06-15T10-30-00-000Z");

    // Content should be valid JSON matching the team
    const parsed = JSON.parse(content);
    expect(parsed.id).toBe(team.id);
    expect(parsed.userRequest).toBe(team.userRequest);
    expect(parsed.totalCost).toBe(team.totalCost);
    expect(parsed.teammates).toHaveLength(1);

    // Should return the filepath
    expect(filepath).toBe(writePath);
  });
});

describe("loadTeamSession", () => {
  it("should load existing session by exact filename", () => {
    const team = createMockTeam();
    const filename = "2025-06-15T10-30-00-000Z_abcd1234.json";

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([filename] as any);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(team));

    const loaded = loadTeamSession(filename);

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(team.id);
    expect(loaded!.userRequest).toBe(team.userRequest);
    expect(loaded!.totalCost).toBe(team.totalCost);
    expect(readFileSync).toHaveBeenCalledWith(
      `${MOCK_SESSIONS_DIR}/${filename}`,
      "utf-8"
    );
  });

  it("should return null for non-existent session", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([] as any);

    const loaded = loadTeamSession("nonexistent.json");

    expect(loaded).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("should find session by partial ID match", () => {
    const team = createMockTeam();
    const filename = "2025-06-15T10-30-00-000Z_abcd1234.json";

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([filename] as any);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(team));

    const loaded = loadTeamSession("abcd1234");

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(team.id);
  });

  it("should find session by numeric index (most recent = 1)", () => {
    const team2 = createMockTeam({ id: "bbbbcccc-0000-0000-0000-000000000000" });
    // Use filenames that do NOT contain the digit "3" so partial match won't trigger
    const fileOlder = "a-session-older.json";
    const fileNewer = "b-session-newer.json";

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([fileOlder, fileNewer] as any);
    // Index "3" won't match partial (no "3" in filenames), and won't match exact
    // But index 3 is out of range for 2 files, so use "2" which also doesn't appear
    // Actually "2" doesn't appear either. Let's query "2" for the second-most-recent.
    // sorted = [fileNewer, fileOlder] (reverse alpha), index 2 = fileOlder
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(team2));

    const loaded = loadTeamSession("2");

    expect(loaded).not.toBeNull();
    // sorted reverse: [b-session-newer, a-session-older], index 2 = a-session-older
    expect(readFileSync).toHaveBeenCalledWith(
      `${MOCK_SESSIONS_DIR}/${fileOlder}`,
      "utf-8"
    );
  });
});

describe("listTeamSessions", () => {
  it("should return sessions sorted most recent first with correct schema", () => {
    const team1 = createMockTeam({
      userRequest: "First request",
      totalCost: 0.001,
      startedAt: 1700000000000,
    });
    const team2 = createMockTeam({
      userRequest: "Second request that is much longer and should be truncated at sixty characters boundary here",
      totalCost: 0.005,
      startedAt: 1700100000000,
    });

    const file1 = "2025-06-14T08-00-00-000Z_aaaa1111.json";
    const file2 = "2025-06-15T10-30-00-000Z_bbbb2222.json";

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([file1, file2] as any);
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify(team2))  // file2 read first (reverse sorted)
      .mockReturnValueOnce(JSON.stringify(team1));

    const sessions = listTeamSessions();

    // Most recent first
    expect(sessions).toHaveLength(2);
    expect(sessions[0].filename).toBe(file2);
    expect(sessions[1].filename).toBe(file1);

    // Schema fields
    expect(sessions[0]).toHaveProperty("filename");
    expect(sessions[0]).toHaveProperty("request");
    expect(sessions[0]).toHaveProperty("teammateCount");
    expect(sessions[0]).toHaveProperty("cost");
    expect(sessions[0]).toHaveProperty("date");

    // Values
    expect(sessions[0].teammateCount).toBe(1);
    expect(sessions[0].cost).toBe(0.005);

    // Long request should be truncated with ellipsis
    expect(sessions[0].request.length).toBeLessThanOrEqual(61); // 60 chars + ellipsis char
  });

  it("should handle corrupted session files gracefully", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(["corrupted.json"] as any);
    vi.mocked(readFileSync).mockReturnValue("not valid json {{{");

    const sessions = listTeamSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].request).toBe("(corrupted)");
    expect(sessions[0].teammateCount).toBe(0);
    expect(sessions[0].cost).toBe(0);
    expect(sessions[0].date).toBe("unknown");
  });
});

describe("getSessionsDir", () => {
  it("should return the correct sessions directory path", () => {
    expect(getSessionsDir()).toBe(MOCK_SESSIONS_DIR);
  });
});
