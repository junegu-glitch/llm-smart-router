# Examples

Real usage examples with actual terminal output.

| Example | Command | What it shows |
|---------|---------|---------------|
| [01 — Single query routing](./01-single-query.md) | `smart-router "..."` | Task classification + automatic model selection |
| [02 — Team run](./02-team-run.md) | `smart-router team run "..."` | Multi-model parallel execution + synthesis |
| [03 — Preset templates](./03-presets.md) | `smart-router team run --preset code-review ...` | Built-in team templates with git context |
| [04 — Session review](./04-session-review.md) | `smart-router team review <id>` | Replaying a saved team session |

## Prerequisites

```bash
npm install && npm run build:cli && npm link

# Configure at least one provider
smart-router config set anthropic sk-ant-...
smart-router config set google AIza...
```

For zero-cost mode, ensure you have Claude Code, Gemini CLI, or Codex CLI installed and authenticated. Then add `--use-cli` to any `team run` command.
