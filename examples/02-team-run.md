# Example 02 — Team Run

`smart-router team run` spins up a multi-model agent team: a leader plans the work, teammates execute in parallel, and the leader synthesizes a final report.

## Command

```bash
smart-router team run --no-interactive \
  "Compare Python vs Rust for building a web scraper. \
   I need: 1) a technical comparison of both languages, \
   2) a practical code example in each language"
```

Add `--use-cli` to run at $0 cost with your subscription CLIs:

```bash
smart-router team run --no-interactive --use-cli \
  "Compare Python vs Rust for building a web scraper..."
```

## Terminal Output

```
  Smart Team — Multi-model agent team
  Request: Compare Python vs Rust for building a web scraper. I need:
           1) a technical comparison, 2) a practical code example in each language

  - Leader analyzing request...
  ✔ Leader planned: 3 teammates, 3 tasks

  Team Composition:
  ├─ TechnicalAnalyst  Claude Sonnet 4.6  1 task(s)
  │   Conducts a detailed technical comparison of Python and Rust for
  │   web scraping: performance, ecosystem, concurrency, error handling.
  ├─ PythonCoder       GPT-4.1            1 task(s)
  │   Develops a practical Python web scraper with BeautifulSoup.
  ├─ RustCoder         Claude Sonnet 4.6  1 task(s)
  │   Develops a comparable Rust web scraper using reqwest + tokio.

  ┌──────────────────────────────────────────────────────────┐
  │ Live Dashboard                   3/3 complete  97s  │
  ├─────────────────┬──────────────────┬──────────┬──────────┤
  │ Teammate        │ Model            │ Status   │ Cost     │
  ├─────────────────┼──────────────────┼──────────┼──────────┤
  │ TechnicalAnalyst│ Claude Sonnet 4  │ ✓ done   │ $0.031   │
  │ PythonCoder     │ GPT-4.1          │ ✓ done   │ $0.001   │
  │ RustCoder       │ Claude Sonnet 4  │ ✓ done   │ $0.062   │
  └─────────────────┴──────────────────┴──────────┴──────────┘

  - Leader synthesizing results...
  ✔ Leader synthesized all results

  ═══════════════════════════════════════════
  Final Report
  ═══════════════════════════════════════════

  # Web Scraping: Python vs Rust Comparison Report

  ## 1. Brief Summary

  Python excels in development speed, ecosystem maturity, and ease of
  learning, making it ideal for rapid prototyping. Rust offers superior
  runtime performance and memory efficiency for high-volume production
  systems. The choice depends on performance needs vs development velocity.

  ## 2. Key Findings from Each Teammate

  ### Analyst's Technical Comparison:

  - **Performance**: Rust is 2–5x faster, uses 2–4x less memory
  - **Ecosystem**: Python has BeautifulSoup, Scrapy, requests; Rust's
    ecosystem is growing but less mature
  - **Dev speed**: Python is 2–3x faster to prototype; Rust has a
    steeper learning curve but compile-time safety guarantees

  ### Coder's Implementations:

  - **Python**: requests + BeautifulSoup (sync) and aiohttp (async),
    with rate limiting, error handling, and configurable concurrency
  - **Rust**: reqwest + tokio, strong typing with custom error types,
    selector fallback, URL normalization, single-binary deployment

  ## 3. Recommendations

  Choose **Python** for: rapid prototyping, data science integration,
  moderate volume (< thousands of pages/day), Python-familiar teams.

  Choose **Rust** for: high-volume production systems, resource-
  constrained environments, long-running scrapers, maximum performance.

  ─────────────────────────────────────────
  Team Summary:
  Teammates: 3  Tasks: 3  Time: 97.9s
  ✓ TechnicalAnalyst  Claude Sonnet 4  $0.031212
  ✓ PythonCoder       GPT-4.1          $0.000136
  ✓ RustCoder         Claude Sonnet 4  $0.062310
  Total cost: $0.093648
  Session saved: ~/.smart-router/sessions/2026-03-19_22afb8d1.json
```

## What's Happening

1. **Leader plans** — Analyzes the request and decides how many teammates to assign, what roles they need, and which model is best for each role.
2. **Parallel execution** — All teammates run simultaneously. The Live Dashboard shows real-time progress.
3. **Synthesis** — The leader reads all teammate outputs and writes a unified final report that reconciles findings and highlights any conflicts.
4. **Session saved** — The full session (inputs, teammate outputs, synthesis) is saved locally for later review.

## $0 with `--use-cli`

With `--use-cli`, each teammate uses your subscription CLI instead of billable API tokens:

```bash
smart-router team run --use-cli "Compare Python vs Rust..."
# Claude teammates → Claude Code CLI (your Anthropic subscription)
# Gemini teammates → Gemini CLI (your Google subscription)
# Codex teammates  → Codex CLI  (your OpenAI subscription)
# Total API cost: $0.00
```

See [Example 04](./04-session-review.md) to replay a saved session.
