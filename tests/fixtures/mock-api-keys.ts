/**
 * Mock API keys for testing.
 * These are NOT real keys — just test fixtures.
 */
import { ApiKeys } from "../../src/lib/types.js";

/** All providers available */
export const ALL_KEYS: ApiKeys = {
  deepseek: "sk-test-deepseek",
  anthropic: "sk-test-anthropic",
  openai: "sk-test-openai",
  google: "test-google-key",
  xai: "sk-test-xai",
  mistral: "sk-test-mistral",
};

/** Only budget providers */
export const BUDGET_KEYS: ApiKeys = {
  deepseek: "sk-test-deepseek",
  google: "test-google-key",
};

/** Only premium providers */
export const PREMIUM_KEYS: ApiKeys = {
  anthropic: "sk-test-anthropic",
  openai: "sk-test-openai",
};

/** Single provider only */
export const ANTHROPIC_ONLY: ApiKeys = {
  anthropic: "sk-test-anthropic",
};

export const GOOGLE_ONLY: ApiKeys = {
  google: "test-google-key",
};

/** No keys at all */
export const NO_KEYS: ApiKeys = {};
