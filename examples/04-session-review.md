# Example 04 — Session Review

Every `team run` saves a session locally. You can list saved sessions and replay any of them in full — including the leader's plan, each teammate's output, and the final synthesis.

## List Saved Sessions

```bash
smart-router team sessions
```

```
  Saved Team Sessions:

  [1] Compare Python vs Rust for building a web scraper...  3 teammates  $0.094   3/19/2026
  [2] LLM Smart Router README 리뷰 및 개선점 제안          3 teammates  $0.061   3/20/2026
  [3] Review the latest commit changes                      3 teammates  $0.158   3/19/2026

  Use: smart-router team review <number> to view details
```

## Review a Session by Number

```bash
smart-router team review 1
```

## Review a Session by Partial ID

```bash
# Each session has a unique ID — use the first 8 characters
smart-router team review 22afb8d1
```

## Terminal Output (Session 1 — Python vs Rust)

```
  Team Session Review
  ─────────────────────────────────────────
  Request: Compare the pros and cons of Python vs Rust for building a web
           scraper. I need: 1) A technical comparison of both languages
           for web scraping, 2) A practical code example in each language
  Status: done
  Cost: $0.093648
  Time: 97.9s

  Teammates:
  ✓ Analyst   Claude Sonnet 4.6   $0.031212
  ✓ Coder     Claude Sonnet 4.6   $0.062310

  ═══════════════════════════════════════════
  Synthesis:
  ═══════════════════════════════════════════

  # Web Scraping: Python vs Rust Comparison Report

  ## 1. Brief Summary

  Python excels in development speed, ecosystem maturity, and ease of
  learning, making it ideal for rapid prototyping and data-heavy scraping
  tasks. Rust offers superior runtime performance, memory efficiency, and
  deployment simplicity, making it better suited for high-volume,
  production-grade scraping systems.

  ## 2. Key Findings

  ### Analyst's Technical Comparison:
  - Performance: Rust is 2–5x faster, uses 2–4x less memory
  - Ecosystem: Python (BeautifulSoup, Scrapy, requests) vs Rust (reqwest, tokio)
  - Development speed: Python prototypes 2–3x faster; Rust has compile-time safety

  ### Coder's Practical Implementations:
  - Python: requests + BeautifulSoup (sync) and aiohttp (async)
  - Rust: reqwest + tokio with strong typing and custom error types
  - Both: rate limiting, error handling, configurable timeouts

  ## 3. Recommendations

  Choose Python for: rapid prototyping, data science integration,
  moderate scraping volume.

  Choose Rust for: high-volume production systems, resource-constrained
  environments, long-running scrapers.

  ─────────────────────────────────────────
  Teammates: 2  Tasks: 2  Time: 97.9s
  Total cost: $0.093648
```

## Where Sessions Are Stored

Sessions are saved as JSON files in `~/.smart-router/sessions/`:

```bash
ls ~/.smart-router/sessions/
# 2026-03-19_22afb8d1.json
# 2026-03-20_a4b9c3d2.json
# ...
```

Each file contains the full session: request, leader plan, all teammate outputs, and the synthesis. Sessions persist across restarts — you can review runs from weeks ago.

## Why This Matters

Sessions let you:
- **Reference past work** without re-running expensive team runs
- **Compare approaches** across different runs on similar problems
- **Share results** — the JSON file can be committed, shared, or archived
- **Prove execution** — the full transcript is stored, not just the summary
