# Final Project Report: `llm-smart-router`

June Gu  
06-642 · Spring 2026  
Carnegie Mellon University  
GitHub: https://github.com/junegu-glitch/llm-smart-router

---

## 1. The Project

### What It Does

`llm-smart-router` is a TypeScript CLI and optional web application that
routes AI tasks to the best available model and coordinates multi-model
agent teams. The core idea is that different models are genuinely better at
different kinds of work — a model optimized for code generation is not the
same as one optimized for long-document analysis or mathematical reasoning —
and yet most AI workflows treat every task as input to a single chat window.

The tool provides two main capabilities:

**Smart routing**: a lightweight classifier categorizes each request into one
of seven task types (`coding`, `writing`, `math_reasoning`, `analysis`,
`image_multimodal`, `large_document`, `general`) and selects the highest-ranked
available model for that category.

**Multi-model team mode**: for larger tasks, a leader model plans the work,
assigns specialist roles to teammate agents, runs them in parallel, and
synthesizes the results into a single final report. Team runs cost $0 when
executed with the `--use-cli` flag, which routes each teammate through a
locally installed subscription CLI (Claude Code, Gemini CLI, or Codex CLI)
rather than billable API tokens.

### The Problem It Solves

The problem is choice at scale. A developer using multiple AI providers daily
faces two friction points:

1. **Routing friction** — deciding which model is appropriate for the current
   task requires knowing each provider's strengths, current pricing, and context
   limits. Most users default to one premium model for everything, which is
   expensive for simple tasks and still suboptimal for specialized ones.

2. **Orchestration friction** — large technical tasks benefit from multiple
   independent perspectives (e.g., a security reviewer and a quality reviewer
   both looking at the same code change), but running separate queries,
   combining results, and asking a synthesizing model to reconcile them is
   manual, slow, and easy to skip.

`llm-smart-router` eliminates both friction points from the command line:

```bash
# Single routed query — model chosen automatically
smart-router "Implement a binary search tree in Python"

# Team mode — parallel specialists + synthesis
smart-router team run --preset code-review --git-diff "Review my changes"

# Zero cost with --use-cli
smart-router team run --use-cli "Compare React vs Vue for a small SaaS dashboard"
```

### Project Scope

This report covers the final state of the project at:
`https://github.com/junegu-glitch/llm-smart-router`

The submitted repository is a CLI-first package with:

- 167 automated tests (14 test files)
- Continuous integration on Node 20 and 22 (GitHub Actions)
- An optional Next.js web UI for browser-based chat and API key management
- A `--use-cli` flag for zero-cost team runs using subscription CLIs

---

## 2. Key Design Decisions

### Decision 1 — Seven-Category Routing Over Binary Classification

The simplest routing approach would be "complex task → premium model, simple
task → cheap model." I rejected this because it loses precision: a
mathematical proof is complex but benefits specifically from a reasoning-tuned
model (DeepSeek R1), not just any premium model. A large-document analysis
benefits specifically from a 1M-context model (Gemini 2.5 Pro), not a
faster coding-focused model.

The final design uses seven categories:

| Category | Primary model | Reason |
|---|---|---|
| `coding` | Claude Sonnet 4 | Top coding benchmark scores |
| `writing` | GPT-4o | Natural prose quality |
| `math_reasoning` | DeepSeek R1 | 54× cheaper than Claude for math, comparable accuracy |
| `analysis` | Gemini 2.5 Flash | 1M context for large-document analysis |
| `image_multimodal` | Gemini 2.5 Flash | Native multimodal support |
| `large_document` | Gemini 2.5 Pro | Maximum context window |
| `general` | DeepSeek V3 | Cheapest capable model for undifferentiated work |

Each category also has a ranked fallback chain for when the primary model's
provider is unavailable. Classification itself is done by a lightweight LLM
call (Gemini 2.5 Flash, ~$0.00001 per query), with a keyword-based fallback
for offline use.

### Decision 2 — Subscription CLI Hybrid Mode (`--use-cli`)

API-based LLM calls have a per-token cost. For a multi-model team with three
or more teammates, even a cheap run can add up. Many developers already pay
flat monthly subscriptions for Claude, Gemini, and Codex CLI tools — tokens
consumed through those CLIs do not incur additional API charges.

The subscription CLI hybrid mode works as follows:

1. At startup, the tool probes for installed CLI binaries:
   - `claude` → Anthropic subscription (Claude Code)
   - `gemini` → Google subscription (Gemini CLI)
   - `codex` → OpenAI subscription (Codex CLI)

2. When `--use-cli` is set, each teammate routes through the first available
   subscription CLI that covers its model's provider, using `child_process.spawn()`.

3. If no CLI covers a provider, the tool falls back to API mode for that teammate.

The result is that a full three-teammate team run (`--use-cli`) consumes $0 in
API tokens when all three subscription CLIs are installed and authenticated.

### Decision 3 — Leader-Teammate-Synthesis Pattern

Multi-model teams could be designed many ways: round-robin queries, voting
systems, sequential chains, or parallel pools. The leader-teammate-synthesis
pattern was chosen because it matches how human expert teams actually work:

1. **Leader** (planning) — a capable but inexpensive model (DeepSeek V3 or
   Gemini 2.5 Flash) receives the full request and decides how many teammates
   to spawn, what specialist role each should play, and which model fits each role.
2. **Teammates** (parallel execution) — each teammate receives its specialized
   sub-task and runs concurrently. A live terminal dashboard displays status and
   cost in real time.
3. **Leader** (synthesis) — after all teammates complete (or time out), the
   leader reads all outputs and writes a unified final report that reconciles
   findings and flags any conflicts between teammates.

This pattern handles partial failure gracefully: the synthesis step can produce
a useful result even when one or two teammates fail, because the leader is
prompted to acknowledge failures explicitly rather than silently omitting them.

### Decision 4 — Bring Your Own Key (BYOK)

Rather than acting as a proxy service that stores provider credentials on a
backend, the tool requires users to configure their own API keys in a local
encrypted config file. Keys are stored with AES-256-GCM encryption using a
secret derived from the local environment.

This decision was made for two reasons:

1. **No infrastructure lock-in** — the tool works without any persistent backend.
   Users who want to self-host the optional web UI can do so with their own
   Supabase instance.

2. **No trust boundary** — the tool never sends API keys to a third-party
   server. Key management stays entirely in the user's environment.

### Decision 5 — Session Persistence for All Team Runs

Every `team run` saves its full artifact (request, leader plan, teammate
outputs, synthesis) as a timestamped JSON file in `~/.smart-router/sessions/`.
This decision was made because:

- Team runs are expensive (time and sometimes money). Losing the output to a
  scrolled terminal is frustrating.
- The saved artifact can be reopened, shared, committed to a repository, or
  used as context for a follow-up query.
- Session replay (`smart-router team review <id>`) lets a user compare
  multiple runs on the same task across different configurations.

---

## 3. Implementation with Claude Code

### How the Project Was Built

The project was implemented over two months using Claude Code as the primary
coding agent. The initial prompt was:

> Build a standalone TypeScript CLI called `llm-smart-router` that routes a
> prompt to the best available LLM and can run multi-model teammate workflows
> from the terminal.

Claude Code scaffolded the initial structure — project layout, TypeScript
configuration, CLI framework (`commander`), and a first pass at the routing
logic — within a few hours. The core modules that needed subsequent iteration
were the routing classifier, the team orchestrator, and the subscription CLI
integration.

### Where Human Judgment Was Essential

**Request timeout handling**: An early version of the teammate executor could
hang indefinitely when a provider did not respond. Claude Code's initial
implementation had no explicit timeouts, only implicit network-level behavior.
I pushed the implementation toward explicit per-request timeouts (120 seconds
per teammate by default) with clear error messages when a timeout is reached.
This required several rounds of correction because the AI kept reverting to
optimistic assumptions about provider reliability.

**Team fallback behavior**: When a teammate's assigned model failed (401
authentication error, 429 rate limit, or network timeout), an early version
simply marked that teammate as failed and continued. I pushed the
implementation toward trying an alternative model in the same category before
giving up. The fallback chain logic required explicit direction because the
AI's default tendency was to treat model failure as terminal.

**Subscription CLI output parsing**: The `--use-cli` mode required parsing the
stdout of three different CLI tools (Claude Code, Gemini CLI, Codex CLI), each
of which has a different output format, streaming behavior, and error path.
This was one area where the AI produced code that looked correct but had subtle
parsing bugs that only surfaced with real CLI output. Fixing these required
reading the actual subprocess output and manually tracing the parsing logic.

**Project framing**: Beyond code, I steered the project's value proposition.
Claude Code's initial framing centered on "API key management across multiple
providers." I pushed the framing toward the more differentiated story:
cross-model verification, zero-cost CLI hybrid mode, and the parallel agent
team as a first-class workflow. This reframing influenced how features were
prioritized and how the README and examples were written.

### Repository Structure

```
src/
  cli/         # CLI entrypoints, team orchestration, presets, sessions
  lib/         # Routing, model catalog, provider integrations, encryption
  app/         # Optional Next.js web UI and API routes
  components/  # Shared React components (web UI only)
tests/
  unit/
    cli/       # team, leader, teammate, presets, session, output, git-context
    lib/       # router, llm-client, cli-provider, models
examples/      # Runnable examples with real terminal output
```

---

## 4. Evidence It Works

### Continuous Integration

The repository has a GitHub Actions CI pipeline that runs on every push and
pull request to `main`. The matrix covers Node.js 20 and 22.

```
CI steps:
  npm ci                  # reproducible install
  npm run build:cli       # compile TypeScript → dist/cli/
  npm test                # 167 tests, vitest
  npm run lint            # ESLint with eslint-config-next
```

Both matrix legs pass at the current head commit. The CI badge in the README
links directly to the Actions run history.

### Automated Tests (167 passing)

The test suite covers all core modules:

| File | Scope | Tests |
|---|---|---|
| `router.test.ts` | Task classification + model selection | 22 |
| `llm-client.test.ts` | Hybrid CLI/API routing | 19 |
| `cli-provider.test.ts` | CLI detection + subprocess execution | 21 |
| `models.test.ts` | Model catalog and pricing | 15 |
| `team.test.ts` | Full team orchestration flow | 28 |
| `leader.test.ts` | Plan generation and synthesis | 18 |
| `teammate.test.ts` | Parallel execution and fallback | 17 |
| `presets.test.ts` | Preset configuration | 14 |
| `team-session.test.ts` | Session save/load/list | 18 |
| `config.test.ts` | API key storage and encryption | 9 |
| `git-context.test.ts` | Git diff and file context parsing | 13 |
| `output.test.ts` | Terminal formatting | 8 |
| `llm-client-cli.test.ts` | `callLLM` CLI hybrid branch | 6 |
| `team-use-cli.test.ts` | Team run $0 cost rollup | 5 |

```
npm test
→ 167 passed (167)
→ Duration: 2.31s
```

### CLI Functionality

```bash
smart-router --help
```

```
Usage: smart-router [options] [command] [message...]

Route your messages to the best AI model

Options:
  -i, --interactive    Start interactive REPL mode
  -m, --model <model>  Force a specific model
  -t, --tier <tier>    Preferred tier: budget, mid, premium
  -v, --verbose        Show routing details
  --use-cli            Use CLI binaries instead of API ($0 cost)

Commands:
  config               Manage API keys and settings
  team [message...]    Multi-model agent team commands
  models               List available models and their status
  serve [options]      Start the web UI locally
```

### Model Catalog

```bash
smart-router models
```

```
Available Models:
  ✓ GPT-4.1 Nano          openai     budget   $0.40/1M out
  ✓ DeepSeek V3.2         deepseek   budget   $0.028/1M out
  ✓ Gemini 2.5 Flash      google     budget   $0.60/1M out
  ✓ GPT-5.2               openai     premium  $10.00/1M out
  ✓ Claude Sonnet 4.6     anthropic  premium  $15.00/1M out
```

### Team Mode: Saved Successful Session

The following output is from a saved session (`smart-router team review 22afb8d1`)
that was completed successfully in an earlier run with valid provider credentials.

```bash
smart-router team review 22afb8d1
```

```
  Team Session Review
  ─────────────────────────────────────────
  Request: Compare the pros and cons of Python vs Rust for building
           a web scraper. I need: 1) A technical comparison of both
           languages for web scraping, 2) A practical code example
           in each language
  Status: done
  Cost: $0.093648
  Time: 97.9s

  Teammates:
  ✓ Analyst   Claude Sonnet 4   $0.031212
  ✓ Coder     Claude Sonnet 4   $0.062310

  ═══════════════════════════════════════════
  Synthesis:
  ═══════════════════════════════════════════

  # Web Scraping: Python vs Rust Comparison Report

  ## 1. Brief Summary

  Python excels in development speed, ecosystem maturity, and ease
  of learning, making it ideal for rapid prototyping and data-heavy
  scraping tasks. Rust offers superior runtime performance, memory
  efficiency, and deployment simplicity for production-grade systems.

  ## 2. Key Findings

  Performance: Rust is 2–5x faster, uses 2–4x less memory.
  Ecosystem: Python (BeautifulSoup, Scrapy) vs Rust (reqwest, tokio).
  Development speed: Python prototypes 2–3x faster.

  ## 3. Recommendations

  Choose Python for: rapid prototyping, data science integration,
  moderate scraping volume (<thousands of pages/day).

  Choose Rust for: high-volume production systems, resource-
  constrained environments, long-running scrapers.

  ─────────────────────────────────────────
  Total cost: $0.093648
  Session saved: ~/.smart-router/sessions/22afb8d1.json
```

### Team Presets

```bash
smart-router team presets
```

```
Available Team Presets:

  code-review   Code Review Team        3-person code review: security, quality, docs
  debug         Debug Team              3-person debug squad: root cause, fix, tests
  explain       Code Explainer Team     2-person: technical deep-dive + beginner explanation
  refactor      Refactoring Team        3-person: architecture, refactored code, migration plan
```

### Error Handling

```bash
HOME=/tmp/llm-smart-router-empty smart-router "hello"
```

```
No API keys configured.
Run: smart-router config set <provider> <key>
Example: smart-router config set deepseek sk-xxx
```

---

## 5. Semester Evolution — From CLI Tool to Agentic Engineering

### Project 1 → Project 2 → Final Project

This course produced two distinct software tools:

**Project 1 (`plateprep`)** — a narrow Python CLI for preprocessing 96-well
plate-reader CSV files. The scope was intentionally small: one real lab task,
three subcommands, no external API dependencies. Claude Code was used
primarily as a scaffolding tool — it produced an initial structure, and I
refined it.

**Project 2 (`llm-smart-router`, CLI version)** — a TypeScript CLI with smart
routing, multi-model team mode, presets, and session management. Claude Code
was used more extensively: it built the routing logic, provider integrations,
team orchestrator, and test suite. I corrected specific failure modes (timeouts,
fallback behavior) that the AI did not handle robustly without direction.

**Final project (current state)** — the same tool, extended with:
- A web UI with GitHub OAuth and Supabase cloud sync
- `--use-cli` subscription-CLI hybrid mode (zero API cost for team runs)
- GitHub Actions CI/CD pipeline (Node 20 + 22 matrix)
- A project wiki built using the Karpathy wiki methodology (persistent
  knowledge base maintained across Claude Code sessions)

The final project arc is: a student builds an orchestrator for AI models,
using AI to build it, and the orchestrator itself runs AI models as teammates.

### How My Use of Claude Code Changed

**At the beginning of the course**, I used Claude Code as a code generator.
I gave it specific prompts ("add a config subcommand that saves API keys"),
accepted what it produced, and manually fixed problems I found. The mental
model was: AI writes draft code, human reviews and edits.

**By Project 2**, I started using it as a design partner before writing code.
I would describe what I wanted the CLI to do and have Claude Code think through
the design before implementation. I also learned to ask for corrections
explicitly: "the timeout handling is wrong — it should fail after 120 seconds
with this specific error message." The mental model shifted to: human decides
design and invariants, AI implements, human verifies behavior.

**For the final project**, the mental model shifted again. I was using Claude
Code to:
- Maintain a persistent wiki (`wiki/index.md`, `/ingest`, `/query`, `/lint`)
  so that new sessions started with full project context rather than from
  scratch
- Use plan mode to design multi-step changes before executing them
- Orchestrate the tool's own documentation, CI setup, and evidence collection
- Build the subscription CLI hybrid mode, which is itself a form of
  multi-agent orchestration implemented with Claude Code

The irony of the final project is deliberate: `llm-smart-router` coordinates
multi-model teams, and it was built using a multi-session agentic workflow in
Claude Code, with persistent context maintained across sessions.

### What Changed and What Stayed Hard

**What changed:**
- Context management: the wiki + CLAUDE.md approach solved the "each new
  session starts from scratch" problem that frustrated me early on
- Correction specificity: I learned to give Claude Code very precise
  corrections ("the spawn timeout is 120000ms but the error message says 2
  minutes; change the message to '120 seconds'") rather than vague ones
- Design before implementation: using plan mode before touching code prevented
  several classes of rework
- Scope control: explicitly telling Claude Code what not to change was as
  important as telling it what to change

**What stayed hard:**
- Provider-specific edge cases: the AI was consistently too optimistic about
  external service behavior. Every provider integration required explicit
  correction for at least one error path.
- Long session drift: in very long sessions, Claude Code would sometimes
  forget earlier decisions and revert to earlier patterns. The wiki system
  was a partial solution, but not a complete one.
- Verification gaps: Claude Code would sometimes produce code that was
  syntactically correct and semantically plausible but behaviorally wrong.
  Tests helped, but some bugs only surfaced with real CLI output.

---

## 6. Limitations and Future Work

**Provider credential management** — The current BYOK model requires each user
to manually configure API keys. A production version would benefit from
one-command setup (e.g., `smart-router auth` that walks through provider
authentication interactively).

**Routing accuracy** — The seven-category classifier is accurate for clear-cut
cases but ambiguous for mixed requests (e.g., a prompt that asks for both
a mathematical derivation and a code implementation). A more granular or
ensemble-based classifier could improve precision.

**Team failure transparency** — When a teammate fails, the current synthesis
step acknowledges the failure but cannot recover the partial work. A better
design would checkpoint teammate outputs as they arrive, so a partial synthesis
is possible even if one teammate hangs.

**Web UI polish** — The optional Next.js web UI (deployed at
`https://scientific-software-engineering-wit.vercel.app`) works for basic
chat and API key management. The team mode dashboard was improved with
per-teammate elapsed timers, an overall progress bar, a synthesis copy button,
and an expand-all control. The web UI still requires GitHub login, which limits
accessibility for independent users without an account.

**Cross-model verification** — The README frames cross-model verification
(Claude authors → Gemini verifies → Codex challenges → Claude judges) as the
"killer feature," but the current team mode does not natively support this
pipeline. It would require a new preset type with chained rather than parallel
execution.

---

## Appendix: Repository Checklist

| Item | Status |
|---|---|
| GitHub repository (public) | ✓ `github.com/junegu-glitch/llm-smart-router` |
| Tests | ✓ 167 passing (`npm test`) |
| CI badge in README | ✓ GitHub Actions, Node 20 + 22 |
| README with install and usage | ✓ `README.md` |
| Examples of usage | ✓ `examples/` (4 files) |
| License | ✓ MIT |
