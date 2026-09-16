# 2026-09-16 — A skipped test is a defect, and the suites report zero

- **Status:** Accepted
- **Date:** 2026-09-16
- **Type:** Testing
- **Supersedes:** —
- **Superseded by:** —
- **Area:** web / e2e
- **Source:** owner question, 2026-09-16 (T3 Code chat `70f62c90-1a07-49de-afac-a60958f7c709`), PR #302

## Decision

`yarn test` and `yarn e2e` both report **zero skipped**. A suite that cannot run is
either fixed or deleted — it is not left behind a `.skip` with a TODO.

Three rules follow from the three causes found:

1. **dnd-kit reordering is driven through the `KeyboardSensor`, never a synthetic mouse
   drag.** Focus the drag handle, Space to lift, an arrow key to move, Space to drop —
   with a wait between each press.
2. **A Playwright suite whose tests share one server-side store declares
   `test.describe.configure({ mode: "serial" })`.**
3. **The Storybook vitest project does not collect `.mdx`.** A documentation page is not
   a test.

## Context

The suites reported 54 skipped unit test files and 5 skipped e2e tests. None of the
three causes was the same, and none of them was "this feature is untestable".

The 54 were `.mdx` documentation pages. The Storybook vitest plugin takes its file list
from `stories` in `.storybook/main.ts`, which globs `*.mdx` alongside `*.stories.tsx`.
An `.mdx` page holds no story to render, so all 54 were collected and reported as
skipped files. Nothing was going untested; the number was noise that invited
re-investigation every time somebody read the output.

The 5 were two suites left behind stale blockers. `drag-drop.spec.ts` carried
`TODO(W6B): dnd-kit drag-and-drop migration owns these tests` — the migration had
landed. `video-seek.spec.ts` called `window.openVideoModal`, removed by worker 58.

## Why

### What we rejected — DO NOT revert to this

**A synthetic mouse drag for dnd-kit.** `locator.dragTo` releases at the target's
centre, and dnd-kit's sortable only swaps once the pointer crosses the target's
midpoint. That boundary is passed on the way in when dragging up and never reached when
dragging down, so `dragTo` reorders in exactly one direction — which reads as a flaky
test rather than a wrong one. Aiming past the far edge by hand works but re-derives the
card geometry in the test. The keyboard path has no geometry in it at all.

**A test-only hook on `window` to open the video modal.** The suite's own TODO offered
it. e2e runs against the production bundle, so a "dev-only" setter would have to ship in
production to be reachable. Driving the real UI — a builder step's path field → Browse →
click the video row — is both honest and the thing a user does.

**Leaving a suite skipped behind a TODO.** Both TODOs named blockers that had already
been removed, and neither skip had been revisited. A skip records that the test is not
running; it does not record that anybody intends to fix it.

### Why it must not be re-litigated

Unskipping the five surfaced a real cross-test race that had nothing to do with them:
every test in `errors-panel.spec.ts` deletes **every** persisted error record in its
`afterEach`, against one shared server store, under `fullyParallel: true`. CI runs a
single worker and can never see it. Locally it appeared the moment the suite grew by
five tests and the scheduling changed. That is a defect the skips were hiding by keeping
the suite small enough to get lucky.

## Evidence

| Gate | Before | After |
| --- | --- | --- |
| `yarn test` | 470 files passed, **54 skipped** | 470 files passed, **0 skipped**, 3821 tests |
| `yarn e2e` | 71 passed, **5 skipped** | **76 passed**, 0 skipped |

The five re-enabled tests were run with `--repeat-each=3` and `--repeat-each=4`: 18 of
18 and 12 of 12. The full e2e suite was run three times after the serial fix: 76 passed
each time.

The video-seek suite needed two stubs the original never had, both added after it was
skipped: `/features` must report
`isExperimentalFfmpegTranscodingEnabled: true` (the MSE path is off by default, so the
player fell back to `/files/stream` over a path that does not exist), and the HEAD
response must carry `X-Has-Audio: true` (without it the player builds a video-only
SourceBuffer and Chrome rejects the fixture's Opus track with
`Audio stream codec opus doesn't match SourceBuffer codecs`).
