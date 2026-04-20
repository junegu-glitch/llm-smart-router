# Journal — Claude Code Experience

June Gu · 06-642 · Spring 2026

---

At the start of the course I was using Claude Code like a smarter autocomplete.
Give it a prompt, get code back, fix what's wrong. That worked fine for
Project 1 because the scope was small and nothing needed to talk to an external
service.

For Project 2 it started breaking down. The code Claude Code produced often
looked right but made bad assumptions — no timeout on API calls, no fallback
when a provider returned a 401. These weren't syntax errors I could spot in a
review. They were gaps that only showed up when something actually went wrong
at runtime. I spent a lot of time discovering failure modes that I should have
specified up front.

That's the main thing that changed. I stopped reviewing after and started
constraining before. "If this API call fails with any 4xx, try the next model
in the list" works much better as a prompt than "here's the bug I found, fix
it." I also started using plan mode — having Claude Code propose a design
before touching any code — which cut down on a lot of rework.

For the final project I added one more thing: a wiki. A set of markdown pages
that Claude Code maintains across sessions, so each new session doesn't start
from scratch. That felt like the biggest quality-of-life improvement of the
whole semester.

The thing I keep thinking about: I used Claude Code to build a tool that runs
Claude, Gemini, and Codex as parallel subprocesses. An agent built an
orchestrator for other agents. I didn't really understand what "agentic
engineering" meant at the beginning of this class. I think I do now.
