# 2026-08-13 — PR/public screenshots use masked, fictional data

- **Status:** Accepted
- **Date decided:** 2026-08-13
- **Area:** process
- **Source:** chat session 2026-08-13 (PRs #213, #215)

## Decision

Any screenshot that will land on a **public surface** — a PR description or
comment, a committed image under `docs/`, a README, a served/shared gallery —
must be captured against **fictional, masked sample data**. Use placeholder
show names, generic locations (`Primary source`, `Output library folder`), and
neutral paths (`/media/library/Sample Series/…`). Drive the builder with a
hand-authored fake `?seqJson=` payload, not the owner's real library. When a
change is visual, decide the sample data **before** capturing, not after.

## What we rejected — DO NOT revert to this

Screenshotting the app in whatever real state it happened to be in and
committing/attaching that. In #213 the rail screenshots were captured from the
owner's actual sequence and showed real filesystem paths and scene/fansub
release-group names (e.g. `~ANIME/...-CRUCiBLE`, `...-TTGA`). Those went into
committed `docs/images/*.png`, into the PR body, and — because `gh pr merge
--squash` builds the commit message from the PR body — into a `master` commit
message. Scrubbing that after the fact is expensive and **cannot be made
complete on a public repo**: old blobs stay reachable by commit SHA and via
`refs/pull/<n>/head`, PR description edit history is retained, and the raw CDN
caches — full removal needs a GitHub Support request and/or history rewrite.

## Why it must not be re-litigated

The masking is not cosmetic. Real media paths + release-group names on a public
repo are a plausible ToS/DMCA exposure for the owner ("that might get me removed
from GitHub"), and unlike a code mistake it is **not cleanly reversible** once
pushed. The one-time cost of authoring a fake payload is trivial next to the
cleanup (two follow-up PRs, a Support request) that a single real-data
screenshot already forced. The workspace-level rule that visual PRs must carry
before/after screenshots still holds — they must, but with fictional data.

## Evidence

> "It shows me using fansubs and pirate copies. TTGA and CRUCiBLE. That might
> get me removed from GitHub. Can we mask all that stuff? I was hoping we'd
> just fake data for the screenshots." — owner, chat 2026-08-13
