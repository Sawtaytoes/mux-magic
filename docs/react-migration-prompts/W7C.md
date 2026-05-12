# W7C spawn prompt — Sequence Runner crash fix (Content-Type mismatch)

Paste the block below into a fresh Claude Code session opened in `d:\Projects\Personal\media-tools`.

---

You are Worker W7C in the React Migration Recovery for media-tools.

**Working directory:** worktree at `.claude/worktrees/w7c` (set up below).
**Branch:** new `fix/sequence-runner` off `react-migration`; merges back to `react-migration` when done.
**Your model:** Sonnet 4.6, medium effort
**Your role:** Fix a crash in the Sequence Runner triggered when the user clicks "▶ Run Sequence" in the builder.

W7C runs in parallel with W7A and W7B — file ownership is disjoint:
- W7A: modal primitives + Storybook config + one new story
- W7B: `LinkPicker.tsx` + `LinkPicker.test.tsx`
- W7C: `useBuilderActions.ts` + `sequenceAtoms.ts` (client) + server `sequenceRunner.ts` (defensive guard only)

This bug is **[PARITY]** — the sequence runner worked before the React migration. The React port introduced a client-server contract mismatch.

## Required reading

1. [docs/react-migration-recovery-handout.md](../react-migration-recovery-handout.md) — Universal Rules.
2. [docs/react-migration-checklist.md](../react-migration-checklist.md) — current state.
3. `packages/web/src/hooks/useBuilderActions.ts` — `runViaApi` and `runGroup` functions (both call `/sequences/run`).
4. `packages/web/src/state/sequenceAtoms.ts` — `runOrStopStepAtom` (also calls `/sequences/run`).
5. `packages/server/src/api/routes/sequenceRoutes.ts` — the route handler (lines ~559–610) and the `sequenceRequestSchema` union (lines ~448–451).
6. `packages/server/src/api/sequenceRunner.ts` — `flattenItems` (line ~68) and `runSequenceJob` (line ~148).

## Worktree setup

```bash
git worktree add .claude/worktrees/w7c -b fix/sequence-runner react-migration
cd .claude/worktrees/w7c
yarn install
```

---

## The crash

**Stack trace (reported during manual verification):**
```
TypeError: Cannot read properties of undefined (reading 'flatMap')
    at flattenItems (sequenceRunner.ts:69:9)
    at runSequenceJob (sequenceRunner.ts:148:21)
    at sequenceRoutes.ts:598:5
```

`flattenItems(body.steps)` crashes because `body.steps` is `undefined`.

## Root cause (already investigated by orchestrator)

The route at `sequenceRoutes.ts` only declares `"application/json"` as an accepted content type:

```typescript
request: {
  body: {
    content: {
      "application/json": { schema: sequenceRequestSchema },
    },
  },
},
```

The `sequenceRequestSchema` is a union accepting either:
- `{ yaml: "<yaml string>" }` — YAML wrapped in JSON
- `{ paths: {...}, steps: [...] }` — pre-parsed JSON

The route handler checks `if ("yaml" in body)` to distinguish the two paths.

**But the client sends raw YAML text with `Content-Type: application/yaml`:**
```typescript
fetch("/sequences/run", {
  method: "POST",
  headers: { "Content-Type": "application/yaml" },
  body: yaml,  // raw YAML text, NOT a JSON object
})
```

When Hono receives `Content-Type: application/yaml` against a route that only declares `application/json`, `context.req.valid("json")` returns an empty object `{}`. The handler proceeds with `body = {}`, `body.steps` is `undefined`, and `flattenItems(undefined)` crashes.

## Fix — three client-side call sites

Change all three `/sequences/run` fetch calls to send a JSON-wrapped YAML body. The route already supports this via its `yamlSequenceSchema` union arm.

**File: `packages/web/src/hooks/useBuilderActions.ts`**

There are **two** fetch calls here: `runViaApi` (runs the whole sequence) and `runGroup` (runs a single group). In both, change:

```typescript
// Before
headers: { "Content-Type": "application/yaml" },
body: yaml,

// After
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ yaml }),
```

**File: `packages/web/src/state/sequenceAtoms.ts`**

One fetch call in `runOrStopStepAtom`. Same change.

## Defensive guard (server-side, secondary)

Add a guard to `flattenItems` in `packages/server/src/api/sequenceRunner.ts` so a malformed body produces a clear error instead of a cryptic crash:

```typescript
// Before
const flatSteps = flattenItems(body.steps)

// After
const flatSteps = flattenItems(body.steps ?? [])
```

This is a secondary safety net — the primary fix is the three client-side call sites above. Do NOT skip the client fix in favour of only this guard.

## Tests to check

`packages/web/src/state/sequenceAtoms.runOrStopStep.test.ts` mocks `fetch` and asserts on the request. After your change, if those tests assert `"Content-Type": "application/yaml"` they will need updating to `"application/json"`. Read the test file before writing any code and update the assertions to match.

Run `yarn test run` to confirm all tests pass after the change.

## Step-by-step

1. Set up worktree (above).
2. Run `yarn test run` to confirm baseline (~1046 tests).
3. Read `sequenceAtoms.runOrStopStep.test.ts` to understand what needs updating.
4. Apply the three client-side fetch call changes.
5. Apply the defensive guard in `sequenceRunner.ts`.
6. Run `yarn test run` — fix any test assertion mismatches.
7. Commit: `fix(sequence-runner): send Content-Type application/json (yaml-wrapped) instead of raw YAML text`
8. Run the full gate (below).
9. Push and report.

## Pre-push gate (Universal Rule #2)

```bash
yarn test run
yarn typecheck
yarn lint
```

All three green.

## Checklist updates (Universal Rule #8)

- At start: mark W7C 🔄 In Progress in [docs/react-migration-checklist.md](../react-migration-checklist.md).
- Per commit: append to Progress Log.
- At end: mark W7C ✅ Done.

## Handoff

```bash
cd .claude/worktrees/w7c
yarn test run && yarn typecheck && yarn lint
git push origin fix/sequence-runner
```

Merge directly per repo convention (`git merge --no-ff`). After merge:

```bash
cd ../..
git worktree remove .claude/worktrees/w7c
git branch -d fix/sequence-runner
```

## When done

Reply with:
- Test count before/after
- Confirm all three fetch call sites updated
- Confirm `runOrStopStep.test.ts` assertions updated
- Pre-push gate state
