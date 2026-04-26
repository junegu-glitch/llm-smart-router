# Example 01 — Single Query Routing

`smart-router` automatically classifies your task and routes it to the best available configured model.

## Command

```bash
smart-router --verbose "Write a release note for version 1.2 — key changes: faster startup, bug fixes"
```

The `--verbose` flag shows the routing decision before sending the request.

## Terminal Output

```
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

1. **Task classification** — Your message is classified as `writing` (7 categories: `coding`, `writing`, `math_reasoning`, `analysis`, `image_multimodal`, `large_document`, `general`).
2. **Model selection** — GPT-4.1 is chosen because it's the best available configured model for writing tasks.
3. **Response** — The model generates the response and the CLI prints a cost summary.

## Routing Logic

| Task type | First choice | Why |
|-----------|-------------|-----|
| `coding` | Claude Sonnet 4.6 | Strong coding model |
| `writing` | GPT-4.1 | Natural, polished prose |
| `math_reasoning` | DeepSeek R1 | Budget reasoning model |
| `analysis` | Claude Sonnet 4.6 / Gemini 2.5 Pro | Analysis and large-context fallback |
| `general` | DeepSeek V3.2 | Cheap general fallback |

## Force a Specific Model

```bash
# Skip routing, use a specific model directly
smart-router --model claude-sonnet "Implement a binary search tree in Python"
smart-router --model deepseek-r1 "Prove that the sum of first n integers is n(n+1)/2"
```

## Try Subscription CLI Mode (`--use-cli`)

```bash
# Uses a local subscription CLI when the selected model has a CLI mapping.
# The CLI still expects at least one configured API key for routing.
smart-router --use-cli "Summarize the tradeoffs of microservices vs monolith"
```

When `--use-cli` is enabled, supported calls can run through Claude Code, Gemini CLI, or Codex CLI instead of billable API calls.
