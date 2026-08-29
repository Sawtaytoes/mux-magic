# A release year is shown once

- **Status:** Accepted
- **Date decided:** 2026-08-29
- **Area:** core / cli
- **Source:** owner chat, 2026-08-29

## Decision

When an upstream series title already ends with the release year in parentheses, Mux-Magic does
not append the same year again. `Fire Force (2020)` remains `Fire Force (2020)` in the picker
and in renamed episode files.

## What we rejected — DO NOT revert to this

Do not concatenate a title and its release year without checking the title suffix. That creates
labels and filenames such as `Fire Force (2020) (2020)`.

## Why it must not be re-litigated

One release year identifies the series. Printing it twice makes filenames harder to scan and
does not add information. A different parenthetical year remains visible with the release year.
