# React Migration Recovery — Worker Spawn Prompts

One file per worker. Open a fresh Claude Code session in `d:\Projects\Personal\media-tools` and paste the contents into the first message. The worker reads the canonical [recovery handout](../react-migration-recovery-handout.md), finds their section, and executes.

Prompts are generated lazily — the next worker's prompt is written only after the prior worker reports back, so each prompt reflects the latest checklist state and any audit findings that affect that worker's plan.

| Worker | Prompt | Status | Spawned after |
|---|---|---|---|
| W0c | [W0c.md](W0c.md) | ✅ Done (commit 51da90d) | (Phase 0 task) |
| W1 | [W1.md](W1.md) | ✅ Done (8 commits, 14c920b tip) | W0c |
| W2A | [W2A.md](W2A.md) | Ready to spawn (parallel) | W1 |
| W2B | [W2B.md](W2B.md) | Ready to spawn (parallel) | W1 |
| W2C | [W2C.md](W2C.md) | Ready to spawn (parallel) | W1 |
| W2D | [W2D.md](W2D.md) | Ready to spawn (parallel) | W1 |
| W3 | _(generated after W2A/B/C/D all report)_ | — | W2A+B+C+D |
| W4 | _(generated after W3 reports)_ | — | W3 |
| W5 | _(generated after W3 reports — parallel with W4)_ | — | W3 |
| W6 | [W6.md](W6.md) | Ready (don't spawn until W5 reports) | W5 |
