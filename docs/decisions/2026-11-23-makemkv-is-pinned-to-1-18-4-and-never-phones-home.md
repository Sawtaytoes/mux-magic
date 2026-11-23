# 2026-11-23 — MakeMKV is pinned to 1.18.4, a crash fails the job, and MakeMKV never phones home

- **Status:** Accepted
- **Date:** 2026-11-23
- **Type:** infra
- **Supersedes:** —
- **Superseded by:** —
- **Source:** the 2026-11-22 disc-backup ingest, where every `analyseDiscBackup` on a `file:` source exited 139 and job `bed6fdb4-43c3-40ce-86e4-9aefc8b6e314` stayed "running" until it was cancelled

## Decision

- The MakeMKV stage is pinned to `ghcr.io/jlesage/makemkv:v26.09.1`, the last tag with MakeMKV v1.18.4. The Dockerfile carries `# makemkv-tag-watcher: hold`, so the tag watcher reports a newer tag and does not bump. A build step fails when the image's makemkvcon reports MakeMKV v2.0.0.
- A makemkvcon run that ends with a signal (a crash) or a non-zero code fails its observable with an error that names the signal or code, the last MSG line, and stderr. `runMakeMkvCon` rethrows that error, so the analysis job fails instead of completing with no titles.
- Both spawn wrappers wait for `close`, so they read all of stdout. They stop waiting 10 seconds after `exit`, so a helper process that keeps the pipe open cannot hold the job.
- Before every spawn, `applyMakeMkvPrivacySettings` sets `app_UpdateEnable = "0"` (the update check) and `app_AutoSubmitEnabled = "0"` (the preference "Submit dumps automatically") in `$MUX_MAGIC_MAKEMKV_HOME/.MakeMKV/settings.conf`. It keeps every other line, including the key, and writes only when a value changes. It never truncates the file in place: it writes a temporary file with the original mode and owner and renames it over the original, so a failed write cannot erase the key.
- The Dockerfile's build-time makemkvcon checks run with a throwaway `HOME` that has the same two settings off, and the build fails if makemkvcon still prints MSG:5074 or writes `update.conf`.

## Context

mux-magic #311 (2026-11-13) moved the stage from v26.08.2 to v26.09.2, which ships MakeMKV v2.0.0. MakeMKV v2.0.0's makemkvcon dereferences a null pointer (SIGSEGV, exit 139) right after "Opening files on harddrive" on a Blu-ray folder or image that has no `AACS` folder. Every decrypted `[BACKUP]` folder has none, so every `analyseDiscBackup` and `extractDiscTitles` run failed. Node reports a crash as `code === null` with a signal. The `exit` handler read `code === null` as the unsubscribe path, so it neither emitted nor errored, and the job never ended.

MakeMKV also checks for updates by default (MSG:5074, "Automatic checking for updates is enabled") and records the check in `.MakeMKV/update.conf`. The workspace rule is that no telemetry or phone-home stays on.

## What we rejected — DO NOT revert to this

- **Bumping back to v26.09.2 or any tag with MakeMKV v2.0.0.** It is broken upstream for this app's only input. jlesage declined to roll the image back (docker-makemkv #290, closed 2026-10-27), and no fixed MakeMKV was published by 2026-11-23.
- **Treating `code === null` as a cancel.** A cancel unsubscribes first, so the observer is already closed and ignores the error. A crash arrives the same way while the observer is open, and staying silent leaves the job running forever.
- **Swallowing the info-scan error.** `logAndSwallowPipelineError` completed the job with no titles and no error, which reads as an empty disc.
- **Fixing the settings by hand in the mounted file only.** A replaced `settings.conf` (a new key, for example) would turn the update check back on with nothing to notice. The code sets them on every spawn.

## Why

A crashed scan must fail promptly with a reason an operator can act on. A pinned old version is acceptable here because the new one cannot read any decrypted backup. To unpin, run a newer tag's makemkvcon `info file:<a [BACKUP] folder>`, confirm that it lists titles, then remove the hold marker and the v2.0.0 build assertion.

## Evidence

Reproduced on 2026-11-23 against a real decrypted Blu-ray backup, read-only:

- In the running mux-magic container (MakeMKV v2.0.0): `makemkvcon -r --cache=1 --minlength=10 info file:<backup>` exits 139 after MSG:3006, with the mounted settings and with a fresh empty `HOME`.
- In jlesage's own `v26.09.2` image, without the transplant: the same exit 139. gdb shows `mov (%rax),%rcx` with `%rax = 0` inside makemkvcon. Removing the `BDMV/JAR`, `MAKEMKV`, or `CERTIFICATE` folders does not change it. A DVD ISO (`iso:`) reads 72 titles.
- In jlesage's `v26.09.1` image (MakeMKV v1.18.4) with a copy of the mounted settings: exit 0 and `TCOUNT:15` on the same backup.
- With `app_UpdateEnable = "0"`, makemkvcon v1.18.4 no longer prints MSG:5074 and no longer writes `update.conf`. With the default, it writes `update.conf` with `app_UpdateLastCheck`.
- Upstream reports: makemkv.com forum topic 42565 ("makemkvcon 2.0.0 segfault from blu-ray ISO") and jlesage/docker-makemkv #290.
- Tests: `makeMkvExitHandling.test.ts` (segfault, non-zero exit, a pipe held open after `exit`, settings applied before spawn) and `makeMkvPrivacySettings.test.ts`.
