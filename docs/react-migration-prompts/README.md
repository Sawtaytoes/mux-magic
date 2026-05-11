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
| W3 | [W3.md](W3.md) | ✅ Done (4 commits, legacy public/ deleted, tip 7b92c62) | W2.5 |
| W4A | [W4A.md](W4A.md) | 🟡 Audit done; master merge reverted by user for manual verification | W3 |
| W4B | [W4B.md](W4B.md) | 🟡 4 e2e specs authored; not yet merged (waiting on user verification + W5C) | W3 |
| W5A | [W5A.md](W5A.md) | Ready to spawn (parallel with W5B + W5C) — runs in **main checkout** on `react-migration` | W3 |
| W5B | [W5B.md](W5B.md) | Ready to spawn (parallel with W5A + W5C) — runs in **worktree** `.claude/worktrees/w5b` on `feat/restore-builder-controls` | W3 |
| W5C | [W5C.md](W5C.md) | Ready to spawn (parallel with W5A + W5B) — runs in **worktree** `.claude/worktrees/w5c` on `feat/restore-tooltips`; data-only work (commands.ts) | W3 |
| W6 | [W6.md](W6.md) | Ready to spawn after W5B substantially ships UI controls — runs in **worktree** `.claude/worktrees/w6` on `e2e-completion` (extends W4B's `e2e-tests`) | W5B |

**Naming convention (working version, expected to evolve):**
- **Same number + letter suffix = parallel** (W2A/B/C/D, W4A/B, W5A/B all run concurrently within their phase).
- **Next number = sequential next phase** (W6 follows W5; cannot start until its stated dependency is shipped, but is NOT a sibling of W5A/B).
- Decimal numbers (W2.5) signal a sub-task spawned from within a phase — used once for the DslRulesBuilder escalation from W2D.

Earlier in this conversation "W5" / "W6" / "W4C" referred to different workers; those have been re-mapped per the convention. The user has flagged this convention as needing a better long-term notation for explicit dependency/parallelism — TBD in a future task.

**Worker location summary:**
- Main checkout (`d:\Projects\Personal\media-tools` on `react-migration`): W5A
- Worktree `.claude/worktrees/w5b` on `feat/restore-builder-controls`: W5B
- Worktree `.claude/worktrees/w5c` on `feat/restore-tooltips`: W5C
- Worktree `.claude/worktrees/w6` on `e2e-completion` (extends W4B's `e2e-tests`): W6

Each worktree merges back to `react-migration` when done. The user handles the final `react-migration → master` re-merge after manual verification.
