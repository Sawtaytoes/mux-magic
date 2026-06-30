# 2023-10-21 — Track operations write to a new output folder, never overwrite originals

- **Status:** Accepted
- **Date decided:** 2023-10-21 (pre-rename era)
- **Area:** files / core
- **Source:** commits `9d557953`, `67293b53` (`REORDERED-TRACKS` output dir)

## Decision

Track operations (adding subtitles, reordering tracks, etc.) write their results into a **separate named output folder** (e.g. `SUBTITLED/`, `REORDERED-TRACKS/`) rather than renaming over or overwriting the source files. Originals are preserved so the user can inspect intermediate state mid-sequence. `flattenOutput` is the tool that collapses these accumulated output folders back when the user trusts the result.

## What we rejected — DO NOT revert to this

Do not make track operations edit/overwrite the source files in place "to save disk" or "avoid folder nesting." In-place overwrite was explicitly reversed. The non-destructive output-folder convention is what makes a multi-step sequence inspectable and recoverable — and what `flattenOutput` (and the NSF bucket model) are built around.

## Why it must not be re-litigated

Overwriting originals destroys the user's ability to inspect or recover intermediate pipeline state, and there's no undo for a clobbered MKV. The output-folder convention is foundational to how sequences chain. See also [atomic copy + filesystem move](2026-05-19-atomic-copy-and-filesystem-move.md) and [NSF filesystem-is-state](2026-05-19-nsf-filesystem-is-the-state.md).
