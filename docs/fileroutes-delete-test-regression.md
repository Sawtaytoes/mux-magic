# `fileRoutes` DELETE test — schema/test mismatch (handoff)

## TL;DR

One unit test in [packages/server/src/api/routes/fileRoutes.test.ts:181](../packages/server/src/api/routes/fileRoutes.test.ts#L181) is failing. **The implementation is correct — the test was never updated when the response schema changed.** Fix is a ~5-line edit in the test file. No production code change needed.

## The failing test

```
FAIL  packages/server/src/api/routes/fileRoutes.test.ts > DELETE /files
  > ?fake=1 short-circuits with ok:true and never touches disk

AssertionError: expected undefined to be true // Object.is equality
- Expected: true
+ Received: undefined

  packages/server/src/api/routes/fileRoutes.test.ts:192:21
    190|
    191|     expect(response.status).toBe(200)
    192|     expect(body.ok).toBe(true)
       |                     ^
    193|     expect(body.deleted).toEqual(["/work/file1.mkv", "/work/file2.mkv"…
```

Reproduce: `yarn test` (the test is in the server vitest project).

## Root cause

The DELETE `/files` response schema was changed from the old shape to a per-path results shape, but this one test still asserts the old shape.

**Old shape (what the test still expects):**
```ts
{ ok: boolean, deleted: string[], errors: ... }
```

**Current shape (what the implementation returns and what `deleteFilesResponseSchema` declares):**
```ts
{ results: Array<{ path: string, ok: boolean, mode: "trash" | "permanent", error: string | null }> }
```

The schema is defined at [packages/server/src/api/schemas.ts:639](../packages/server/src/api/schemas.ts#L639) as `deleteFilesResponseSchema`, and the route handler at [packages/server/src/api/routes/fileRoutes.ts:273-288](../packages/server/src/api/routes/fileRoutes.ts#L273-L288) returns a matching `{ results: [...] }` payload for both fake and real branches.

Because `body` is now `{ results: [...] }`, `body.ok` is `undefined` — which is exactly what the assertion error says.

## History — why this is loose ends

Two prior commits already migrated the **non-test code** to the new schema, but neither touched this test:

1. `c5fbb1b fix(api): match deleteFiles fake-mode response to declared schema` — fake-mode handler rewritten to per-path `{ results: [...] }`, justified by needing `yarn typecheck` → 0 errors.
2. `c794e36 fix(fileRoutes): align isFakeRequest delete handler with new DeleteResult schema` — follow-up alignment.

The other DELETE tests in this file (rename, open-external, audio-codec) all pass — only the `?fake=1` short-circuit test was missed. There's also no test covering the **real** delete branch's response shape.

## Suggested fix

Replace the assertions at [packages/server/src/api/routes/fileRoutes.test.ts:189-198](../packages/server/src/api/routes/fileRoutes.test.ts#L189-L198) with the new shape:

```ts
const body = await response.json() as {
  results: Array<{ path: string; ok: boolean; mode: "trash" | "permanent"; error: string | null }>
}

expect(response.status).toBe(200)
expect(body.results).toEqual([
  { path: "/work/file1.mkv", ok: true, mode: "trash", error: null },
  { path: "/work/file2.mkv", ok: true, mode: "trash", error: null },
])
// Real files must still be present — fake path didn't delete.
const stillThere1 = await stat("/work/file1.mkv")
const stillThere2 = await stat("/work/file2.mkv")
expect(stillThere1.isFile()).toBe(true)
expect(stillThere2.isFile()).toBe(true)
```

The `mode: "trash"` literal matches what the fake handler hard-codes on line 280 of `fileRoutes.ts`. If `DELETE_TO_TRASH` defaults change in the future, that's a separate (and intentional) test update.

## Confirmed not introduced by recent E2E work

This failure existed on `react-migration` before commit `cf006be fix(e2e): wire missing bridge functions...`. Verified by `git stash` + `yarn test` against the prior tip — same single test failed identically. The E2E bridge changes only touched files under `public/builder/` and `packages/web/src/` and didn't go near `packages/server/`.

## Other failures observed in `yarn test`

For context, three other test **files** also report FAIL alongside this one (Storybook indexing errors and a `format-bandwidth` issue), all pre-existing on this branch and not part of the schema-mismatch problem above. They're tracked separately — don't bundle them with this fix.
