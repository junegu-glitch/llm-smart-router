# Example 01 — Single Query Routing

`smart-router` automatically classifies your task and routes it to the best available model.

## Command

```bash
smart-router --verbose "Write a release note for version 1.2 — key changes: faster startup, bug fixes"
```

The `--verbose` flag shows the routing decision before sending the request.

## Terminal Output

```
  CLI hybrid mode — detected subscriptions:
  ✓ Claude Code 2.1.101 (Claude Code) → anthropic
  ✓ Gemini CLI 0.36.0 → google
  ✓ OpenAI Codex codex-cli 0.118.0 → openai
  - Routing to best model...
  Route: [writing] → GPT-4.1 ($2/$8 per 1M)
  Reason: The user is asking to generate a release note, which is a form
          of professional writing based on provided keywords.

  - Waiting for GPT-4.1...

  Version 1.2 Release Notes

  We're excited to announce version 1.2, featuring two key improvements:

  **Faster Startup**: Application startup time has been significantly
  reduced, so you can get to work sooner.

  **Bug Fixes**: Several stability improvements have been applied based
  on user feedback.

  Thank you for your continued support.
```

## What's Happening

1. **CLI detection** — The router finds your installed subscription CLIs (Claude Code, Gemini CLI, Codex CLI). No API cost when using `--use-cli`.
2. **Task classification** — Your message is classified as `writing` (7 categories: `coding`, `writing`, `math_reasoning`, `analysis`, `image_multimodal`, `large_document`, `general`).
3. **Model selection** — GPT-4.1 is chosen because it's the best available model for writing tasks.
4. **Response** — The model generates the response.

## Routing Logic

| Task type | First choice | Why |
|-----------|-------------|-----|
| `coding` | Claude Sonnet 4 | Top coding benchmarks |
| `writing` | GPT-4.1 | Natural, polished prose |
| `math_reasoning` | DeepSeek R1 | 54x cheaper than Claude for math |
| `analysis` | Gemini 2.5 Flash | 1M context for large documents |
| `general` | DeepSeek V3 | Cheapest capable model |

## Force a Specific Model

```bash
# Skip routing, use a specific model directly
smart-router --model claude-sonnet "Implement a binary search tree in Python"
smart-router --model deepseek-r1 "Prove that the sum of first n integers is n(n+1)/2"
```

## Try Without API Keys (`--use-cli`)

```bash
# Uses your subscription tokens — $0 cost
smart-router --use-cli "Summarize the tradeoffs of microservices vs monolith"
```
