# Presentation Speaker Script — `llm-smart-router`

**Total target: ~10 minutes**  
Read at a calm, natural pace. Pause briefly (·) between sentences.

---

## Slide 1 — Title
> ⏱ ~15s

Hi everyone. · I'm June Gu, and today I'm presenting `llm-smart-router` — a multi-model AI agent orchestrator I built this semester for 06-642.

---

## Slide 2 — The Problem
> ⏱ ~55s

Let me start with the problem. · When you're building with AI today, you have access to a lot of different models — Claude, Gemini, GPT, DeepSeek. · And they're genuinely different. · Claude Sonnet is the benchmark leader for code generation. · Gemini 2.5 Pro has a one-million-token context window, which is essential for long documents. · DeepSeek R1 can do mathematical reasoning at fifty-four times cheaper than Claude for comparable accuracy. · And DeepSeek V3 costs less than three cents per million tokens for general tasks.

The problem is that most developers either default to one expensive premium model for everything — which is wasteful — or they manually switch between providers, which is friction. · Neither is good. · **Switching manually is friction. Choosing wrong is waste.**

---

## Slide 3 — The Solution
> ⏱ ~55s

So here's the solution in three commands.

First: you just type your prompt. · The tool automatically classifies the task and routes it to the best available model. · "Implement a binary search tree in Python" goes straight to Claude Sonnet.

Second: for larger tasks, you can run a multi-model team. · `--preset code-review` spins up a SecurityReviewer, a QualityReviewer, and a DocReviewer in parallel — they all look at your code change independently, and a leader model synthesizes their findings.

Third — and this is the headline feature — · `--use-cli` runs the whole team at zero API cost. · I'll explain how in a moment.

One command surface. Best model for each task. Zero dollars with existing subscriptions.

---

## Slide 4 — Architecture
> ⏱ ~50s

Architecturally, there are two layers. · On top: a seven-category router. It classifies every incoming request — coding, writing, math reasoning, analysis, large document, image, or general — and picks the highest-ranked model available for that category, with a fallback chain if the primary provider is unavailable.

Below that: the team orchestrator. · A leader model reads the request and plans the work — how many teammates to spawn, what specialist role each should play, and which model fits each role. · The teammates run in parallel. · Then the leader reads all their outputs and writes a final synthesis.

Both the CLI and the optional web UI share the same `src/lib/` core — so the routing logic is identical whether you're running from the terminal or a browser.

---

## Slide 5 — Key Innovation: $0 Team Mode
> ⏱ ~60s

Now, the key innovation. · Most multi-model agent setups charge you per token for every model call. · This one doesn't have to.

Here's the idea: many developers already pay flat monthly subscriptions for Claude, Gemini, and Codex CLI tools. · Tokens consumed through those CLI binaries don't incur additional API charges. · So if the binary is installed, I route the call through it using `child_process.spawn` instead of the API.

The `--use-cli` flag probes for three binaries at startup: `claude`, `gemini`, and `codex`. · If the binary is there and authenticated, that teammate costs zero API tokens.

The result you're seeing here: three models, ninety-one seconds, total cost **zero dollars**. · If you already pay for these subscriptions, you get a parallel AI team for free.

---

## Slide 6 — Demo — CLI in Action
> ⏱ ~35s

Here's a quick demo of the CLI in action. · You can see the smart-router receiving a prompt, the router classifying it as a coding task, routing it to Claude Sonnet, and streaming the response back — all in a single command. · The verbose flag shows the routing decision and cost.

---

## Slide 7 — Demo — Team Mode
> ⏱ ~40s

And here's team mode. · You can see the four stages: the initial team page with the CLI provider status badges — Claude connected, Gemini connected — · then the task is submitted, · you get a live dashboard while the teammates run in parallel with per-teammate timers, · and finally the synthesis block with the complete final report and a copy button. · Total cost: zero.

---

## Slide 8 — Web UI — Same Tool, Browser Interface
> ⏱ ~50s

Beyond the CLI, I built an optional web UI — deployed at the URL on screen. · It exposes the same routing logic as the CLI, just through a browser interface.

The main additions are: · GitHub OAuth login via Supabase, · AES-256 encrypted API key storage that syncs across devices, · and the team mode dashboard with live updates over SSE — that's Server-Sent Events — so you see each teammate's progress in real time, with timers, a progress bar, and an expand-all button for reviewing individual results.

The CLI and the web share the same `src/lib/` core, so any improvement to the router automatically applies to both surfaces.

---

## Slide 9 — Web UI — Live Demo
> ⏱ ~30s

Here's what the web UI looks like. · On the left you see the smart-routed chat — the model pill shows which model handled the request. · On the right, the team mode dashboard: CLI status badges at the top, live progress bar in the middle, and the synthesis block at the bottom once everything completes.

---

## Slide 10 — Evidence: Tests & CI
> ⏱ ~50s

On the evidence side: the project has one hundred sixty-seven automated tests across fourteen test files. · That includes the full routing logic, team orchestration, CLI hybrid mode, session persistence, and provider fallback chains. · I also added dedicated tests this semester for the CLI hybrid branch specifically — verifying that when CLI mode is on, no API tokens are consumed.

GitHub Actions runs the full test suite on Node twenty and twenty-two on every push. · Both matrix legs are green at the current commit.

---

## Slide 11 — Project Evolution
> ⏱ ~45s

Let me put this in context of the semester. · Project 1 was `plateprep` — a narrow Python CLI for one lab task. No external APIs. · Claude Code was mostly a scaffolding tool there.

Project 2 was the first version of this tool — TypeScript CLI, smart routing, team mode, one hundred fifty-four tests. · I started using Claude Code more as a design partner.

For the final project, I added GitHub Actions CI, the `--use-cli` zero-cost hybrid, the Next.js web UI with Supabase auth on Vercel, and a Karpathy-style project wiki for persistent context across sessions. · Each step was the same tool, but a deeper understanding of what "polished" actually means.

---

## Slide 12 — What I Learned About Agentic Engineering
> ⏱ ~60s

Here's what I learned about working with AI coding agents over the semester.

At the beginning, my mental model was: AI writes a draft, I fix it. · By Project 2, I shifted to specifying failure cases *before* implementation, not after — because fixing a broken timeout handler after it's in three places is much harder than saying upfront "this must fail with a clear message after one hundred twenty seconds."

For the final project, I started using plan mode before any significant change, and built a wiki system so each new session started with full project context rather than from scratch.

But the meta-moment — · I used Claude Code to build a tool that runs Claude, Gemini, and Codex as parallel subprocesses. · The orchestrator was built by an agent. · The agents it orchestrates include the agent that built it.

---

## Slide 13 — Limitations & Future Work
> ⏱ ~40s

To be honest about the limitations: · provider setup still requires manually configuring API keys — a guided `smart-router auth` wizard would lower that barrier significantly. · The router handles clear-cut task types well but struggles with mixed prompts, like something that's both a math derivation and a code implementation. · The cross-model verification pipeline I describe in the README — Claude authors, Gemini verifies, Codex challenges — isn't yet implemented as a preset. · And the web UI, while functional, still requires a GitHub login which limits who can try it independently.

---

## Slide 14 — Thank you
> ⏱ ~20s

That's `llm-smart-router`. · Route your work to the best model, run parallel agent teams, and pay zero with your existing subscriptions. · The repo is public at the address on screen.

---

## Slide 15 — Questions
> ⏱ ~10s

I'll now open it up for questions.
