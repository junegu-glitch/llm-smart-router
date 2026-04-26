# LLM Smart Router

[![CI](https://github.com/junegu-glitch/llm-smart-router/actions/workflows/ci.yml/badge.svg)](https://github.com/junegu-glitch/llm-smart-router/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Route each task to the best LLM, run multi-model agent teams, and use `--use-cli` for $0 API cost when Claude, Gemini, or Codex subscription CLIs are installed.

LLM Smart Router is a TypeScript CLI with an optional Next.js web UI. It classifies your request, picks the best available model for that task, and can coordinate specialist teammates in parallel. If you already use Claude Code, Gemini CLI, or Codex CLI, the same team workflow can run through those local subscription tools instead of billable API calls.

## Quick Demo

```bash
# Auto-route one prompt to the best configured model
smart-router -v "Implement quicksort in Python"

# Run a multi-model team
smart-router team run "Compare Python vs Rust for building a web scraper"

# Run teammates through subscription CLIs for $0 API cost
smart-router team run --use-cli \
  "Compare Python vs Rust for building a web scraper"
```

Example zero-cost team output:

```text
Smart Team - Multi-model agent team

CLI hybrid mode enabled
Leader planned: 3 teammates, 3 tasks

Live Dashboard                   3/3 complete  91s

Teammate          Model              Status   Cost
TechnicalAnalyst  Claude Sonnet 4.6  done     $0.00
PythonCoder       GPT-5.2            done     $0.00
RustCoder         Claude Sonnet 4.6  done     $0.00

Total API cost: $0.00
```

Note: the CLI currently still expects at least one configured API key for routing or leader planning. With `--use-cli`, teammate model calls can use local subscription CLIs instead of API billing.

## Installation

```bash
npm install -g llm-smart-router
```

Or run directly:

```bash
npx llm-smart-router "your question here"
```

For local development:

```bash
git clone https://github.com/junegu-glitch/llm-smart-router.git
cd llm-smart-router
npm install
npm run build:cli
npm link
```

## Quick Start

### 1. Configure at least one provider

```bash
smart-router config set deepseek sk-your-key
smart-router config set anthropic sk-ant-your-key
smart-router config set openai sk-your-key
smart-router config set google AIza-your-key
smart-router config set xai xai-your-key
smart-router config set mistral your-mistral-key

smart-router config show
```

You only need keys for the providers you want to use. For $0 API-cost teammate calls, install and authenticate one or more supported CLIs:

```bash
# Examples only; use each vendor's current install instructions if these change
npm i -g @anthropic-ai/claude-cli
npm i -g @google/gemini-cli
npm i -g @openai/codex
```

### 2. Single query routing

```bash
smart-router "Implement a binary search tree in TypeScript"
smart-router "Write a short release note for version 1.2"
smart-router "Prove that sqrt(2) is irrational"

# Show the route decision
smart-router -v "Summarize this architecture tradeoff"

# Force a specific model
smart-router -m claude-sonnet "Review this function"
```

### 3. Team mode

```bash
# Auto-planned team
smart-router team run "Build a REST API with tests and documentation"

# Preset teams
smart-router team run --preset code-review --git-diff "Review my changes"
smart-router team run --preset debug --file src/auth.ts "Fix login bug"
smart-router team run --preset explain --file src/router.ts "Explain this code"
smart-router team run --preset refactor --file src/legacy.ts "Modernize this"

# Zero API cost for teammate calls through subscription CLIs
smart-router team run --use-cli "Compare React vs Vue for this app"
```

## Core Features

### Smart Routing

A lightweight classifier assigns your message to one of seven categories, then selects the best configured model for that category.

```text
User message -> Classifier -> Category -> Best available model -> Response
```

Categories: `coding`, `writing`, `math_reasoning`, `analysis`, `image_multimodal`, `large_document`, `general`.

### Multi-Model Agent Teams

Team mode uses a leader-and-teammates workflow:

1. The leader analyzes the request and plans roles.
2. Teammates run in parallel with model assignments matched to their roles.
3. The leader synthesizes the results into one final report.
4. Sessions are saved locally for later review.

### Subscription CLI Mode

`--use-cli` routes supported model calls through local CLIs when available:

| Provider family | Local CLI | Billing behavior |
|-----------------|-----------|------------------|
| Anthropic / Claude | `claude` | Uses your Claude Code subscription |
| Google / Gemini | `gemini` | Uses your Gemini CLI subscription |
| OpenAI / Codex | `codex` | Uses your OpenAI/Codex subscription |

If a matching CLI is unavailable or a model has no CLI mapping, the router falls back to the configured API path.

### Preset Teams

Presets skip the leader planning step and start a fixed team immediately.

| Preset | Teammates | Use case |
|--------|-----------|----------|
| `code-review` | SecurityReviewer, QualityReviewer, DocReviewer | Security, quality, and docs review |
| `debug` | RootCauseAnalyst, FixEngineer, TestEngineer | Bug diagnosis, fixes, and regression tests |
| `explain` | TechnicalExpert, TechWriter | Deep technical explanation plus beginner-friendly explanation |
| `refactor` | Architect, Implementer, MigrationPlanner | Architecture review, refactored code, migration plan |

### Git and File Context

```bash
# Review working directory changes
smart-router team run --preset code-review --git-diff "Review changes"

# Review a specific ref
smart-router team run --preset code-review --git-diff HEAD~3 "Review recent work"

# Include files as context
smart-router team run --preset debug --file src/auth.ts src/db.ts "Fix auth bug"
```

### Session Review

```bash
smart-router team sessions
smart-router team review 1
smart-router team review 22afb8d1
```

Sessions are stored in `~/.smart-router/sessions/` with the request, leader plan, teammate outputs, costs, timing, and synthesis.

### Optional Web UI

The repository also includes a Next.js web app with smart-routed chat, team mode, GitHub OAuth, and encrypted API key management.

```bash
npm run dev

# Or start local server mode using CLI subscriptions
smart-router serve
```

## Examples

See [`examples/`](./examples/) for runnable command examples and terminal transcripts:

| Example | Shows |
|---------|-------|
| [Single query routing](./examples/01-single-query.md) | Task classification, model selection, and forcing a model |
| [Team run](./examples/02-team-run.md) | Leader planning, parallel teammates, synthesis, and `--use-cli` |
| [Preset templates](./examples/03-presets.md) | Built-in teams with git and file context |
| [Session review](./examples/04-session-review.md) | Replaying saved team sessions |

## CLI Reference

```bash
# Single query
smart-router "your message"
smart-router -m claude-sonnet "your message"
smart-router -t budget "your message"
smart-router -v "your message"
smart-router -i
smart-router --use-cli "your message"

# Team mode
smart-router team run "complex task"
smart-router team run -p code-review "review"
smart-router team run --git-diff "review"
smart-router team run --git-diff HEAD~3 "review"
smart-router team run -f file.ts "analyze"
smart-router team run --leader-model gemini-2.5-flash "task"
smart-router team run --use-cli "task"
smart-router team run --no-interactive "task"
smart-router team presets
smart-router team sessions
smart-router team review <id-or-number>

# Configuration and model inventory
smart-router config set <provider> <key>
smart-router config remove <provider>
smart-router config show
smart-router models

# Optional web UI
smart-router serve
```

## Selected Models

The catalog includes Anthropic, OpenAI, Google, DeepSeek, xAI, and Mistral models. Run `smart-router models` for the current full list and key status.

| Model | Provider | Tier | Output cost / 1M | Common use |
|-------|----------|------|------------------|------------|
| DeepSeek V3.2 | DeepSeek | Budget | `$0.28` | Cheap general fallback |
| GPT-4.1 mini | OpenAI | Budget | `$0.80` | Budget writing and general tasks |
| Gemini 2.5 Flash | Google | Budget | `$2.50` | Routing, analysis, multimodal |
| DeepSeek R1 | DeepSeek | Budget | `$2.19` | Math and reasoning |
| GPT-5.2 | OpenAI | Mid | `$7.00` | Writing, coding, analysis |
| Gemini 2.5 Pro | Google | Mid | `$10.00` | Large documents and analysis |
| GPT-5.3 Codex | OpenAI | Mid | `$14.00` | Coding and analysis |
| Claude Sonnet 4.6 | Anthropic | Premium | `$15.00` | Coding, analysis, writing |
| Claude Opus 4.6 | Anthropic | Premium | `$25.00` | Premium planning and reasoning |

## Architecture

```text
User input
  -> Router classifier
  -> Category-specific model ranking
  -> Single model response

Team request
  -> Leader plans roles and tasks
  -> Teammates run in parallel
  -> Leader synthesizes final report
  -> Session is saved locally
```

## Future Work

### Planned: Cross-Model Verification

The planned verification preset is a sequential cross-model review pipeline:

```text
Claude author -> Gemini verifier -> Codex challenger -> Claude judge
```

The idea is to use structurally different models to catch different classes of mistakes. This is not currently exposed as a built-in preset; today, use the existing `code-review`, `debug`, `explain`, and `refactor` presets.

Other planned improvements:

- Guided `smart-router auth` setup wizard
- Better routing for mixed prompts such as math plus code
- More polished standalone web onboarding

## Development

```bash
npm install
npm run cli -- "your message"
npm run team -- run "complex task"
npm run build:cli
npm test
npm run dev
```

## Testing

```bash
npm test
```

Current suite: `167 passed (167)` across `14` test files, covering routing, model catalog behavior, provider calls, CLI hybrid mode, team orchestration, presets, git/file context, sessions, and terminal output.

## License

MIT - see [LICENSE](./LICENSE).
