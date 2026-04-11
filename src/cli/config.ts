/**
 * CLI Configuration Manager
 * Stores API keys and settings in ~/.smart-router/config.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { ApiKeys } from "../lib/types.js";

const CONFIG_DIR = join(homedir(), ".smart-router");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface CLIConfig {
  apiKeys: ApiKeys;
  defaultTier?: "budget" | "mid" | "premium";
  verbose?: boolean;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): CLIConfig {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) {
    return { apiKeys: {} };
  }
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { apiKeys: {} };
  }
}

export function saveConfig(config: CLIConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getApiKeys(): ApiKeys {
  return loadConfig().apiKeys;
}

export function setApiKey(provider: string, key: string): void {
  const config = loadConfig();
  config.apiKeys = { ...config.apiKeys, [provider]: key };
  saveConfig(config);
}

export function removeApiKey(provider: string): void {
  const config = loadConfig();
  delete config.apiKeys[provider as keyof ApiKeys];
  saveConfig(config);
}

export function hasAnyApiKey(): boolean {
  const keys = getApiKeys();
  return Object.values(keys).some((v) => v && v.trim().length > 0);
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
