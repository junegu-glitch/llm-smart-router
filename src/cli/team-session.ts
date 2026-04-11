/**
 * Team Session Management
 *
 * Save/load team results for later review, follow-up questions,
 * and interactive exploration of individual teammate outputs.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { Team } from "./team-types.js";

const SESSIONS_DIR = join(homedir(), ".smart-router", "sessions");

function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Save a completed team session to disk.
 * Returns the session file path.
 */
export function saveTeamSession(team: Team): string {
  ensureSessionsDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const shortId = team.id.slice(0, 8);
  const filename = `${timestamp}_${shortId}.json`;
  const filepath = join(SESSIONS_DIR, filename);

  writeFileSync(filepath, JSON.stringify(team, null, 2));
  return filepath;
}

/**
 * Load a team session from disk by filename or partial ID.
 */
export function loadTeamSession(query: string): Team | null {
  ensureSessionsDir();

  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));

  // Try exact filename match
  if (files.includes(query)) {
    const raw = readFileSync(join(SESSIONS_DIR, query), "utf-8");
    return JSON.parse(raw);
  }

  // Try partial ID match
  const match = files.find((f) => f.includes(query));
  if (match) {
    const raw = readFileSync(join(SESSIONS_DIR, match), "utf-8");
    return JSON.parse(raw);
  }

  // Try by index (most recent = 1)
  const idx = parseInt(query);
  if (!isNaN(idx) && idx >= 1 && idx <= files.length) {
    const sorted = files.sort().reverse();
    const raw = readFileSync(join(SESSIONS_DIR, sorted[idx - 1]), "utf-8");
    return JSON.parse(raw);
  }

  return null;
}

/**
 * List all saved sessions (most recent first).
 */
export function listTeamSessions(): {
  filename: string;
  request: string;
  teammateCount: number;
  cost: number;
  date: string;
}[] {
  ensureSessionsDir();

  const files = readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  return files.map((f) => {
    try {
      const raw = readFileSync(join(SESSIONS_DIR, f), "utf-8");
      const team: Team = JSON.parse(raw);
      return {
        filename: f,
        request: team.userRequest.slice(0, 60) + (team.userRequest.length > 60 ? "…" : ""),
        teammateCount: team.teammates.length,
        cost: team.totalCost,
        date: new Date(team.startedAt).toLocaleString(),
      };
    } catch {
      return {
        filename: f,
        request: "(corrupted)",
        teammateCount: 0,
        cost: 0,
        date: "unknown",
      };
    }
  });
}

export function getSessionsDir(): string {
  return SESSIONS_DIR;
}
