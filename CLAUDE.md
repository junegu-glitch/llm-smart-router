# CLAUDE.md

Quick orientation for AI coding agents working in this repo.

## Build / Test

- `npm install` — install deps
- `npm run build:cli` — compile TypeScript CLI to `dist/`
- `npm test` — run vitest suite (167 tests)
- `npm run lint` — eslint
- `npm run dev` — start Next.js web UI

## Layout

- `src/cli/` — CLI entrypoints, team orchestration
- `src/lib/` — routing, model catalog, providers, encryption (shared core)
- `src/app/` — Next.js web UI
- `tests/unit/` — vitest tests

## Conventions

- BYOK: API keys are user-supplied, AES-256-GCM encrypted in `~/.smart-router/`
- `--use-cli` flag routes through subscription CLI binaries (claude/gemini/codex)
  via `child_process.spawn`, returning `viaCLI: true` for $0 cost rollup
