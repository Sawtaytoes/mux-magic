# W0c spawn prompt

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W0c in the React Migration Recovery for media-tools.

**Working directory:** `d:\Projects\Personal\media-tools`
**Branch:** `react-migration` (already checked out — do not switch)
**Your model:** Sonnet 4.6, medium effort
**Your role:** Capture parity reference YAML for every command — TIME-CRITICAL because the legacy JS that produces this output is about to be replaced.

## Required reading before doing anything

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — find the **"Universal Rules — ALL WORKERS READ THIS"** section (all 8 rules apply to you) and the **"WORKER W0c — Parity Reference Capture (TIME-CRITICAL)"** section (your specific tasks).
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current Phase 0 state. Note W0b has already pushed audit findings; your row is the only outstanding Phase 0 task.

## Important context from W0b's audit (already pushed)

- The legacy `/builder` UI still works in the current code state. `buildParams` in `packages/web/public/builder/js/sequence-editor.js` (~line 723) is the function this round of capture is meant to preserve.
- `buildParams` is a **pure function** (no DOM access) — a Node script approach is viable and faster than UI automation.
- `packages/web/public/builder/js/commands.js` exports 31 commands across 8 categories: File Ops (9), Audio (2), Track Ops (6), Subtitle Ops (4), Analysis (7), Naming (6), Video (1), Metadata (1).
- The shared package `js-yaml` is already a runtime dependency — use its `dump()` with options `{ lineWidth: -1, flowLevel: 3, indent: 2 }` to match `yamlSerializer.ts`.
- If scripting hits a wall (ES module/CommonJS friction, DOM coupling you didn't expect), fall back to Playwright MCP UI automation via the legacy `/builder` page.

## What to deliver

1. Fixtures under `packages/web/tests/fixtures/parity/`:
   - `<commandName>.yaml` — YAML output captured for that command's deterministic input
   - `<commandName>.input.json` — the paths array + step.params + step.links used to produce it
2. (Recommended) A reusable capture script at `packages/web/scripts/capture-parity-fixtures.ts` so W4 can re-run the capture to confirm post-migration parity.
3. Updates to [docs/react-migration-checklist.md](../react-migration-checklist.md):
   - Mark W0c ✅ Done with the date
   - Fill in "Fixtures captured (W0c fills in)" with the count

## Pre-push gate (Universal Rule #2)

Before every push:

```bash
yarn test run
yarn typecheck
yarn lint
```

All three must pass. The recently-landed orchestrator commits (`3f8bf84`, `1e7cf03`, `b882c23`, `51de37b`) have made the gate reliable — if it fails, your change broke something, not infrastructure.

## Commits (push each immediately)

1. `test: capture parity reference YAML for all commands (Phase 0 baseline)` — the fixtures + capture script
2. `docs(checklist): W0c complete — <N> command fixtures captured`

Before each push: `git pull --rebase origin react-migration` (no other workers are active right now, but it costs nothing).

## Forbidden (Universal Rule #4)

No snapshot tests (`toMatchSnapshot`, `toMatchInlineSnapshot`). No screenshot / VRT tests. If a fixture comparison ever needs to be inline-asserted in a test file, spell the value out: `expect(toYamlStr(input)).toBe("paths:\n  basePath: ...\n")`. This rule was just landed in [AGENTS.md](../../AGENTS.md) — `yarn lint` will not catch it, but the overseer will.

## When done

Reply with a short status update: how many fixtures, which approach (script vs UI automation), and any commands that needed special handling. The overseer (a separate Claude session) will pick up from there to coordinate W1.
