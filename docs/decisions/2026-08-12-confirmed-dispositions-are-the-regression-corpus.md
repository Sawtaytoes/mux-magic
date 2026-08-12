# 2026-08-12 — Confirmed disc-title dispositions are the regression corpus, and they live in the backup

- **Status:** Accepted
- **Date decided:** 2026-08-12
- **Area:** core / web
- **Source:** disc-backup title selection, Phase 3. Answers open question 4 of [docs/disc-backup-title-selection.md](../disc-backup-title-selection.md).

## Decision

The analyser writes its proposal to `DISC-ANALYSIS/analysis.json` **inside
the `[BACKUP]` folder it describes**. The owner's confirmed decisions are
written **beside it** as `DISC-ANALYSIS/confirmed.json` — a separate file,
never the same one.

Two rules follow:

1. **Re-analysing never overwrites a confirmation.** New rules, a fixed
   heuristic or a MakeMKV bump rewrite `analysis.json` only.
2. **Every accumulated `confirmed.json` is a labelled example**, and
   together they are the regression corpus the heuristics are measured
   against. A rule change that flips a previously-confirmed disposition is
   a regression to explain, not a silent improvement.

This follows [NSF state lives in the filesystem, not a JSON cache](2026-05-19-nsf-filesystem-is-the-state.md):
the analysis travels with the backup, so a refresh, a crash or "I'll
finish tomorrow" loses nothing, and the owner can see pending work in his
file explorer.

## What we rejected — DO NOT revert to this

- **Do not put confirmations in a central database, app-data directory, or
  anything under `APP_DATA_DIR`.** Splitting state across "the backup" and
  "somewhere in the app" is exactly the failure mode PR #140 deleted for
  NSF. It also means moving or archiving a backup silently orphans its
  decisions.
- **Do not merge confirmations into `analysis.json`.** The whole point of
  two files is that one is machine output and the other is a human
  decision. One file means the next `analyseDiscBackup` run destroys the
  corpus, which is the thing that makes the heuristics improvable.
- **Do not let the analyser delete, move or rip anything.** It reads the
  backup and writes one sidecar folder. Every discard is a PROPOSAL with a
  stated reason, the full title list stays available, and the backup is
  never modified. A rule that "obviously" should just drop junk titles is
  the drift to resist — a wrong discard silently loses the only copy of an
  edition, and that is far worse than a slow manual pass.

## Why it must not be re-litigated

The owner's framing for the whole feature was "have mux-magic identify
what to rip and not to rip and then present that to me in a way that I can
verify and make sure it's right." Verification is the product. A corpus of
confirmed decisions is what turns the heuristics from a pile of guesses
into something measurable — and it accumulates for free, because
`rip-deck` keeps producing backups whether or not anyone is looking.
