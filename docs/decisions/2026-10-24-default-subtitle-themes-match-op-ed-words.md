# 2026-10-24 — Match default OP/ED exclusions as style words

- **Status:** Accepted
- **Date:** 2026-10-24
- **Type:** core
- **Supersedes:** —
- **Superseded by:** —
- **Source:** Default subtitle-margin regression tests

## Decision

Generated default subtitle rules protect OP, ED, NCOP and NCED as whole
style-name words, splitting CamelCase and numeric suffixes. Compact song labels
such as OPR, EDTL, opkara and OPv1, and explicit credit, on-screen, song, poem and
title labels remain protected. Acronym variants retain both OPv and O/Pv word
interpretations. Explicit custom regex rules retain their raw matching behavior.

## Context

The inherited default regex matched `op` inside `Top` and `ed` inside `Styled`.
Dialogue styles consequently missed both vertical-margin repair and the narrow
horizontal-margin check. A word-boundary regex alone also misses `OccultOP1`.
Plain keyword matching also misses compact song labels. Their regression cases
must remain protected before any default-rule change is installed.

## What we rejected — DO NOT revert to this

Do not use OP/ED substring matching in generated defaults. Do not silently
reinterpret every custom regex as a word matcher; `ignoredStyleNameWords` is a
separate optional rule field.

## Why

Theme styles need protection while ordinary dialogue receives default margins.
Keeping word keywords separate from regex patterns preserves existing custom
rules and makes the matching choice visible in the rule editor.

## Evidence

The regression for `Top Secondary Dialog 1080P` reproduced unchanged margins
`10,10,20` instead of `200,200,90`. The same test preserves `OccultOP1` at its
original margins. Matcher tests cover Styled dialogue, CamelCase, numeric
suffixes and unchanged explicit substring regex behavior.
