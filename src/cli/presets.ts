/**
 * Preset Team Templates
 *
 * Pre-configured team compositions for common workflows.
 * Presets skip the leader planning phase and directly assign
 * teammates + tasks based on proven configurations.
 *
 * Usage:
 *   smart-router team run --preset code-review "Review the auth module"
 *   smart-router team run --preset debug "TypeError in user service"
 *   smart-router team run --preset explain "How does the caching layer work?"
 */

import { TeammatePlan, Task } from "./team-types.js";

export interface TeamPreset {
  id: string;
  name: string;
  description: string;
  /** Function that generates teammates + tasks from user input and optional context */
  build: (userRequest: string, context?: string) => {
    teammates: TeammatePlan[];
    tasks: Task[];
  };
}

// ─── Preset: Code Review ───

const codeReviewPreset: TeamPreset = {
  id: "code-review",
  name: "Code Review Team",
  description: "3-person code review: security, quality, and documentation",
  build: (userRequest, context) => {
    const codeContext = context
      ? `\n\nCode/diff to review:\n${context}`
      : "";

    const teammates: TeammatePlan[] = [
      {
        name: "SecurityReviewer",
        role: "Analyze code for security vulnerabilities, injection risks, auth issues, and data exposure",
        category: "coding",
        modelId: "claude-sonnet",
        taskIds: ["security-audit"],
      },
      {
        name: "QualityReviewer",
        role: "Review code quality, design patterns, performance, error handling, and maintainability",
        category: "coding",
        modelId: "claude-sonnet",
        taskIds: ["quality-review"],
      },
      {
        name: "DocReviewer",
        role: "Check documentation, naming conventions, API design, and suggest improvements",
        category: "writing",
        modelId: "gpt-5.2",
        taskIds: ["doc-review"],
      },
    ];

    const tasks: Task[] = [
      {
        id: "security-audit",
        title: "Security Audit",
        description: `Perform a thorough security review of the following code. Look for:
- SQL injection, XSS, CSRF vulnerabilities
- Authentication/authorization flaws
- Sensitive data exposure (hardcoded secrets, logging PII)
- Input validation gaps
- Dependency vulnerabilities
- Rate limiting and DoS concerns

User request: ${userRequest}${codeContext}

Provide specific line-by-line findings with severity (Critical/High/Medium/Low) and remediation steps.`,
        assignee: "SecurityReviewer",
        status: "pending",
        dependencies: [],
      },
      {
        id: "quality-review",
        title: "Code Quality Review",
        description: `Review the code quality and architecture. Evaluate:
- SOLID principles adherence
- Design patterns (appropriate use, anti-patterns)
- Error handling completeness
- Performance concerns (N+1 queries, memory leaks, unnecessary computation)
- Code duplication and refactoring opportunities
- Test coverage gaps
- Edge cases not handled

User request: ${userRequest}${codeContext}

Provide actionable suggestions with code examples where possible.`,
        assignee: "QualityReviewer",
        status: "pending",
        dependencies: [],
      },
      {
        id: "doc-review",
        title: "Documentation & API Review",
        description: `Review the code's documentation and API design. Check:
- Function/method documentation (JSDoc, docstrings)
- Variable and function naming clarity
- API endpoint design (RESTful conventions, consistency)
- README/changelog updates needed
- Type definitions completeness
- Public API surface area (too broad or too narrow?)

User request: ${userRequest}${codeContext}

Suggest specific documentation additions and naming improvements.`,
        assignee: "DocReviewer",
        status: "pending",
        dependencies: [],
      },
    ];

    return { teammates, tasks };
  },
};

// ─── Preset: Debug ───

const debugPreset: TeamPreset = {
  id: "debug",
  name: "Debug Team",
  description: "3-person debug squad: root cause analysis, fix proposal, and test cases",
  build: (userRequest, context) => {
    const bugContext = context
      ? `\n\nRelevant code/logs:\n${context}`
      : "";

    const teammates: TeammatePlan[] = [
      {
        name: "RootCauseAnalyst",
        role: "Analyze the bug to identify the root cause through systematic debugging",
        category: "coding",
        modelId: "claude-sonnet",
        taskIds: ["root-cause"],
      },
      {
        name: "FixEngineer",
        role: "Propose concrete code fixes with multiple solution approaches",
        category: "coding",
        modelId: "claude-sonnet",
        taskIds: ["fix-proposal"],
      },
      {
        name: "TestEngineer",
        role: "Write regression tests and edge case tests to prevent recurrence",
        category: "coding",
        modelId: "gemini-2.5-flash",
        taskIds: ["regression-tests"],
      },
    ];

    const tasks: Task[] = [
      {
        id: "root-cause",
        title: "Root Cause Analysis",
        description: `Analyze the following bug report and identify the root cause. Use systematic debugging approach:
1. Reproduce: What conditions trigger this bug?
2. Isolate: Narrow down to the specific module/function
3. Identify: What is the exact root cause?
4. Classify: Is this a logic error, race condition, type error, state issue, etc.?

Bug report: ${userRequest}${bugContext}

Provide a clear diagnosis with evidence and reasoning.`,
        assignee: "RootCauseAnalyst",
        status: "pending",
        dependencies: [],
      },
      {
        id: "fix-proposal",
        title: "Fix Proposal",
        description: `Propose concrete fixes for the following bug. Provide:
1. Quick fix: Minimal change to resolve the immediate issue
2. Proper fix: Architectural improvement to prevent similar bugs
3. Code diff: Show exact changes needed
4. Risk assessment: What could break with each approach?

Bug report: ${userRequest}${bugContext}

Include complete, copy-pasteable code for each solution.`,
        assignee: "FixEngineer",
        status: "pending",
        dependencies: [],
      },
      {
        id: "regression-tests",
        title: "Regression & Edge Case Tests",
        description: `Write comprehensive tests for the following bug to ensure it doesn't recur:
1. Regression test: Reproduce the exact bug scenario
2. Edge cases: Test boundary conditions related to this bug
3. Integration test: Test the component interaction that caused the bug
4. Property-based test: If applicable, test invariants

Bug report: ${userRequest}${bugContext}

Write complete, runnable test code with clear descriptions.`,
        assignee: "TestEngineer",
        status: "pending",
        dependencies: [],
      },
    ];

    return { teammates, tasks };
  },
};

// ─── Preset: Explain ───

const explainPreset: TeamPreset = {
  id: "explain",
  name: "Code Explainer Team",
  description: "2-person team: technical deep-dive and beginner-friendly explanation",
  build: (userRequest, context) => {
    const codeContext = context
      ? `\n\nCode to explain:\n${context}`
      : "";

    const teammates: TeammatePlan[] = [
      {
        name: "TechnicalExpert",
        role: "Provide deep technical analysis with architecture diagrams and data flow",
        category: "analysis",
        modelId: "claude-sonnet",
        taskIds: ["technical-analysis"],
      },
      {
        name: "TechWriter",
        role: "Create beginner-friendly explanation with analogies and visual examples",
        category: "writing",
        modelId: "gpt-5.2",
        taskIds: ["beginner-explanation"],
      },
    ];

    const tasks: Task[] = [
      {
        id: "technical-analysis",
        title: "Technical Deep-Dive",
        description: `Provide a thorough technical analysis of the following. Include:
1. Architecture overview (components, data flow, dependencies)
2. Key design decisions and their trade-offs
3. Complexity analysis (time/space where applicable)
4. Potential improvements or alternative approaches
5. ASCII diagram of the architecture/data flow

Topic: ${userRequest}${codeContext}`,
        assignee: "TechnicalExpert",
        status: "pending",
        dependencies: [],
      },
      {
        id: "beginner-explanation",
        title: "Beginner-Friendly Explanation",
        description: `Explain the following in a way that a junior developer would understand. Include:
1. What it does (in plain English, no jargon)
2. Why it exists (what problem does it solve?)
3. How it works (step-by-step walkthrough with analogies)
4. Common gotchas and mistakes
5. Resources for learning more

Topic: ${userRequest}${codeContext}`,
        assignee: "TechWriter",
        status: "pending",
        dependencies: [],
      },
    ];

    return { teammates, tasks };
  },
};

// ─── Preset: Refactor ───

const refactorPreset: TeamPreset = {
  id: "refactor",
  name: "Refactoring Team",
  description: "3-person team: architecture review, refactored code, and migration plan",
  build: (userRequest, context) => {
    const codeContext = context
      ? `\n\nCode to refactor:\n${context}`
      : "";

    const teammates: TeammatePlan[] = [
      {
        name: "Architect",
        role: "Analyze current architecture and design the target architecture",
        category: "analysis",
        modelId: "claude-sonnet",
        taskIds: ["architecture-analysis"],
      },
      {
        name: "Implementer",
        role: "Write the refactored code following the new architecture",
        category: "coding",
        modelId: "claude-sonnet",
        taskIds: ["refactored-code"],
      },
      {
        name: "MigrationPlanner",
        role: "Create step-by-step migration plan with rollback strategy",
        category: "writing",
        modelId: "gpt-5.2",
        taskIds: ["migration-plan"],
      },
    ];

    const tasks: Task[] = [
      {
        id: "architecture-analysis",
        title: "Architecture Analysis",
        description: `Analyze the current code architecture and propose improvements:
1. Current state: Identify code smells, coupling, complexity hotspots
2. Target state: Propose the ideal architecture (patterns, modules, interfaces)
3. Gap analysis: What needs to change and why
4. Risk assessment: What are the riskiest changes?

Refactoring request: ${userRequest}${codeContext}`,
        assignee: "Architect",
        status: "pending",
        dependencies: [],
      },
      {
        id: "refactored-code",
        title: "Refactored Implementation",
        description: `Write the refactored version of the code. Requirements:
1. Apply SOLID principles and appropriate design patterns
2. Improve naming, structure, and modularity
3. Add proper TypeScript types where applicable
4. Include inline comments explaining key decisions
5. Ensure backward compatibility where possible

Refactoring request: ${userRequest}${codeContext}

Provide complete, production-ready code.`,
        assignee: "Implementer",
        status: "pending",
        dependencies: [],
      },
      {
        id: "migration-plan",
        title: "Migration Plan",
        description: `Create a detailed migration plan for the refactoring:
1. Step-by-step migration phases (smallest safe increments)
2. Testing strategy for each phase
3. Rollback plan if something goes wrong
4. Estimated effort and risk per phase
5. Feature flags or gradual rollout approach

Refactoring request: ${userRequest}${codeContext}`,
        assignee: "MigrationPlanner",
        status: "pending",
        dependencies: [],
      },
    ];

    return { teammates, tasks };
  },
};

// ─── Registry ───

export const PRESETS: TeamPreset[] = [
  codeReviewPreset,
  debugPreset,
  explainPreset,
  refactorPreset,
];

export function getPreset(id: string): TeamPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function listPresets(): TeamPreset[] {
  return PRESETS;
}
