#!/usr/bin/env python3
"""
Generate demo-team.gif (4 frames) and demo-web.gif (3 frames)
for llm-smart-router presentation slides.

Uses Playwright for screenshots + PIL to compose GIFs.
No real API calls — running/done states are injected via JS.
"""

import asyncio
from pathlib import Path
from PIL import Image
import io

OUTPUT_DIR = Path("/Users/junemog/Documents/GitHub/llm-smart-router/presentation")
BASE_URL = "http://localhost:3000"
WIDTH, HEIGHT = 1400, 900


async def screenshot_bytes(page) -> bytes:
    return await page.screenshot(type="png")


def png_to_pil(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def save_gif(frames: list[tuple[Image.Image, int]], path: Path):
    """frames: list of (PIL.Image, duration_ms)"""
    imgs = [f[0].convert("RGBA") for f in frames]
    durations = [f[1] for f in frames]
    imgs[0].save(
        path,
        save_all=True,
        append_images=imgs[1:],
        optimize=False,
        loop=0,
        duration=durations,
    )
    size_kb = path.stat().st_size // 1024
    print(f"  ✓ {path.name}  {len(frames)} frames  {size_kb} KB")


# ─────────────────────────────────────────────────────────────────────────────
# demo-team.gif  (4 frames)
# Frame 1 — real initial state + CLI badges (✓ Claude ✓ Gemini ✗ Codex)
# Frame 2 — textarea filled with sample task
# Frame 3 — running state injected (progress bar 67%, timers, 2 done 1 running)
# Frame 4 — done state injected (synthesis, $0.00, copy button)
# ─────────────────────────────────────────────────────────────────────────────

TEAM_TASK = "Compare Python vs Rust for a production web scraper: performance, memory, maintainability, and ecosystem maturity."

INJECT_RUNNING = """
(function() {
  // Remove existing dynamic content overlays if any
  document.querySelectorAll('[data-demo-inject]').forEach(e => e.remove());

  const container = document.querySelector('main') || document.body;

  // Build the running dashboard HTML
  const html = `
  <div data-demo-inject style="
    position:fixed; inset:0; z-index:9999;
    background: var(--background, #fff);
    font-family: system-ui, sans-serif;
    display:flex; flex-direction:column; align-items:stretch;
    padding:0;
  ">
    <!-- Header bar -->
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      padding: 12px 24px;
      border-bottom: 1px solid #e5e7eb;
      background:#fff;
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-weight:700; font-size:18px; color:#1a1a2e;">🤖 Smart Team</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#f0f4ff; color:#4f46e5; font-weight:600;">CLI · $0</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#dcfce7; color:#16a34a; font-weight:600;">✓ Claude</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#dcfce7; color:#16a34a; font-weight:600;">✓ Gemini</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#f3f4f6; color:#9ca3af; font-weight:600; text-decoration:line-through;">✗ Codex</span>
      </div>
      <span style="font-size:13px; color:#6b7280;">Running… 23s elapsed</span>
    </div>

    <!-- Progress bar -->
    <div style="height:3px; background:#e5e7eb;">
      <div style="height:3px; width:67%; background:#4f46e5; transition:width 0.5s;"></div>
    </div>

    <!-- Team table -->
    <div style="padding:24px 24px 16px; flex:1; overflow-y:auto;">
      <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">
        Team Progress  2 / 3 complete
      </div>
      <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; background:#fff;">
        <!-- Header row -->
        <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; background:#f9fafb; padding:8px 16px; font-size:12px; font-weight:600; color:#6b7280; border-bottom:1px solid #e5e7eb;">
          <span>TEAMMATE</span><span>MODEL</span><span>STATUS</span><span style="text-align:right;">COST</span>
        </div>
        <!-- Row 1: done -->
        <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; padding:12px 16px; border-bottom:1px solid #f3f4f6; align-items:center;">
          <span style="font-size:14px; font-weight:500;">TechnicalAnalyst</span>
          <span style="font-size:13px; color:#6b7280;">Claude Sonnet 4</span>
          <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#dcfce7; color:#16a34a; font-weight:600; margin:0 16px;">✓ done</span>
          <span style="font-size:13px; color:#6b7280; font-family:monospace; text-align:right;">$0.00</span>
        </div>
        <!-- Row 2: running (highlighted) -->
        <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; padding:12px 16px; border-bottom:1px solid #f3f4f6; align-items:center; background:#f0f4ff;">
          <span style="font-size:14px; font-weight:500; color:#4f46e5;">PythonCoder</span>
          <span style="font-size:13px; color:#6b7280;">Claude Sonnet 4</span>
          <div style="display:flex; align-items:center; gap:6px; margin:0 16px;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#4f46e5; animation:pulse 1.2s infinite;"></span>
            <span style="font-size:12px; color:#4f46e5; font-weight:600;">running</span>
          </div>
          <span style="font-size:12px; color:#4f46e5; font-family:monospace; text-align:right; font-weight:600;">23s</span>
        </div>
        <!-- Row 3: done -->
        <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; padding:12px 16px; align-items:center;">
          <span style="font-size:14px; font-weight:500;">RustCoder</span>
          <span style="font-size:13px; color:#6b7280;">Claude Sonnet 4</span>
          <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#dcfce7; color:#16a34a; font-weight:600; margin:0 16px;">✓ done</span>
          <span style="font-size:13px; color:#6b7280; font-family:monospace; text-align:right;">$0.00</span>
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div style="padding:12px 24px; border-top:1px solid #e5e7eb; background:#f9fafb; font-size:13px; color:#6b7280; display:flex; gap:24px;">
      <span>🔄 PythonCoder working…</span>
      <span style="color:#4f46e5; font-weight:500;">Parallel execution in progress</span>
    </div>
  </div>
  <style>
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  </style>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
})();
"""

INJECT_DONE = """
(function() {
  document.querySelectorAll('[data-demo-inject]').forEach(e => e.remove());

  const html = `
  <div data-demo-inject style="
    position:fixed; inset:0; z-index:9999;
    background: var(--background, #fff);
    font-family: system-ui, sans-serif;
    display:flex; flex-direction:column;
    overflow-y:auto;
  ">
    <!-- Header -->
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      padding: 12px 24px;
      border-bottom: 1px solid #e5e7eb;
      background:#fff; position:sticky; top:0; z-index:10;
    ">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-weight:700; font-size:18px; color:#1a1a2e;">🤖 Smart Team</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#f0f4ff; color:#4f46e5; font-weight:600;">CLI · $0</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#dcfce7; color:#16a34a; font-weight:600;">✓ Claude</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#dcfce7; color:#16a34a; font-weight:600;">✓ Gemini</span>
        <span style="font-size:12px; padding:2px 8px; border-radius:4px; background:#f3f4f6; color:#9ca3af; font-weight:600; text-decoration:line-through;">✗ Codex</span>
      </div>
      <span style="font-size:13px; color:#16a34a; font-weight:600;">✓ Complete  97s  Total: $0.00</span>
    </div>

    <!-- Progress bar full -->
    <div style="height:3px; background:#e5e7eb;">
      <div style="height:3px; width:100%; background:#16a34a;"></div>
    </div>

    <div style="padding:24px; display:flex; flex-direction:column; gap:20px;">
      <!-- Team table: all done -->
      <div>
        <div style="font-size:13px; font-weight:600; color:#374151; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">
          Team Results  3 / 3 complete
        </div>
        <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; background:#fff;">
          <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; background:#f9fafb; padding:8px 16px; font-size:12px; font-weight:600; color:#6b7280; border-bottom:1px solid #e5e7eb;">
            <span>TEAMMATE</span><span>MODEL</span><span>STATUS</span><span style="text-align:right;">COST</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; padding:12px 16px; border-bottom:1px solid #f3f4f6; align-items:center;">
            <span style="font-size:14px; font-weight:500;">TechnicalAnalyst</span>
            <span style="font-size:13px; color:#6b7280;">Claude Sonnet 4</span>
            <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#dcfce7; color:#16a34a; font-weight:600; margin:0 16px;">✓ done</span>
            <span style="font-size:13px; color:#6b7280; font-family:monospace; text-align:right;">$0.00</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; padding:12px 16px; border-bottom:1px solid #f3f4f6; align-items:center;">
            <span style="font-size:14px; font-weight:500;">PythonCoder</span>
            <span style="font-size:13px; color:#6b7280;">Claude Sonnet 4</span>
            <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#dcfce7; color:#16a34a; font-weight:600; margin:0 16px;">✓ done</span>
            <span style="font-size:13px; color:#6b7280; font-family:monospace; text-align:right;">$0.00</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr auto auto; gap:0; padding:12px 16px; align-items:center;">
            <span style="font-size:14px; font-weight:500;">RustCoder</span>
            <span style="font-size:13px; color:#6b7280;">Claude Sonnet 4</span>
            <span style="font-size:12px; padding:2px 8px; border-radius:999px; background:#dcfce7; color:#16a34a; font-weight:600; margin:0 16px;">✓ done</span>
            <span style="font-size:13px; color:#6b7280; font-family:monospace; text-align:right;">$0.00</span>
          </div>
        </div>
      </div>

      <!-- Synthesis block -->
      <div style="border:1px solid #e5e7eb; border-radius:8px; background:#fff; overflow:hidden;">
        <div style="padding:12px 16px; background:#f9fafb; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:14px; font-weight:600; color:#1a1a2e;">📋 Synthesis</span>
          <button style="display:flex; align-items:center; gap:6px; font-size:12px; color:#6b7280; border:1px solid #e5e7eb; padding:4px 10px; border-radius:6px; background:#fff; cursor:pointer;">
            📋 Copy
          </button>
        </div>
        <div style="padding:16px; font-size:14px; line-height:1.7; color:#374151;">
          <strong>Python vs Rust — Expert Synthesis</strong><br><br>
          After analyzing both languages across 3 dimensions:
          <ul style="margin:8px 0 8px 20px;">
            <li><strong>Performance:</strong> Rust wins on raw throughput (3-5× faster), but Python with async/aiohttp bridges 80% of the gap for I/O-bound scrapers.</li>
            <li><strong>Memory:</strong> Rust uses ~5MB resident vs Python's ~50MB. Critical for large-scale concurrent scraping.</li>
            <li><strong>Maintainability:</strong> Python wins — BeautifulSoup/scrapy ecosystem, faster iteration, easier hiring.</li>
          </ul>
          <strong>Recommendation:</strong> Start with Python (scrapy + asyncio). Rewrite hot paths in Rust only if profiling shows CPU bottlenecks above 10%.
        </div>
      </div>

      <!-- Expand all section header -->
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.05em;">Individual Results</span>
        <button style="font-size:12px; color:#6b7280; border:none; background:none; cursor:pointer;">Expand all</button>
      </div>

      <!-- Collapsed teammate cards -->
      <div style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <div style="padding:12px 16px; border-bottom:1px solid #f3f4f6; display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:#fff;">
          <span style="font-size:14px; font-weight:500;">TechnicalAnalyst</span>
          <span style="font-size:12px; color:#6b7280;">▶ Show result</span>
        </div>
        <div style="padding:12px 16px; border-bottom:1px solid #f3f4f6; display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:#fff;">
          <span style="font-size:14px; font-weight:500;">PythonCoder</span>
          <span style="font-size:12px; color:#6b7280;">▶ Show result</span>
        </div>
        <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:#fff;">
          <span style="font-size:14px; font-weight:500;">RustCoder</span>
          <span style="font-size:12px; color:#6b7280;">▶ Show result</span>
        </div>
      </div>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
})();
"""

INJECT_CHAT_DONE = """
(function() {
  document.querySelectorAll('[data-demo-inject]').forEach(e => e.remove());

  const html = `
  <div data-demo-inject style="
    position:fixed; inset:0; z-index:9999;
    background: var(--background, #fff);
    font-family: system-ui, sans-serif;
    display:flex; flex-direction:column;
  ">
    <!-- Nav -->
    <div style="
      display:flex; align-items:center; justify-content:space-between;
      padding: 12px 24px;
      border-bottom: 1px solid #e5e7eb;
      background:#fff;
    ">
      <span style="font-weight:700; font-size:18px; color:#1a1a2e;">🤖 llm-smart-router</span>
      <div style="display:flex; gap:16px; font-size:14px; color:#6b7280;">
        <span style="color:#4f46e5; font-weight:600; border-bottom:2px solid #4f46e5; padding-bottom:2px;">Chat</span>
        <span>Team</span>
        <span>Settings</span>
      </div>
      <span style="font-size:13px; color:#6b7280;">junemog@andrew.cmu.edu</span>
    </div>

    <!-- Chat area -->
    <div style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:16px; max-width:800px; width:100%; margin:0 auto;">
      <!-- User message -->
      <div style="display:flex; justify-content:flex-end;">
        <div style="max-width:70%; padding:12px 16px; background:#4f46e5; color:#fff; border-radius:16px 16px 4px 16px; font-size:14px; line-height:1.6;">
          Write a Python quicksort implementation with type hints
        </div>
      </div>

      <!-- Assistant reply -->
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <div style="width:32px; height:32px; border-radius:50%; background:#f0f4ff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">🤖</div>
        <div style="flex:1;">
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px; display:flex; gap:8px; align-items:center;">
            <span style="padding:2px 8px; border-radius:999px; background:#f0f4ff; color:#4f46e5; font-weight:600; font-size:11px;">Claude Sonnet 4</span>
            <span>→ coding task</span>
            <span style="color:#9ca3af;">$0.0003</span>
          </div>
          <div style="padding:14px 16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:4px 16px 16px 16px; font-size:14px; line-height:1.7; color:#374151;">
            <pre style="background:#1e1e1e; color:#d4d4d4; padding:16px; border-radius:8px; font-size:13px; overflow-x:auto; margin:0;"><code>from typing import TypeVar

T = TypeVar('T', int, float, str)

def quicksort(arr: list[T]) -> list[T]:
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left  = [x for x in arr if x &lt; pivot]
    mid   = [x for x in arr if x == pivot]
    right = [x for x in arr if x &gt; pivot]
    return quicksort(left) + mid + quicksort(right)</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Input bar -->
    <div style="padding:16px 24px; border-top:1px solid #e5e7eb; background:#fff; max-width:800px; width:100%; margin:0 auto;">
      <div style="display:flex; gap:8px; align-items:center;">
        <input placeholder="Ask anything — routes to the best model automatically…"
          style="flex:1; padding:10px 14px; border:1px solid #e5e7eb; border-radius:8px; font-size:14px; color:#374151;" />
        <button style="padding:10px 20px; background:#4f46e5; color:#fff; border-radius:8px; font-size:14px; font-weight:600; border:none; cursor:pointer;">Send</button>
      </div>
    </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
})();
"""


async def gen_team_gif(page):
    print("→ demo-team.gif")
    frames = []

    # Frame 1: real initial state of /team page
    await page.goto(f"{BASE_URL}/team", wait_until="networkidle")
    await page.wait_for_timeout(2000)
    frames.append((png_to_pil(await screenshot_bytes(page)), 2500))
    print("  frame 1: real initial state")

    # Frame 2: fill textarea with task
    try:
        textarea = page.locator("textarea").first
        await textarea.fill(TEAM_TASK)
        await page.wait_for_timeout(800)
    except Exception:
        pass
    frames.append((png_to_pil(await screenshot_bytes(page)), 2000))
    print("  frame 2: task filled in")

    # Frame 3: inject running state
    await page.evaluate(INJECT_RUNNING)
    await page.wait_for_timeout(500)
    frames.append((png_to_pil(await screenshot_bytes(page)), 3000))
    print("  frame 3: running state injected")

    # Frame 4: inject done state
    await page.evaluate(INJECT_DONE)
    await page.wait_for_timeout(500)
    frames.append((png_to_pil(await screenshot_bytes(page)), 3500))
    print("  frame 4: done state injected")

    out = OUTPUT_DIR / "demo-team.gif"
    save_gif(frames, out)


async def gen_web_gif(page):
    print("→ demo-web.gif")
    frames = []

    # Frame 1: chat page — inject a "conversation done" view
    await page.goto(f"{BASE_URL}/", wait_until="networkidle")
    await page.wait_for_timeout(1500)
    await page.evaluate(INJECT_CHAT_DONE)
    await page.wait_for_timeout(500)
    frames.append((png_to_pil(await screenshot_bytes(page)), 2500))
    print("  frame 1: chat page")

    # Frame 2: team page real initial state
    await page.goto(f"{BASE_URL}/team", wait_until="networkidle")
    await page.wait_for_timeout(1500)
    frames.append((png_to_pil(await screenshot_bytes(page)), 2000))
    print("  frame 2: team page initial")

    # Frame 3: inject done state on team page
    await page.evaluate(INJECT_DONE)
    await page.wait_for_timeout(500)
    frames.append((png_to_pil(await screenshot_bytes(page)), 3500))
    print("  frame 3: team done state")

    out = OUTPUT_DIR / "demo-web.gif"
    save_gif(frames, out)


async def main():
    from playwright.async_api import async_playwright

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1.5,
        )

        # Generate team GIF
        page = await context.new_page()
        await gen_team_gif(page)
        await page.close()

        # Generate web GIF
        page = await context.new_page()
        await gen_web_gif(page)
        await page.close()

        await browser.close()

    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
