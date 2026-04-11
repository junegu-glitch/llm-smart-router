# LLM Smart Router Report

June Gu  
06-642 · Spring 2026  
Carnegie Mellon University

## 1. Summary

For this project, I built `llm-smart-router`, a CLI-first AI workflow copilot that routes tasks to the best available LLM and can run small multi-model agent teams from the terminal. Instead of treating one model as the answer to every task, the project uses task classification plus model-specific strengths to choose better defaults for coding, writing, analysis, and larger multi-step jobs.

The main user is a developer or technical user who already works with multiple AI tools and wants one interface for routing prompts, reviewing code, and coordinating specialist model roles.

## 2. What Project 1 Was

My project-1 was `plateprep`, a small Python CLI for preprocessing 96-well absorbance plate-reader CSV exports. It validated four wavelength files, merged them into one tidy table, and printed summary statistics. It solved a real lab workflow problem well, but it was intentionally narrow: one domain, one kind of input, and one data-processing pipeline.

## 3. What Is Different From Project 1

`llm-smart-router` is a new project, not a small extension of `plateprep`.

| Category | Project 1: `plateprep` | New project: `llm-smart-router` |
|---|---|---|
| Primary problem | Lab CSV preprocessing | AI workflow orchestration |
| Audience | Lab users working with plate-reader exports | Developers and technical users working across LLM providers |
| Interface | Simple Python CLI with 3 commands | TypeScript CLI with routing, team mode, presets, and session review |
| Core behavior | Validate, merge, summarize fixed-format files | Classify task, select model, run one model or multiple teammates |
| Input type | Structured CSV files | Natural-language prompts, git diffs, selected files |
| Output type | Clean CSV and statistics | Routed LLM responses, team reports, review output |
| Scope | Narrow domain tool | General-purpose AI work tool |
| Engineering surface | Small standalone package | CLI orchestration layer plus optional web UI and tests |

The key improvement I define here is **generality plus orchestration**. `plateprep` automated one recurring lab task. `llm-smart-router` automates a broader class of technical knowledge work and makes an explicit design choice that different models are best for different jobs.

## 4. Main Features

### Smart routing

The tool classifies a prompt into categories such as coding, writing, analysis, math/reasoning, or large-document work, then selects an appropriate model from the configured providers.

### Team mode

For larger tasks, the tool can create a leader-plus-teammates workflow. The leader plans the sub-tasks, teammates run in parallel, and the leader synthesizes the final result.

### Git-aware workflows

The CLI can include git diff context or explicit files, which makes it useful for code review, debugging, and refactoring workflows.

### Preset templates

The project includes ready-made team presets for code review, debugging, explanation, and refactoring, so the user does not have to plan every multi-agent workflow manually.

### Session review

Past team runs can be listed and revisited from the terminal.

## 5. Example Usage

### Example 1: Single auto-routed query

```bash
smart-router "Implement quicksort in Python"
```

Expected behavior: the router classifies this as coding and selects a strong coding model.

### Example 2: Team workflow

```bash
smart-router team run "Compare React vs Vue for a small SaaS dashboard"
```

Expected behavior: a leader plans multiple specialist roles, teammates run in parallel, and the tool returns one synthesized answer.

### Example 3: Code review with git context

```bash
smart-router team run --preset code-review --git-diff "Review my current changes"
```

Expected behavior: the tool uses the code-review preset and includes git diff context so the review is grounded in actual repository changes.

## 6. Evidence It Works

At the time I prepared this standalone submission repository:

- `npm test` passed with **154 / 154 tests**
- The repo was reorganized into a standalone submission-ready project rather than a hidden course-worktree subfolder
- The documentation was rewritten to emphasize the CLI workflows that represent the core value of the project

These tests cover the routing logic, provider selection, CLI behavior, team orchestration, team sessions, presets, and git-context support.

## 7. Reflection

The biggest lesson from project-1 was that a CLI becomes much more valuable when it turns a repeated manual workflow into a single reliable command. I kept that lesson, but changed the domain completely. Instead of automating one lab preprocessing step, I built a more ambitious developer tool that automates LLM selection and multi-model coordination.

This project was also more demanding architecturally than `plateprep`. It required routing logic, provider abstraction, team orchestration, persistent session handling, and a much broader test surface. That made it a better demonstration of what I learned after project-1: how to move from a useful single-purpose tool to a more general software product with clearer system design, richer interfaces, and stronger engineering evidence.
