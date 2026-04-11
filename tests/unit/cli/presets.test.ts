/**
 * Tests for src/cli/presets.ts
 * Pure functions — no mocking needed.
 */
import { describe, it, expect } from "vitest";
import { PRESETS, getPreset, listPresets } from "../../../src/cli/presets.js";

describe("Preset registry", () => {
  it("should have 4 presets", () => {
    expect(PRESETS.length).toBe(4);
  });

  it("should have unique IDs", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have required fields for all presets", () => {
    for (const preset of PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(typeof preset.build).toBe("function");
    }
  });
});

describe("getPreset", () => {
  it("should find code-review preset", () => {
    expect(getPreset("code-review")).toBeDefined();
    expect(getPreset("code-review")!.id).toBe("code-review");
  });

  it("should find all presets by ID", () => {
    for (const preset of PRESETS) {
      expect(getPreset(preset.id)).toBeDefined();
    }
  });

  it("should return undefined for non-existent preset", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });
});

describe("listPresets", () => {
  it("should return all presets", () => {
    expect(listPresets()).toEqual(PRESETS);
  });
});

describe("code-review preset build", () => {
  const preset = getPreset("code-review")!;

  it("should generate 3 teammates", () => {
    const { teammates } = preset.build("Review my auth module");
    expect(teammates).toHaveLength(3);
  });

  it("should generate 3 tasks", () => {
    const { tasks } = preset.build("Review my auth module");
    expect(tasks).toHaveLength(3);
  });

  it("should use diverse models (not all the same)", () => {
    const { teammates } = preset.build("Review my auth module");
    const models = new Set(teammates.map((t) => t.modelId));
    expect(models.size).toBeGreaterThan(1);
  });

  it("should assign all tasks to teammates", () => {
    const { teammates, tasks } = preset.build("Review my auth module");
    for (const task of tasks) {
      const assigned = teammates.find((t) => t.taskIds.includes(task.id));
      expect(assigned, `Task ${task.id} should be assigned`).toBeDefined();
    }
  });

  it("should include user request in task descriptions", () => {
    const { tasks } = preset.build("Check for SQL injection");
    for (const task of tasks) {
      expect(task.description).toContain("Check for SQL injection");
    }
  });

  it("should include context when provided", () => {
    const { tasks } = preset.build("Review this", "const x = 1;");
    for (const task of tasks) {
      expect(task.description).toContain("const x = 1;");
    }
  });

  it("should have SecurityReviewer using Claude", () => {
    const { teammates } = preset.build("Review");
    const security = teammates.find((t) => t.name === "SecurityReviewer");
    expect(security).toBeDefined();
    expect(security!.modelId).toBe("claude-sonnet");
  });

  it("should have DocReviewer using GPT (writing model)", () => {
    const { teammates } = preset.build("Review");
    const doc = teammates.find((t) => t.name === "DocReviewer");
    expect(doc).toBeDefined();
    expect(doc!.modelId).toBe("gpt-5.2");
  });
});

describe("debug preset build", () => {
  const preset = getPreset("debug")!;

  it("should generate 3 teammates for debugging", () => {
    const { teammates } = preset.build("TypeError in user service");
    expect(teammates).toHaveLength(3);
    expect(teammates.map((t) => t.name)).toContain("RootCauseAnalyst");
    expect(teammates.map((t) => t.name)).toContain("FixEngineer");
    expect(teammates.map((t) => t.name)).toContain("TestEngineer");
  });

  it("should use Gemini for test engineering (budget coding)", () => {
    const { teammates } = preset.build("Fix this bug");
    const testEngineer = teammates.find((t) => t.name === "TestEngineer");
    expect(testEngineer!.modelId).toBe("gemini-2.5-flash");
  });
});

describe("explain preset build", () => {
  const preset = getPreset("explain")!;

  it("should generate 2 teammates", () => {
    const { teammates } = preset.build("How does React reconciliation work?");
    expect(teammates).toHaveLength(2);
  });

  it("should have both technical and beginner perspectives", () => {
    const { teammates } = preset.build("Explain async/await");
    expect(teammates.map((t) => t.name)).toContain("TechnicalExpert");
    expect(teammates.map((t) => t.name)).toContain("TechWriter");
  });

  it("should use different categories (analysis + writing)", () => {
    const { teammates } = preset.build("Explain");
    const categories = new Set(teammates.map((t) => t.category));
    expect(categories.size).toBe(2);
  });
});

describe("refactor preset build", () => {
  const preset = getPreset("refactor")!;

  it("should generate 3 teammates", () => {
    const { teammates } = preset.build("Modernize the legacy auth module");
    expect(teammates).toHaveLength(3);
  });

  it("should cover architecture, implementation, and migration", () => {
    const { tasks } = preset.build("Refactor");
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain("Architecture Analysis");
    expect(titles).toContain("Refactored Implementation");
    expect(titles).toContain("Migration Plan");
  });

  it("should use Claude for coding, GPT for writing", () => {
    const { teammates } = preset.build("Refactor");
    const implementer = teammates.find((t) => t.name === "Implementer");
    const planner = teammates.find((t) => t.name === "MigrationPlanner");
    expect(implementer!.modelId).toBe("claude-sonnet");
    expect(planner!.modelId).toBe("gpt-5.2");
  });
});
