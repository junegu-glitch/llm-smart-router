/**
 * Tests for src/cli/config.ts
 *
 * Tests API key management and config file persistence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("os", () => ({
  homedir: () => "/mock/home",
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import {
  setApiKey,
  getApiKeys,
  removeApiKey,
  hasAnyApiKey,
} from "../../../src/cli/config.js";

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedMkdirSync = vi.mocked(mkdirSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setApiKey", () => {
  it("should save a key to the config file", () => {
    // Config dir exists, no existing config file
    mockedExistsSync.mockImplementation((p) => {
      if (String(p).endsWith(".smart-router")) return true;
      return false; // config.json does not exist
    });

    setApiKey("openai", "sk-test-123");

    expect(mockedWriteFileSync).toHaveBeenCalledOnce();
    const [filePath, content] = mockedWriteFileSync.mock.calls[0];
    expect(String(filePath)).toContain("config.json");
    const parsed = JSON.parse(content as string);
    expect(parsed.apiKeys.openai).toBe("sk-test-123");
  });
});

describe("getApiKeys", () => {
  it("should read keys from an existing config file", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ apiKeys: { anthropic: "sk-ant-1", google: "gk-2" } })
    );

    const keys = getApiKeys();

    expect(keys).toEqual({ anthropic: "sk-ant-1", google: "gk-2" });
  });
});

describe("removeApiKey", () => {
  it("should delete a key from the config and save", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({ apiKeys: { openai: "sk-1", anthropic: "sk-2" } })
    );

    removeApiKey("openai");

    expect(mockedWriteFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(mockedWriteFileSync.mock.calls[0][1] as string);
    expect(written.apiKeys).not.toHaveProperty("openai");
    expect(written.apiKeys.anthropic).toBe("sk-2");
  });
});

describe("hasAnyApiKey", () => {
  it("should return false when config dir does not exist and no keys are stored", () => {
    // Neither dir nor file exist — ensureConfigDir will create dir
    mockedExistsSync.mockReturnValue(false);

    const result = hasAnyApiKey();

    expect(result).toBe(false);
    // Should have attempted to create the config directory
    expect(mockedMkdirSync).toHaveBeenCalled();
  });
});
