const pptxgen = require("/opt/homebrew/lib/node_modules/pptxgenjs");

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  navy:    "1a1a2e",
  navy2:   "16213e",
  indigo:  "4f46e5",
  indigoL: "eef2ff",
  white:   "FFFFFF",
  gray50:  "F9FAFB",
  gray100: "F3F4F6",
  gray200: "E5E7EB",
  gray400: "9CA3AF",
  gray600: "4B5563",
  gray700: "374151",
  gray900: "111827",
  green:   "16a34a",
  code_bg: "1e1e1e",
  code_fg: "D4D4D4",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" × 5.625"
pres.title  = "llm-smart-router";
pres.author = "June Gu";

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: C.navy };
  return s;
}

function lightSlide() {
  const s = pres.addSlide();
  s.background = { color: C.white };
  return s;
}

// Slide-level accent bar at top (indigo, 0.06" tall)
function topBar(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: C.indigo }, line: { color: C.indigo },
  });
}

function darkTopBar(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: "7c77f0" }, line: { color: "7c77f0" },
  });
}

// Standard slide title on a light slide
function slideTitle(slide, text, y = 0.25) {
  slide.addText(text, {
    x: 0.45, y, w: 9.1, h: 0.55,
    fontSize: 26, bold: true, color: C.navy, fontFace: "Calibri",
    margin: 0,
  });
  // Thin separator line under title
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: y + 0.55, w: 9.1, h: 0.025,
    fill: { color: C.indigo }, line: { color: C.indigo },
  });
}

// Code block (dark bg, monospace)
function codeBlock(slide, text, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: C.code_bg },
    line: { color: "2d2d2d" },
  });
  slide.addText(text, {
    x: x + 0.12, y: y + 0.08, w: w - 0.24, h: h - 0.16,
    fontSize: 10.5, fontFace: "Consolas", color: C.code_fg,
    valign: "top", margin: 0,
  });
}

// Small indigo badge
function badge(slide, text, x, y) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: text.length * 0.095 + 0.2, h: 0.22,
    fill: { color: C.indigoL }, line: { color: C.indigoL },
    rectRadius: 0.04,
  });
  slide.addText(text, {
    x, y, w: text.length * 0.095 + 0.2, h: 0.22,
    fontSize: 9, color: C.indigo, bold: true, align: "center",
    fontFace: "Calibri", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 1 — Title (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = darkSlide();
  darkTopBar(s);

  // Decorative background rect
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 3.8, w: 10, h: 1.825,
    fill: { color: "0d0d20" }, line: { color: "0d0d20" },
  });

  // Main title
  s.addText("`llm-smart-router`", {
    x: 0.5, y: 1.2, w: 9, h: 1.0,
    fontSize: 44, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", margin: 0,
  });

  // Subtitle
  s.addText("Multi-model AI agent orchestrator", {
    x: 0.5, y: 2.25, w: 9, h: 0.5,
    fontSize: 22, color: "a5b4fc", fontFace: "Calibri",
    align: "center", italic: true, margin: 0,
  });

  // Separator
  s.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 2.9, w: 3, h: 0.04,
    fill: { color: C.indigo }, line: { color: C.indigo },
  });

  // Meta info
  s.addText("June Gu  ·  CMU 06-642  ·  Spring 2026", {
    x: 0.5, y: 4.0, w: 9, h: 0.4,
    fontSize: 14, color: "c7d2fe", fontFace: "Calibri",
    align: "center", margin: 0,
  });
  s.addText("github.com/junegu-glitch/llm-smart-router", {
    x: 0.5, y: 4.45, w: 9, h: 0.35,
    fontSize: 12, color: "818cf8", fontFace: "Consolas",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 2 — The Problem
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "The Problem");

  s.addText("Most AI workflows treat every task as input to one chat window.\nBut models have real specializations:", {
    x: 0.45, y: 0.92, w: 9.1, h: 0.6,
    fontSize: 13, color: C.gray700, fontFace: "Calibri", margin: 0,
  });

  // Table
  const rows = [
    [
      { text: "Task",      options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: "Best fit",  options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: "Why",       options: { bold: true, color: C.white, fill: { color: C.navy } } },
    ],
    ["Code generation",  "Claude Sonnet 4",    "Benchmark leader"],
    ["Long documents",   "Gemini 2.5 Pro",     "1M token context"],
    ["Math / reasoning", "DeepSeek R1",        "54× cheaper than Claude"],
    ["General / cheap",  "DeepSeek V3",        "$0.028 / 1M tokens"],
  ];
  s.addTable(rows, {
    x: 0.45, y: 1.58, w: 9.1, h: 2.7,
    colW: [2.4, 2.6, 4.1],
    fontSize: 13, fontFace: "Calibri", color: C.gray700,
    border: { pt: 0.5, color: C.gray200 },
    rowH: 0.52,
    align: "left",
  });

  s.addText("Switching manually is friction. Choosing wrong is waste.", {
    x: 0.45, y: 4.58, w: 9.1, h: 0.35,
    fontSize: 14, bold: true, color: C.indigo, fontFace: "Calibri",
    italic: true, margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 3 — The Solution
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "The Solution");

  codeBlock(s,
`# Automatically routes to the right model
smart-router "Implement a binary search tree in Python"
→ Route: [coding] → Claude Sonnet 4

# Multi-model team for larger tasks
smart-router team run --preset code-review --git-diff "Review my changes"
→ SecurityReviewer + QualityReviewer + DocReviewer → Synthesis

# Zero cost with subscription CLIs
smart-router team run --use-cli "Compare React vs Vue"
→ Cost: $0.00`,
    0.45, 1.05, 9.1, 2.7
  );

  s.addText("One command surface. Best model for each task. $0 with existing subscriptions.", {
    x: 0.45, y: 4.0, w: 9.1, h: 0.45,
    fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 4 — Architecture
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "Architecture");

  // Left: diagram boxes
  const boxes = [
    { label: "User Input",           y: 1.05, bg: C.navy,    fg: C.white },
    { label: "Router  (7-category classifier)", y: 1.75, bg: C.indigo, fg: C.white },
    { label: "Team Orchestrator",    y: 2.45, bg: C.navy2,   fg: C.white },
    { label: "Leader synthesizes → Final Report", y: 4.15, bg: "065A82", fg: C.white },
  ];

  boxes.forEach(b => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: b.y, w: 4.5, h: 0.55,
      fill: { color: b.bg }, line: { color: b.bg },
    });
    s.addText(b.label, {
      x: 0.4, y: b.y, w: 4.5, h: 0.55,
      fontSize: 12, bold: true, color: b.fg, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });
  });

  // Three parallel agent boxes
  const agents = [
    { name: "Claude\n[coding]",    x: 0.4 },
    { name: "GPT-4o\n[writing]",   x: 1.95 },
    { name: "Gemini\n[research]",  x: 3.5  },
  ];
  agents.forEach(a => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: a.x, y: 3.15, w: 1.4, h: 0.85,
      fill: { color: C.gray100 }, line: { color: C.gray200 },
    });
    s.addText(a.name, {
      x: a.x, y: 3.15, w: 1.4, h: 0.85,
      fontSize: 10.5, color: C.gray700, fontFace: "Calibri",
      align: "center", valign: "middle", margin: 0,
    });
  });

  s.addText("← parallel", {
    x: 4.95, y: 3.35, w: 1.2, h: 0.4,
    fontSize: 10, color: C.indigo, italic: true, fontFace: "Calibri", margin: 0,
  });

  // Right: text description
  s.addText("CLI layer", {
    x: 5.5, y: 1.15, w: 4.1, h: 0.3,
    fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
  });
  s.addText("src/cli/ — commands: query, team, serve", {
    x: 5.5, y: 1.48, w: 4.1, h: 0.3,
    fontSize: 11.5, color: C.gray600, fontFace: "Consolas", margin: 0,
  });

  s.addText("Web layer", {
    x: 5.5, y: 2.05, w: 4.1, h: 0.3,
    fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
  });
  s.addText("src/app/ — Next.js 16, SSE, Supabase", {
    x: 5.5, y: 2.38, w: 4.1, h: 0.3,
    fontSize: 11.5, color: C.gray600, fontFace: "Consolas", margin: 0,
  });

  s.addText("Shared core", {
    x: 5.5, y: 2.95, w: 4.1, h: 0.3,
    fontSize: 14, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
  });
  s.addText([
    { text: "src/lib/", options: { fontFace: "Consolas", breakLine: true } },
    { text: "routing · models · provider calls · CLI hybrid", options: { fontFace: "Calibri" } },
  ], {
    x: 5.5, y: 3.28, w: 4.1, h: 0.5,
    fontSize: 11.5, color: C.gray600, margin: 0,
  });

  s.addText("Both CLI and web share the same src/lib/ core.", {
    x: 0.4, y: 5.18, w: 9.2, h: 0.3,
    fontSize: 11, color: C.gray400, fontFace: "Calibri", italic: true, margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 5 — Key Innovation: $0 Team Mode
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "Key Innovation: $0 Team Mode");

  s.addText("Most teams cost money per token. This one doesn't have to.", {
    x: 0.45, y: 0.95, w: 9.1, h: 0.35,
    fontSize: 13, color: C.gray700, fontFace: "Calibri", margin: 0,
  });

  s.addText("--use-cli flag — routes each teammate through locally installed subscription CLIs:", {
    x: 0.45, y: 1.38, w: 9.1, h: 0.32,
    fontSize: 13, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
  });

  // Three CLI mapping boxes
  const mappings = [
    { cli: "claude CLI",  provider: "Anthropic subscription", color: C.indigo },
    { cli: "gemini CLI",  provider: "Google subscription",    color: "0891B2" },
    { cli: "codex CLI",   provider: "OpenAI subscription",    color: "16a34a" },
  ];
  mappings.forEach((m, i) => {
    const x = 0.45 + i * 3.08;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.82, w: 2.8, h: 0.9,
      fill: { color: m.color }, line: { color: m.color },
    });
    s.addText(m.cli, {
      x, y: 1.82, w: 2.8, h: 0.45,
      fontSize: 13, bold: true, color: C.white, fontFace: "Consolas",
      align: "center", valign: "bottom", margin: 0,
    });
    s.addText(m.provider, {
      x, y: 2.27, w: 2.8, h: 0.45,
      fontSize: 11, color: "e0e7ff", fontFace: "Calibri",
      align: "center", valign: "top", margin: 0,
    });
  });

  codeBlock(s,
`smart-router team run --use-cli \\
  "Compare Python vs Rust for a web scraper"

Total cost: $0.00   (3 models, 91 seconds)`,
    0.45, 2.9, 9.1, 1.4
  );

  s.addText("If you already pay for these subscriptions, team runs cost $0 in API tokens.", {
    x: 0.45, y: 4.45, w: 9.1, h: 0.35,
    fontSize: 13, bold: true, color: C.indigo, italic: true, fontFace: "Calibri", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 6 — Demo — CLI in Action (GIF placeholder)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = darkSlide();
  darkTopBar(s);

  s.addText("Demo — CLI in Action", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 32, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 1, y: 1.2, w: 8, h: 3.4,
    fill: { color: "0d1117" }, line: { color: C.indigo, pt: 2 },
  });

  s.addText("[ demo-cli.gif ]", {
    x: 1, y: 2.3, w: 8, h: 1.2,
    fontSize: 18, color: C.gray400, fontFace: "Consolas",
    align: "center", valign: "middle", margin: 0,
  });

  s.addText("smart-router team run --use-cli \"Compare Python vs Rust\"", {
    x: 1, y: 4.78, w: 8, h: 0.35,
    fontSize: 11, color: "818cf8", fontFace: "Consolas",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 7 — Demo — Team Mode (GIF placeholder)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = darkSlide();
  darkTopBar(s);

  s.addText("Demo — Team Mode", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 32, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 1, y: 1.2, w: 8, h: 3.4,
    fill: { color: "0d1117" }, line: { color: C.indigo, pt: 2 },
  });

  s.addText("[ demo-team.gif ]", {
    x: 1, y: 2.3, w: 8, h: 1.2,
    fontSize: 18, color: C.gray400, fontFace: "Consolas",
    align: "center", valign: "middle", margin: 0,
  });

  s.addText("Initial → Task Input → Running (timers, progress bar) → Done (synthesis, $0.00)", {
    x: 1, y: 4.78, w: 8, h: 0.35,
    fontSize: 11, color: "818cf8", fontFace: "Calibri",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 8 — Web UI — Same Tool, Browser Interface
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "Web UI — Same Tool, Browser Interface");

  s.addText("Live at: https://scientific-software-engineering-wit.vercel.app", {
    x: 0.45, y: 0.96, w: 9.1, h: 0.28,
    fontSize: 11.5, color: C.indigo, fontFace: "Consolas", margin: 0,
  });

  const rows = [
    [
      { text: "Feature",      options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: "Stack",        options: { bold: true, color: C.white, fill: { color: C.navy } } },
    ],
    ["Smart-routed chat",        "Same routing logic as CLI"],
    ["Team Mode (/team)",        "SSE streaming, live dashboard, preset selector"],
    ["Live team dashboard",      "Per-teammate timer, progress bar, expand all"],
    ["GitHub OAuth login",       "Supabase Auth"],
    ["API key management",       "AES-256-GCM encrypted, cloud-synced"],
    ["Dark / light mode",        "Tailwind + system preference"],
  ];
  s.addTable(rows, {
    x: 0.45, y: 1.3, w: 9.1, h: 3.5,
    colW: [3.5, 5.6],
    fontSize: 12.5, fontFace: "Calibri", color: C.gray700,
    border: { pt: 0.5, color: C.gray200 },
    rowH: 0.46,
    align: "left",
  });

  s.addText("CLI and web share the same src/lib/ core — routing, model catalog, provider calls.", {
    x: 0.45, y: 5.05, w: 9.1, h: 0.3,
    fontSize: 11, italic: true, color: C.gray400, fontFace: "Calibri", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 9 — Web UI — Live Demo (GIF placeholder)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = darkSlide();
  darkTopBar(s);

  s.addText("Web UI — Live Demo", {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    fontSize: 32, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 1, y: 1.2, w: 8, h: 3.4,
    fill: { color: "0d1117" }, line: { color: "0891B2", pt: 2 },
  });

  s.addText("[ demo-web.gif ]", {
    x: 1, y: 2.3, w: 8, h: 1.2,
    fontSize: 18, color: C.gray400, fontFace: "Consolas",
    align: "center", valign: "middle", margin: 0,
  });

  s.addText("Chat → Team page → Done state (synthesis, CLI badges)", {
    x: 1, y: 4.78, w: 8, h: 0.35,
    fontSize: 11, color: "67e8f9", fontFace: "Calibri",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 10 — Evidence: Tests & CI
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "Evidence: Tests & CI");

  // Left column
  s.addText("167 automated tests across 14 test files:", {
    x: 0.45, y: 0.95, w: 5.5, h: 0.3,
    fontSize: 13, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
  });

  codeBlock(s,
`npm test  →  167 passed (167)  in 2.31s`,
    0.45, 1.3, 5.5, 0.55
  );

  const rows = [
    [
      { text: "Covered",                   options: { bold: true, color: C.white, fill: { color: C.navy } } },
      { text: "Tests",                     options: { bold: true, color: C.white, fill: { color: C.navy }, align: "center" } },
    ],
    ["Router (classification + model selection)", "22"],
    ["Team orchestration (plan→parallel→synthesize)", "28"],
    ["CLI hybrid mode (detection + subprocess)", "21"],
    ["Session save / load / list",              "18"],
    ["Provider fallback chains",               "19"],
    ["callLLM CLI hybrid branch (new)",        "6"],
    ["Team run $0 cost rollup (new)",          "5"],
  ];
  s.addTable(rows, {
    x: 0.45, y: 2.0, w: 5.5, h: 3.25,
    colW: [4.4, 1.1],
    fontSize: 11, fontFace: "Calibri", color: C.gray700,
    border: { pt: 0.5, color: C.gray200 },
    rowH: 0.38,
    align: "left",
  });

  // Right column: CI info
  s.addText("GitHub Actions CI", {
    x: 6.2, y: 0.95, w: 3.4, h: 0.32,
    fontSize: 15, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
  });

  codeBlock(s,
`npm ci
npm run build:cli
npm test
npm run lint`,
    6.2, 1.3, 3.4, 1.2
  );

  s.addText("Node 20 + 22 matrix\n✓ Both matrix legs green", {
    x: 6.2, y: 2.62, w: 3.4, h: 0.6,
    fontSize: 12, color: C.gray700, fontFace: "Calibri", margin: 0,
  });

  // Badge placeholder
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.2, y: 3.35, w: 3.4, h: 0.55,
    fill: { color: C.indigoL }, line: { color: C.indigo, pt: 1 },
  });
  s.addText("CI: passing  Node 20 | 22", {
    x: 6.2, y: 3.35, w: 3.4, h: 0.55,
    fontSize: 12, color: C.indigo, bold: true, fontFace: "Calibri",
    align: "center", valign: "middle", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 11 — Project Evolution
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "Project Evolution");

  const stages = [
    {
      label: "Project 1\nplateprep",
      desc: "Python CLI, narrow scope,\none lab task. No external APIs.",
      color: C.gray400,
      y: 1.1,
    },
    {
      label: "Project 2\nllm-smart-router (CLI)",
      desc: "TypeScript CLI, smart routing,\nteam mode. 154 tests, provider integrations.",
      color: "0891B2",
      y: 2.25,
    },
    {
      label: "Final Project\n(current)",
      desc: "+ GitHub Actions CI (Node 20+22)\n+ --use-cli subscription hybrid ($0 cost)\n+ Next.js web UI + Supabase auth + Vercel\n+ Karpathy-style wiki (persistent context)\n+ Public GitHub repo",
      color: C.indigo,
      y: 3.4,
    },
  ];

  stages.forEach(st => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.45, y: st.y, w: 0.08, h: 0.75,
      fill: { color: st.color }, line: { color: st.color },
    });
    s.addText(st.label, {
      x: 0.7, y: st.y, w: 2.8, h: 0.75,
      fontSize: 12, bold: true, color: st.color, fontFace: "Calibri",
      valign: "middle", margin: 0,
    });
    s.addText(st.desc, {
      x: 3.6, y: st.y, w: 6, h: 0.75,
      fontSize: 11.5, color: C.gray700, fontFace: "Calibri",
      valign: "middle", margin: 0,
    });
  });

  s.addText("Each step: same tool, deeper understanding of what \"polished\" means.", {
    x: 0.45, y: 5.1, w: 9.1, h: 0.3,
    fontSize: 12, italic: true, color: C.gray400, fontFace: "Calibri", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 12 — What I Learned About Agentic Engineering
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "What I Learned About Agentic Engineering");

  const points = [
    { time: "Beginning of semester:", text: "AI writes draft → I fix it" },
    { time: "By Project 2:",           text: "Specify failure cases before implementation, not after" },
    { time: "For final project:",      text: null, bullets: [
      "Plan mode before any significant change",
      "Wiki system for context across sessions (/ingest, /query, /lint)",
      "Stating invariants explicitly beats correcting output",
    ]},
  ];

  let y = 1.05;
  points.forEach(p => {
    s.addText([
      { text: p.time + " ", options: { bold: true, color: C.indigo } },
      ...(p.text ? [{ text: p.text, options: { color: C.gray700 } }] : []),
    ], {
      x: 0.45, y, w: 9.1, h: 0.35,
      fontSize: 13, fontFace: "Calibri", margin: 0,
    });
    y += 0.38;

    if (p.bullets) {
      p.bullets.forEach(b => {
        s.addText([{ text: b, options: { bullet: true } }], {
          x: 0.75, y, w: 8.8, h: 0.3,
          fontSize: 12, color: C.gray700, fontFace: "Calibri", margin: 0,
        });
        y += 0.32;
      });
    }
  });

  // Quote box
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 3.6, w: 0.055, h: 1.35,
    fill: { color: C.indigo }, line: { color: C.indigo },
  });
  s.addText(
    "The meta-moment: Used Claude Code to build a tool that runs Claude, Gemini, and Codex as parallel subprocesses.\n\nThe orchestrator was built by an agent. The agents it orchestrates include the agent that built it.",
    {
      x: 0.65, y: 3.6, w: 8.9, h: 1.35,
      fontSize: 12.5, italic: true, color: C.navy, fontFace: "Calibri",
      valign: "middle", margin: 0,
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 13 — Limitations & Future Work
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = lightSlide();
  topBar(s);
  slideTitle(s, "Limitations & Future Work");

  const items = [
    {
      title: "Provider setup friction",
      body: "BYOK requires manual config set per provider; a guided smart-router auth wizard would lower the barrier.",
    },
    {
      title: "Routing edge cases",
      body: "Mixed-type prompts (math + code) aren't classified well; ensemble classifier could improve precision.",
    },
    {
      title: "Cross-model verification",
      body: "Claude → Gemini → Codex → Claude judge pipeline described in README, but not yet implemented as a preset.",
    },
    {
      title: "Web UI",
      body: "Functional (OAuth, cloud sync, chat, team dashboard), but requires GitHub login — limits accessibility for independent users.",
    },
  ];

  items.forEach((item, i) => {
    const x = i % 2 === 0 ? 0.4 : 5.15;
    const y = i < 2 ? 1.1 : 3.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.5, h: 1.75,
      fill: { color: C.gray50 }, line: { color: C.gray200, pt: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.5, h: 0.06,
      fill: { color: C.indigo }, line: { color: C.indigo },
    });
    s.addText(item.title, {
      x: x + 0.14, y: y + 0.1, w: 4.22, h: 0.35,
      fontSize: 12.5, bold: true, color: C.navy, fontFace: "Calibri", margin: 0,
    });
    s.addText(item.body, {
      x: x + 0.14, y: y + 0.48, w: 4.22, h: 1.18,
      fontSize: 11.5, color: C.gray700, fontFace: "Calibri",
      valign: "top", margin: 0,
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 14 — Thank you (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = darkSlide();
  darkTopBar(s);

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 3.8, w: 10, h: 1.825,
    fill: { color: "0d0d20" }, line: { color: "0d0d20" },
  });

  s.addText("Thank you", {
    x: 0.5, y: 0.85, w: 9, h: 0.85,
    fontSize: 44, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", margin: 0,
  });

  s.addText("llm-smart-router", {
    x: 0.5, y: 1.82, w: 9, h: 0.5,
    fontSize: 20, bold: true, color: "a5b4fc", fontFace: "Calibri",
    align: "center", margin: 0,
  });

  s.addText("Route work to the best model, run parallel agent teams, $0 with subscription CLIs", {
    x: 0.5, y: 2.36, w: 9, h: 0.4,
    fontSize: 13, color: C.gray400, fontFace: "Calibri",
    align: "center", italic: true, margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 2.9, w: 3, h: 0.04,
    fill: { color: C.indigo }, line: { color: C.indigo },
  });

  s.addText("github.com/junegu-glitch/llm-smart-router", {
    x: 0.5, y: 3.05, w: 9, h: 0.35,
    fontSize: 13, color: "818cf8", fontFace: "Consolas",
    align: "center", margin: 0,
  });

  s.addText("npm install -g llm-smart-router", {
    x: 0.5, y: 3.9, w: 9, h: 0.3,
    fontSize: 12, color: C.gray400, fontFace: "Consolas",
    align: "center", margin: 0,
  });
  s.addText("smart-router team run --use-cli \"your complex task here\"", {
    x: 0.5, y: 4.28, w: 9, h: 0.3,
    fontSize: 12, color: "c7d2fe", fontFace: "Consolas",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide 15 — Questions (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = darkSlide();
  darkTopBar(s);

  s.addText("Questions?", {
    x: 0.5, y: 1.9, w: 9, h: 1.0,
    fontSize: 54, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", margin: 0,
  });

  s.addText("github.com/junegu-glitch/llm-smart-router", {
    x: 0.5, y: 3.2, w: 9, h: 0.35,
    fontSize: 14, color: "818cf8", fontFace: "Consolas",
    align: "center", margin: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "/Users/junemog/Documents/GitHub/llm-smart-router/presentation/slides.pptx" })
  .then(() => console.log("✓ slides.pptx written"))
  .catch(err => { console.error("Error:", err); process.exit(1); });
