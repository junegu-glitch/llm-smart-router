# Journal — Claude Code Experience

June Gu · 06-642 · Spring 2026

---

At the beginning of this course, I used Claude Code the way I would use a
smart autocomplete: describe what I want, get code back, fix the parts that
are wrong. My mental model was "AI writes a draft, I edit it." That worked for
Project 1 (`plateprep`), which had narrow scope and predictable inputs.

For Project 2 and the final project, that model broke down — and I had to
rebuild how I work with the tool.

**What changed for the second project update**

The first thing I noticed was that Claude Code was confidently wrong about
reliability. It would scaffold a provider integration that looked complete but
had no timeout handling. When a provider didn't respond, the CLI would hang
forever. I had to push back explicitly: "add a 120-second timeout here, and
fail with a clear error message." The AI didn't anticipate this on its own.
The same thing happened with team fallback behavior — early versions would
simply mark a failed teammate as an error and move on, rather than trying an
alternative model. These weren't bugs in the usual sense; they were gaps in
the AI's assumptions about how external services behave in practice.

That's when my use of Claude Code shifted. Instead of reviewing output after
the fact, I started stating constraints before: "if the API call fails with
any 4xx error, try the next model in the fallback chain." Being specific about
failure behavior up front produced much better first drafts than correcting
after.

**How I'm using it differently now**

For the final project, I'm using Claude Code at a level above the code. The
biggest change is context management. In long projects, each new session starts
from scratch unless you do something about it. I built a wiki system — a set of
markdown pages maintained by Claude Code itself, with slash commands (`/ingest`,
`/query`, `/lint`) for updating, querying, and auditing the knowledge base. Now
when I start a new session, I point it at `wiki/index.md` and it has full
project context immediately.

I also started using plan mode before any significant change. Claude Code
proposes a design, I review it, and we only move to implementation once I
agree with the approach. This sounds simple, but it eliminated a whole category
of rework where the AI would implement something reasonable but not what I had
in mind.

**What I'm using it for now**

Early in the course: writing functions.  
Now: designing systems, managing context across sessions, setting up CI/CD,
writing documentation, and occasionally — as with the `--use-cli` subscription
hybrid mode — having Claude Code build infrastructure that then runs other
Claude instances as subprocesses.

That last part is still strange to think about. I used Claude Code to build a
tool that coordinates Claude, Gemini, and Codex as a team. The orchestrator
was built by an agent. The agents it orchestrates include the same agent that
built it.

I don't think I fully understood what "agentic engineering" meant at the start
of this class. I do now.
