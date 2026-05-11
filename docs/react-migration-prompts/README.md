# React Migration Recovery — Worker Spawn Prompts

One file per worker. Open a fresh Claude Code session in `d:\Projects\Personal\media-tools` and paste the contents into the first message. The worker reads the canonical [recovery handout](../react-migration-recovery-handout.md), finds their section, and executes.

Prompts are generated lazily — the next worker's prompt is written only after the prior worker reports back, so each prompt reflects the latest checklist state and any audit findings that affect that worker's plan.

| Worker | Prompt | Status | Spawned after |
|---|---|---|---|
| W0c | [W0c.md](W0c.md) | ✅ Done (commit 51da90d) | (Phase 0 task) |
| W1 | [W1.md](W1.md) | ✅ Done (8 commits, 14c920b tip) | W0c |
| W2A | [W2A.md](W2A.md) | ✅ Done (3 primitives ported) | W1 |
| W2B | [W2B.md](W2B.md) | ✅ Done (3 enum/lang fields ported) | W1 |
| W2C | [W2C.md](W2C.md) | ✅ Done (3 array/json fields ported, commit 6bbc285) | W1 |
| W2D | [W2D.md](W2D.md) | ✅ Done (4 fields shipped; DslRulesBuilder escalated → W2.5) | W1 |
| W2.5 | [W2-5.md](W2-5.md) | ✅ Done (5 commits, DslRulesBuilder visual builder shipped, 974 tests passing) | W2D |
| W3 | [W3.md](W3.md) | Ready to spawn (Sonnet **high effort** — audit showed 14 production window.mediaTools calls across 3 components) | W2.5 |
| W4 | _(generated after W3 reports)_ | — | W3 |
| W5 | _(generated after W3 reports — parallel with W4)_ | — | W3 |
| W6 | [W6.md](W6.md) | Ready (don't spawn until W5 reports) | W5 |
