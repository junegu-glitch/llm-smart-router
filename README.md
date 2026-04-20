# LLM Smart Router

[![CI](https://github.com/junegu-glitch/llm-smart-router/actions/workflows/ci.yml/badge.svg)](https://github.com/junegu-glitch/llm-smart-router/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Multi-model AI agent team orchestrator** — Different AI models verify each other's work. $0 with existing subscriptions.

Single-model AI teams can't catch their own blind spots. Smart Router runs **Claude, Gemini, and Codex as a team** where each model independently verifies the others, providing structural independence that no single vendor can offer.

## Cross-Model Verification (Killer Feature)

```
Claude (Author)  -->  Gemini (Verifier) [FAIL]  -->  Codex (Challenger) [FAIL]  -->  Claude (Judge)
   writes code          finds 3 bugs                 finds 2 edge cases           produces final fix
```

**Why this matters:** Claude reviewing Claude's work shares the same blind spots. Gemini and Codex catch different classes of errors because they were trained differently. This is the multi-model advantage.

### Team Mode Presets

| Preset | Pipeline | Use Case |
|--------|----------|----------|
| Cross-Verify | Author -> Verifier -> Challenger -> Judge | Code that needs to be correct |
| Code Review | Lead -> Security -> Report | Security + quality audit |
| Debug | Analysis -> Fix -> Test | Bug investigation |
| Research | Lead -> Research -> Report -> Review | Deep analysis |
| Refactor | Architect -> Implement -> Migration | Code restructuring |

### $0 Cost with CLI Mode

If you have subscriptions to Claude Code, Gemini CLI, or OpenAI Codex CLI, Team Mode costs **$0** — it uses your subscription tokens instead of API billing.

```
$ smart-router team run "Compare React vs Vue for my project"

  Smart Team — Multi-model agent team

  ✓ Leader planned: 3 teammates, 3 tasks

  ┌─────────────────────────────────────────────────────────┐
  │ Live Dashboard                  3/3 complete  91s  │
  ├────────────────┬──────────────────┬───────────┬─────────┤
  │ Teammate       │ Model            │ Status    │ Cost    │
  ├────────────────┼──────────────────┼───────────┼─────────┤
  │ Architect      │ Claude Sonnet 4  │ ✓ done    │ $0.040  │
  │ Researcher     │ Gemini 2.5 Flash │ ✓ done    │ $0.001  │
  │ Writer         │ GPT-4o           │ ✓ done    │ $0.008  │
  └────────────────┴──────────────────┴───────────┴─────────┘

  Total cost: $0.049  (3 models, 91 seconds)
```

## Why Smart Router?

| | Smart Router | Single Model ($200/mo plan) |
|---|---|---|
| **Cost** | ~$5-15/month (API pay-per-use) | $200/month flat |
| **Models** | 10 models across 6 providers | 1 model, 1 provider |
| **Strengths** | Best model for each task | One-size-fits-all |
| **Team mode** | Parallel agent teams | Sequential chat |

### Model-to-Strength Mapping

| Task Type | Best Model | Why |
|-----------|-----------|-----|
| Coding | Claude Sonnet 4 | Top coding benchmarks |
| Writing | GPT-4o | Natural, polished prose |
| Math/Reasoning | DeepSeek R1 | 54x cheaper than Claude for math |
| Research/Analysis | Gemini 2.5 Flash | 1M context window |
| Simple questions | DeepSeek V3 | $0.028/1M tokens |

## Installation

```bash
npm install -g llm-smart-router
```

Or run directly without installing:

```bash
npx llm-smart-router "your question here"
```

## Quick Start

### 1. Configure API Keys

```bash
# Required: at least one provider
smart-router config set deepseek sk-your-key      # Free tier available
smart-router config set anthropic sk-ant-your-key  # Claude models
smart-router config set openai sk-your-key         # GPT models
smart-router config set google AIza-your-key       # Gemini models

# Verify configuration
smart-router config show
```

### 2. Single Query (Auto-Routed)

```bash
# Automatically routes to the best model for the task type
smart-router "Implement quicksort in Python"     # → Claude Sonnet (coding)
smart-router "Write a resignation email"          # → GPT-4o (writing)
smart-router "Prove sqrt(2) is irrational"        # → DeepSeek R1 (math)
smart-router "What should I eat for lunch?"       # → DeepSeek V3 (cheap)
```

### 3. Agent Team Mode

```bash
# Auto-planned team (leader decides composition)
smart-router team run "Build a REST API with tests and documentation"

# Preset teams (skip planning, instant start)
smart-router team run --preset code-review --git-diff "Review my changes"
smart-router team run --preset debug --file src/auth.ts "Fix login bug"
smart-router team run --preset refactor --file src/legacy.ts "Modernize this"
smart-router team run --preset explain "How does React reconciliation work?"
```

## Features

### Smart Routing

A lightweight classifier (Gemini 2.5 Flash) analyzes your message and routes it to the optimal model:

```
User message → Classifier → Category → Best available model → Response
```

Categories: `coding`, `writing`, `math_reasoning`, `analysis`, `image_multimodal`, `large_document`, `general`

### Multi-Model Agent Teams

1. **Leader** analyzes the request and plans team composition
2. **Teammates** execute tasks in parallel, each using the best model for their role
3. **Leader** synthesizes all results into a coherent final report
4. **Interactive menu** lets you drill into individual results or ask follow-up questions

### Preset Templates

Skip planning with battle-tested team configurations:

| Preset | Teammates | Models | Use Case |
|--------|-----------|--------|----------|
| `code-review` | SecurityReviewer, QualityReviewer, DocReviewer | Claude + GPT | Code review with security, quality, docs |
| `debug` | RootCauseAnalyst, FixEngineer, TestEngineer | Claude + Gemini | Bug diagnosis, fix proposals, test cases |
| `explain` | TechnicalExpert, TechWriter | Claude + GPT | Deep-dive + beginner explanation |
| `refactor` | Architect, Implementer, MigrationPlanner | Claude + GPT | Architecture, code, migration plan |

### Git Integration

```bash
# Review working directory changes
smart-router team run --preset code-review --git-diff "Review changes"

# Review specific commits
smart-router team run --preset code-review --git-diff HEAD~3 "Review recent work"

# Include specific files as context
smart-router team run --preset debug --file src/auth.ts src/db.ts "Fix auth bug"
```

### Live Dashboard

Real-time terminal UI showing teammate progress:

```
┌─────────────────────────────────────────────────────────┐
│ Live Dashboard                  2/3 complete  34s  │
├────────────────┬──────────────────┬───────────┬─────────┤
│ Teammate       │ Model            │ Status    │ Cost    │
├────────────────┼──────────────────┼───────────┼─────────┤
│ Analyst        │ Claude Sonnet 4  │ ✓ done    │ $0.031  │
│ Coder          │ DeepSeek R1      │ ◉ working │ —       │
│ Writer         │ GPT-4o           │ ✓ done    │ $0.008  │
└────────────────┴──────────────────┴───────────┴─────────┘
```

### Session Management

```bash
# List past team sessions
smart-router team sessions

# Review a saved session
smart-router team review 1
```

## Examples

See the [`examples/`](./examples/) directory for runnable examples with full output transcripts:

- [Single query routing](./examples/01-single-query.md) — auto-routing to the best model
- [Team run with `--use-cli`](./examples/02-team-run.md) — zero-cost multi-agent team
- [Preset code review](./examples/03-presets.md) — preset templates with git context
- [Session review](./examples/04-session-review.md) — replaying a saved team session

## CLI Reference

```bash
# Single query
smart-router "your message"                    # Auto-route
smart-router -m claude-sonnet "your message"   # Force model
smart-router -v "your message"                 # Verbose (show routing)
smart-router -i                                # Interactive REPL

# Team mode
smart-router team run "complex task"           # Auto-planned team
smart-router team run -p code-review "review"  # Use preset
smart-router team run --git-diff "review"      # With git context
smart-router team run -f file.ts "analyze"     # With file context
smart-router team run --use-cli "task"         # $0 with subscription CLIs
smart-router team presets                       # List presets
smart-router team sessions                      # List saved sessions
smart-router team review <id>                   # View past session

# Configuration
smart-router config set <provider> <key>        # Add API key
smart-router config remove <provider>           # Remove API key
smart-router config show                        # Show all keys
smart-router models                             # List available models
```

## Available Models

| Model | Provider | Tier | Output Cost/1M | Best For |
|-------|----------|------|----------------|----------|
| DeepSeek V3 | DeepSeek | Budget | $0.028 | General, fallback |
| DeepSeek R1 | DeepSeek | Budget | $0.28 | Math, reasoning |
| Gemini 2.5 Flash | Google | Budget | $0.60 | Routing, research, multimodal |
| Claude Haiku 4.5 | Anthropic | Mid | $1.25 | Fast coding |
| GPT-4.1 mini | OpenAI | Mid | $1.60 | Budget writing, general |
| Gemini 2.5 Pro | Google | Mid | $10.00 | Large docs, analysis |
| GPT-4.1 | OpenAI | Premium | $8.00 | Writing, coding |
| GPT-4o | OpenAI | Premium | $10.00 | Writing, general |
| Claude Sonnet 4 | Anthropic | Premium | $15.00 | Coding, analysis |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Input                            │
├─────────────────────────────────────────────────────────┤
│          Router (Gemini 2.5 Flash classifier)            │
│    "Implement quicksort" → coding → Claude Sonnet       │
├─────────────────────────────────────────────────────────┤
│                  Team Orchestrator                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Claude   │  │ GPT-4o   │  │ Gemini   │  (parallel)  │
│  │ Sonnet   │  │          │  │ Flash    │              │
│  │ [coding] │  │ [writing]│  │ [research]│             │
│  └──────────┘  └──────────┘  └──────────┘              │
├─────────────────────────────────────────────────────────┤
│           Synthesis (Gemini 2.5 Flash)                    │
│          Combines all results → Final Report             │
└─────────────────────────────────────────────────────────┘
```

## Cost Examples

| Task | Models Used | Cost | Time |
|------|-----------|------|------|
| Simple question | DeepSeek V3 | $0.00001 | <1s |
| Code review (preset) | Claude×2 + GPT | $0.16 | 73s |
| Framework comparison (3 teammates) | Claude + Gemini + GPT | $0.05 | 91s |
| Full REST API scaffold (4 teammates) | Claude×3 + GPT | $0.19 | 110s |
| Any team task with `--use-cli` | Claude + Gemini + Codex | **$0.00** | varies |

## Development

```bash
# Clone and install
git clone https://github.com/junegu-glitch/llm-smart-router.git
cd llm-smart-router
npm install

# Run CLI in development (TypeScript directly, no build needed)
npm run cli -- "your message"
npm run team -- run "complex task"

# Build for distribution
npm run build:cli

# Run tests
npm test

# Run web UI (optional)
npm run dev
```

## Testing

154 tests covering routing, provider behavior, team orchestration, sessions, and git-context support.

```bash
npm test               # Run all tests
npm run test:coverage  # With coverage report
```

## License

MIT — see [LICENSE](./LICENSE)
