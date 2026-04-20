# Example 03 — Preset Templates

Presets are pre-configured teams you can run instantly without the leader planning step. Each preset defines specialist roles, model assignments, and how the synthesis should be structured.

## List Available Presets

```bash
smart-router team presets
```

```
  Available Team Presets:

  code-review   Code Review Team        3-person code review: security, quality, and documentation
  debug         Debug Team              3-person debug squad: root cause analysis, fix proposal, and test cases
  explain       Code Explainer Team     2-person team: technical deep-dive and beginner-friendly explanation
  refactor      Refactoring Team        3-person team: architecture review, refactored code, and migration plan

  Usage: smart-router team run --preset <name> "your message"
  With git: smart-router team run --preset code-review --git-diff "Review changes"
```

## Code Review with Git Context

```bash
# Review all uncommitted changes
smart-router team run --preset code-review --git-diff "Review my current changes"

# Review last 3 commits
smart-router team run --preset code-review --git-diff HEAD~3 "Review recent work"
```

The `--git-diff` flag automatically captures your git diff and passes it as context to all teammates. They see the exact lines changed, file paths, and change summary.

## Debug a Specific File

```bash
smart-router team run --preset debug --file src/auth.ts "Fix the login redirect bug"
```

The `--file` flag reads the file and includes it as context. Works with multiple files:

```bash
smart-router team run --preset debug \
  --file src/auth.ts \
  --file src/middleware.ts \
  "The session token isn't being refreshed correctly"
```

## Explain Code to Two Audiences

```bash
smart-router team run --preset explain --file src/router.ts "How does the routing algorithm work?"
```

The `explain` preset runs two teammates:
- **TechnicalExpert** — deep technical explanation for experienced developers
- **TechWriter** — beginner-friendly explanation with analogies

The synthesis gives you both perspectives in one report.

## Refactor with Migration Plan

```bash
smart-router team run --preset refactor --file src/legacy-api.ts \
  "Modernize this to use async/await and better error handling"
```

The `refactor` preset assigns:
- **Architect** — reviews the current design and proposes a new structure
- **Implementer** — writes the refactored code
- **MigrationPlanner** — produces a step-by-step migration guide

## Skip the Interactive Menu (`--no-interactive`)

By default, after the synthesis, an interactive menu appears for follow-up questions. Use `--no-interactive` to pipe output or run in scripts:

```bash
smart-router team run --no-interactive --preset code-review --git-diff > review.md
```

## Zero-Cost with `--use-cli`

```bash
smart-router team run --preset code-review --git-diff --use-cli "Review my changes"
```

Uses your subscription CLIs. No API billing.
