# LLM Smart Router

[![CI](https://github.com/junegu-glitch/llm-smart-router/actions/workflows/ci.yml/badge.svg)](https://github.com/junegu-glitch/llm-smart-router/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

CLI-first AI workflow copilot that routes work to the best model and can spin up small multi-model agent teams from your terminal.

## Why this exists

Most AI tools assume one model should do everything. `llm-smart-router` takes a different approach:

- Route coding tasks to strong coding models
- Route writing tasks to strong writing models
- Use cheap models for simple work
- Run parallel specialist teammates for larger tasks

The result is a workflow tool for developers who want one command surface across multiple providers instead of manually juggling tabs and prompts.

## Core workflows

### 1. Auto-route a single prompt

```bash
smart-router "Implement quicksort in Python"
smart-router "Write a release note for version 1.2"
smart-router "Summarize this design document"
```

### 2. Run a team for a bigger task

```bash
smart-router team run "Compare React vs Vue for a small SaaS dashboard"
```

The leader plans specialist roles, teammates run in parallel, and the leader synthesizes a final answer.

### 3. Review code with git-aware context

```bash
smart-router team run --preset code-review --git-diff "Review my current changes"
smart-router team run --preset code-review --git-diff HEAD~3 "Review recent work"
smart-router team run --preset debug --file src/auth.ts "Find the login bug"
```

## Features

- Smart task classification into `coding`, `writing`, `analysis`, `math_reasoning`, `image_multimodal`, `large_document`, and `general`
- Ranked model selection with provider fallback
- Team mode with leader planning, parallel teammates, and synthesized output
- Presets for code review, debugging, refactoring, and explanation
- Git diff and file-context support for developer workflows
- Session review for past team runs
- Optional web UI for chat and settings

## Supported providers

- Anthropic
- OpenAI
- Google
- DeepSeek
- xAI
- Mistral

At least one provider key is required for API mode.

## Installation

```bash
npm install
npm run build:cli
```

For local CLI development without building:

```bash
npm run cli -- "your prompt here"
```

## Quick start

### Configure API keys

```bash
smart-router config set anthropic sk-ant-...
smart-router config set openai sk-...
smart-router config set google AIza...
smart-router config show
```

### Try a single routed request

```bash
smart-router "Draft a concise project update email"
```

### Try a preset team

```bash
smart-router team run --preset code-review --git-diff "Review my changes"
```

## Development

```bash
npm install
npm test
npm run lint
npm run build:cli
```

To run the web app:

```bash
npm run dev
```

## Environment

Create a local `.env.local` if you want web auth or CLI-subscription detection:

```bash
cp .env.example .env.local
```

Variables used by this project:

- `USE_CLI=true` to enable CLI-provider detection for the web app
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Repository layout

- `src/cli`: CLI entrypoints, team orchestration, presets, session handling
- `src/lib`: routing, providers, model metadata, storage, shared types
- `src/app`: optional Next.js web app and API routes
- `tests`: unit tests for routing, providers, team orchestration, sessions, and git context

## Submission note

This repository was prepared as a standalone course submission project. A companion report is in [REPORT.md](./REPORT.md).

## License

MIT
