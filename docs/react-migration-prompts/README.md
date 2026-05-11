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
| W3 | [W3.md](W3.md) | In flight (audit showed 14 production window.mediaTools calls across 3 components) | W2.5 |
| W4A | _(generated after W3 reports)_ | — | W3 (parallel with W4B) |
| W4B | _(generated after W3 reports — parallel with W4A)_ | — | W3 (parallel with W4A); runs in `e2e/` worktree |
| W5 | [W5.md](W5.md) | Ready (don't spawn until W4A+W4B both report; was W6 before rename) | W4A + W4B |

**Naming note:** Phase 4 has two parallel workers (verification+merge + e2e tests), matching the W2A–W2D parallel pattern. They were originally labeled W4 and W5 in earlier docs; renamed to W4A and W4B for consistency. The cleanup worker formerly known as W6 is now W5 (the new "next phase"). Commit history may still mention W4/W5/W6 by their old labels.
