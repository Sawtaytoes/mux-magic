# React Migration Recovery — Worker Spawn Prompts

One file per worker. Open a fresh Claude Code session in `d:\Projects\Personal\media-tools` and paste the contents into the first message. The worker reads the canonical [recovery handout](../react-migration-recovery-handout.md), finds their section, and executes.

Prompts are generated lazily — the next worker's prompt is written only after the prior worker reports back, so each prompt reflects the latest checklist state and any audit findings that affect that worker's plan.

| Worker | Prompt | Spawned after |
|---|---|---|
| W0c | [W0c.md](W0c.md) | Now (Phase 0 only outstanding task) |
| W1 | _(generated after W0c reports)_ | W0c |
| W2A | _(generated after W1 reports)_ | W1 |
| W2B | _(generated after W1 reports)_ | W1 |
| W2C | _(generated after W1 reports)_ | W1 |
| W2D | _(generated after W1 reports)_ | W1 |
| W3 | _(generated after W2A/B/C/D all report)_ | W2A+B+C+D |
| W4 | _(generated after W3 reports)_ | W3 |
| W5 | _(generated after W3 reports — parallel with W4)_ | W3 |
