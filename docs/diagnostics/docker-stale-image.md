# Diagnostics: Docker stale-image hypothesis (split into two errors)

The two errors observed against the deployed media-tools container are
**not the same bug** and should not be bundled. One is a real code/Dockerfile
defect that a redeploy will not fix; the other is a textbook stale-image
artifact that redeploying current `master` should resolve.

## TL;DR

| # | Symptom (consumer-visible) | Root cause | Stale image fixes it? |
|---|----------------------------|------------|------------------------|
| 1 | `Error: spawn ps ENOENT` with `spawnargs: [ '-o', 'pid', '--no-headers', '--ppid', <N> ]` | `tree-kill` shells out to `ps` on Linux; `node:24-slim` has no `procps` | **No** — needs a follow-up code/Dockerfile change (W13b) |
| 2 | `SSE log stream broke mid-read … terminated TypeError: terminated` (surfaced by media-sync's undici fetch reader) | Server-side SSE keepalive landed in `d896d21` (2026-05-07); pre-`d896d21` images emit no keepalives | **Yes** — redeploy current `master` |

---

## Error 1 — `spawn ps ENOENT` (real bug, not staleness)

### Evidence

The argv shape `['-o', 'pid', '--no-headers', '--ppid', <pid>]` is a
byte-for-byte match for the Linux branch of the `tree-kill` npm package,
`node_modules/tree-kill/index.js:43-49`:

```js
default: // Linux
    buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
      return spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
    }, function () {
        killAll(tree, signal, callback);
    });
    break;
```

So the failing `spawn('ps', …)` is **not** in this repo's source — searches
across all branches/history for `spawn('ps'`, `ps-tree`, and `pidtree`
return zero hits in `src/`. The call originates inside `tree-kill` itself.

`tree-kill` was introduced and wired in via:

- **`e450327`** `feat(spawn ops): tree-kill child processes on Observable unsubscribe` — added the package + `src/cli-spawn-operations/treeKillChild.ts` (the only `tree-kill` import site; calls `treeKill(childProcess.pid, "SIGTERM")` inside an Observable teardown).
- **`7c2fbaf`** `feat(commands): wire in-flight cancellation through copy + subprocess wrappers` — wired `treeKillOnUnsubscribe(child)` into `runFfmpeg.ts`, `runMkvExtract.ts`, `runMkvMerge.ts`, `runMkvExtractStdOut.ts`, `runMkvPropEdit.ts`, `runReadlineFfmpeg.ts`, `runAudioOffsetFinder.ts`, and `tools/getMkvInfo.ts`. These are the call sites that fire on every cancelled spawn.

### The Dockerfile gap

`Dockerfile:1` is `FROM node:24-slim`. The `apt install` line installs
`build-essential ca-certificates ffmpeg git locales mediainfo pipx python3
wget` (and later `mkvtoolnix`). It does **not** install `procps`, and
`node:24-slim` does not ship `ps` by default. So whenever
`treeKillOnUnsubscribe` fires inside a container — i.e., any time the
runner cancels an in-flight ffmpeg/mkvmerge/etc. spawn — `tree-kill` calls
`spawn('ps', …)` and ENOENT is the expected outcome.

### Why a redeploy will not fix this

The same error reproduces on a freshly built image from current `master`
because the Dockerfile is unchanged. This is a real follow-up bug.

### Recommendation — needs the user's call (spawn W13b)

Two viable fixes — pick one:

1. **Install `procps`** in the Dockerfile so `tree-kill`'s Linux branch can
   actually find `ps`. Smallest diff. Keeps the existing dependency.
2. **Replace `tree-kill`** with a Node-only PID-tree walker (`pidtree`
   reads `/proc/<pid>/task/<tid>/children` directly — no shell-out) and
   rewrite `treeKillChild.ts` to walk + send signals from inside Node. No
   apt dependency, but slightly more code.

Either is fine. The decision is the user's. Flagged for W13b.

---

## Error 2 — `SSE log stream broke mid-read` (stale-image artifact)

### Evidence

The literal phrase `stream broke` does **not** exist in this repo's `src/`
or `public/` on any branch — the only hit anywhere is in
`docs/CHECKLIST.md`. So the message is not produced by media-tools. It is
produced by the **media-sync** consumer when its undici-based fetch reader
times out reading the SSE body; `terminated TypeError: terminated` is the
standard undici surface for "response body closed mid-read."

The root cause is missing keepalives on the producing endpoint. Commit
**`d896d21`** `fix(SSE): server keepalive + tolerant client wrapper for
/jobs/stream and /jobs/:id/logs` (2026-05-07) added:

- `src/api/sseKeepalive.ts` — emits `: keepalive\n\n` every 20 seconds on
  `/jobs/stream` and `/jobs/:id/logs`, keeping intermediaries / idle-tab
  heuristics from silently dropping the stream.
- `public/api/sse-utils.js` — `createTolerantEventSource` with a 5-second
  grace window before treating a gap as a disconnect.

Before `d896d21`, idle SSE streams could be dropped silently and the
consumer's reader would surface the "stream broke" error on the
media-sync side. After `d896d21`, the underlying drop stops happening, so
the consumer no longer surfaces the message.

### Why a redeploy fixes this

The media-tools change is purely additive (new keepalive writes, new
client-side wrapper). A deployed image that predates `d896d21` emits no
keepalives. Redeploying current `master` immediately starts emitting them
and the consumer-side error disappears.

### Recommendation

Redeploy current `master` (with `--pull` or `--no-cache` to defeat any
cached layers). Watch for Error 2 specifically — it is the cleanest
signal because the keepalive change is purely additive and uncontingent.

---

## How to confirm staleness

Until W14's UI version display lands, you cannot read the deployed commit
hash directly off the running container. Two confirmation paths:

1. **Once W14 ships**: compare the version string the UI reports against
   `git rev-parse HEAD` of the image you intended to deploy. A mismatch
   confirms the deploy pipeline pulled an older image / cached layer.
2. **Before W14 ships**: redeploy with `docker pull` + rebuild
   `--no-cache --pull`. Watch error 2 specifically (cleanest signal). If
   error 2 disappears after redeploy, the previous image was pre-`d896d21`
   and staleness is confirmed. If error 1 persists after redeploy (it
   should), that is independent confirmation that error 1 is the real
   bug, not a stale artifact.

---

## Recommendation summary

- **Redeploying current `master` fixes Error 2 only.**
- **Error 1 needs a real code fix** — spawn W13b to either add `procps`
  to the Dockerfile or replace `tree-kill` with `pidtree`. The user
  should pick which.
- Do not bundle the two fixes. They have different blast radii and
  different risk profiles.

## Key SHAs

- **`d896d21`** — SSE keepalive + tolerant client wrapper. Smoking gun
  for Error 2.
- **`e450327`** — `tree-kill` introduction. Origin of Error 1's call
  path.
- **`7c2fbaf`** — wired cancellation through subprocess wrappers; this is
  what makes `tree-kill` fire on every cancelled spawn.
