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

Many of us in research and academic settings have access to multiple LLM
subscriptions simultaneously. At CMU, students receive a year of Gemini
access; Prof. Kitchin provided the class with Claude subscriptions; and some
of us personally subscribe to Codex CLI as well. Yet almost all of these are
$20/month plans with limited monthly tokens, and the models run out faster
than expected.

Anthropic has demonstrated an "agent team" pattern where you structure a group
of AI agents with distinct roles — CEO, designer, finance manager — and let
them collaborate on a problem. This pattern is compelling for two reasons:

1. **Context accumulation** — in a single long session, as context piles up, the
   agent degrades. Every developer who has worked through a complex project in
   one session has felt this. Agent teams avoid it because each teammate has
   its own fresh context window.

2. **Parallel specialization** — teammates share only the information that is
   necessary, similar to how people collaborate in a company. Each agent stays
   in its optimal context range.

The problem: if you run this kind of agent team entirely within one LLM
subscription, you exhaust tokens extremely quickly. And if you switch to a
different provider mid-project, you lose workflow continuity — reloading
context into the new model costs more tokens and introduces inconsistency.

The core question that motivated this project: **Can we form an agent team
that spans different LLM services, so that we can use tokens efficiently
across subscriptions without losing workflow continuity?**

`llm-smart-router` answers that question from the command line:

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

Building this tool required me to form personal opinions about each model's
strengths — not from benchmarks alone, but from extended use across different
task types:

- **Claude** — the strongest model I have used for reasoning and coding. However,
  its token allocation runs out faster than any other subscription I have.
- **Gemini** — has a one-million-token context window, which is essential for
  long documents, and provides the most generous token allowance of any plan.
- **Codex** — solid overall performance, with a particular strength in planning
  and structured problem decomposition.
- **DeepSeek V3** — API-only (no CLI binary), but at under three cents per million
  output tokens it is the cheapest capable model for undifferentiated general tasks.

The simplest routing approach would be "complex task → premium model, simple
task → cheap model." I rejected this because it loses precision: a mathematical
proof is complex but benefits specifically from a reasoning-tuned model
(DeepSeek R1), not just any premium model. A large-document analysis benefits
specifically from a 1M-context model (Gemini 2.5 Pro), not a faster coding-focused
model.

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

### Multi-Model Collaborative Development

One of the less obvious design choices was to use multiple different AI models
during development itself — not just as the target of the router, but as
collaborators with distinct roles in building it.

**Novelty validation**: Before committing to this project direction, I asked
Gemini to deep-research whether the idea was novel. It took approximately 20
minutes and returned a thorough competitive landscape analysis. There are some
adjacent projects, but the specific combination of cross-subscription CLI
hybrid mode, smart routing, and team orchestration still appeared to be
novel. That answer cleared the way to keep working.

**Development loop**: For significant technical decisions, I developed a
multi-model loop: I would use Claude to ultra-plan the approach, send the
plan to Codex for adversarial review, bring the review back to Claude to
discuss whether the critiques were valid, and separately discuss my own
intuitions with Gemini. This was not a formal pipeline — it was conversational
and iterative — but it consistently surfaced perspectives I would not have
reached in a single-model session.

The key observation from this process: different models have genuinely distinct
reasonable perspectives, not just stylistically but architecturally. Claude
tends to think from correctness and safety first; Codex tends to think from
structure and planning; Gemini tends to take a broader systems view. Using all
three produced better designs than any one alone.

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

### Why a Web UI

I have been using the terminal since joining Kitchin lab, but before that
I had no command-line experience. Building this tool for researchers and
students who are in the same position I was — technically capable, but not
yet comfortable in a terminal — motivated the optional web UI. The goal was
an interface that could be used intuitively by anyone who had already
interacted with a chat-based AI product, without requiring any CLI knowledge.
The CLI and the web UI share the same `src/lib/` routing and orchestration
core, so any improvement to the router applies equally to both surfaces.

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

**At the beginning of the course**: AI writes a draft, I fix it. I gave Claude
Code specific prompts, accepted what it produced, and manually corrected
problems I found. The mental model was entirely reactive — wait for output, then
review.

**By Project 2**: I started planning thoroughly before executing. I would
discuss with Claude whether my overall approach made sense before writing any
code. The shift was from "generate code" to "validate ideas." I also learned
to ask for corrections explicitly: "the timeout handling is wrong — it should
fail after 120 seconds with this specific error message." The mental model
shifted to: human decides design and invariants, AI implements, human
verifies behavior.

**For the final project**, the mental model shifted again. I was using:
- Plan mode before any significant change
- A persistent wiki (`wiki/index.md`, `/ingest`, `/query`, `/lint`) so that
  each new session started with full project context rather than from scratch
- Multiple different models for different roles in development itself
  (planning with Claude, review with Codex, perspective checks with Gemini)

The meta-moment of the project is deliberate: I used Claude Code to build a
tool that runs Claude, Gemini, and Codex as parallel subprocesses. The
orchestrator was built by an agent. The agents it orchestrates include the
agent that built it.

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

**Provider setup friction** — The current BYOK model requires each user to
manually configure API keys per provider. A guided `smart-router auth` wizard
that walks through authentication for each supported provider would
significantly lower this barrier, especially for users who are not comfortable
with terminal configuration.

**Routing edge cases** — The seven-category classifier handles clear-cut task
types well but struggles with mixed prompts. A request that is simultaneously
a mathematical derivation and a code implementation does not map cleanly to
a single category. A more granular or ensemble-based classifier could improve
precision for ambiguous inputs.

**Cross-model verification** — The README describes a cross-model verification
pipeline (Claude authors → Gemini verifies → Codex challenges → Claude judges)
as a natural extension of the team mode. This pipeline is not yet implemented
as a preset. It would require chained rather than parallel execution, which is
a different orchestration model from what currently exists.

**Maintenance** — I do not personally know how to write TypeScript. This
project was designed and implemented with AI coding tools throughout. If a
significant bug surfaces six months from now — a provider API change, a
breaking dependency update, a parsing regression in the CLI hybrid mode — I
am not certain I can debug and fix it without AI assistance. This is an honest
limitation of building in a language you do not yet own. It also raises a
broader question about the long-term maintainability of AI-authored codebases
when the human collaborator's debugging depth is shallower than the code's
complexity.

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
