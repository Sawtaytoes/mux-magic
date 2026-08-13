# 2026-08-12 — `makemkvcon` is embedded in the mux-magic image, per-spawn `HOME`

- **Status:** Accepted
- **Date decided:** 2026-08-12
- **Area:** infra / core
- **Source:** disc-backup title selection, Phase 1. Transplant lifted from `rip-deck/Dockerfile`, proven on the same base since 2026-07-25.

## Decision

The mux-magic image transplants `/opt/makemkv` from
`ghcr.io/jlesage/makemkv` and puts `makemkvcon` on `PATH`, so
`analyseDiscBackup` can read a `[BACKUP]` folder's BDMV tree directly
(`makemkvcon -r --cache=1 --minlength=<seconds> info file:…`; the floor
defaults to 60 — see
[2026-08-13](2026-08-13-disc-analysis-minimum-title-length-is-60-seconds.md)).
No optical drive
and no `--device` passthrough — mux-magic needs none of rip-deck's
`sr`/`sg` machinery.

Three rules come with it:

1. **`HOME` is set PER SPAWN, never image-wide.** `runMakeMkvCon.ts`
   passes `HOME: MUX_MAGIC_MAKEMKV_HOME` (default `/makemkv-config`) in
   the child's env and nothing else in the image sees it.
2. **The registration key is never in the image and never committed.**
   It arrives as a bind: `/mnt/TrueNAS-Apps/App-Configs/mux-magic/makemkv`
   → `/makemkv-config`, holding `.MakeMKV/settings.conf`. No code may
   scrape, fetch, or generate a key.
3. **A key failure outranks every other reason.** `MSG:5021 / 5052 / 5055`
   is checked *before* the exit code and raised as its own error.

The `FROM` tag is bumped by `.github/workflows/makemkv-tag-watcher.yml`,
and the Dockerfile asserts the transplant at build time by matching
`MSG:1005.*started`.

## What we rejected — DO NOT revert to this

- **Do not read this as reversing
  [MakeMKV + MKVToolNix use the TrueNAS community catalog apps](../../../agentic/docs/decisions/2026-07-18-makemkv-mkvtoolnix-catalog-apps.md).**
  That decision is about the **noVNC GUI app**, whose home-rolled version
  wrote ~265 GB of rips into an anonymous Docker volume. It says "deploy
  the GUI app from the catalog instead of home-rolling a container for
  it." Embedding `makemkvcon` as a **CLI inside an existing app's image**
  is a different thing entirely — there is no anonymous volume, every
  path mux-magic writes is already an explicit bind, and `rip-deck` set
  this precedent. A future agent seeing "MakeMKV" and "Dockerfile" in the
  same diff is the one most likely to drift here; it is not a reversal.

- **Do not set `ENV HOME=/config` image-wide.** rip-deck can, because
  makemkvcon is all it runs. mux-magic also runs ffmpeg, mkvtoolnix,
  Playwright and a Python venv — moving `HOME` relocates all of their
  state, including Playwright's browser cache and the venv's config.

- **Do not add code that obtains a key automatically.** See
  `rip-deck/docs/HANDOFF-stage9-publishing-and-gaps.md`. Fail loudly with
  the path to fix instead.

- **Do not "fix" `ldd` output on `/opt/makemkv`.** It is self-contained —
  it ships its own glibc loader and libraries and resolves through them.
  `ldd` prints alarming relocation errors and the binary runs fine. A
  glibc compat shim would be solving a non-problem.

## Why it must not be re-litigated

Without this, the last manual step in an otherwise unattended pipeline
stays manual: opening MakeMKV by hand and squinting at near-identical
titles. The per-spawn `HOME` and the never-commit-a-key rule are the two
things most likely to be "simplified" back into an image-wide `ENV` and a
baked-in `settings.conf` — the first quietly breaks Playwright and the
venv, and the second puts a licensed key in a public registry.
