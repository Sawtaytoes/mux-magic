# Worker 09 — number-fields-redesign

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/09-number-fields-redesign`
**Worktree:** `.claude/worktrees/09_number-fields-redesign/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

Two number-related field redesigns:

### Part 1: NumberArrayField → free-text single box

[NumberArrayField](../../packages/web/src/components/NumberArrayField/NumberArrayField.tsx) (used in chapters/splits) currently forces comma-delimited input via some parsing. Make it a free-text input where the user just types — parse on blur or on submit, not on every keystroke.

Behavior:
- Accept any whitespace-separated or comma-separated numbers.
- Don't auto-format while typing.
- On blur/submit: parse into `number[]`. Invalid values clear or get flagged inline.
- Preserve the underlying schema (still serializes to `number[]`).

### Part 2: NumberWithLookupField → custom up/down buttons

[NumberWithLookupField](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx) currently shows OS-browser-styled up/down arrows (the default `<input type="number">` spinner). The arrows look inconsistent with the rest of the design system.

- **For ID-lookup usages** (the `nameSpecialFeatures` case — looking up TheMovieDB ID): **remove** the up/down arrows entirely. Incrementing an ID by 1 is meaningless.
- **For numeric-value usages** (where stepping is meaningful, e.g. count of episodes): replace with custom buttons styled to match the design system. Buttons are SVG-icon, hover/focus states match other field controls.

Determine which usages fall in which category by grep'ing `<NumberWithLookupField` and checking each `field.purpose` or context.

### Refactor option

Consider adding a prop `hasIncrementButtons?: boolean` (defaulting to true for backward compat) so callers can opt out. ID-lookup call sites pass `false`; numeric-value call sites get the new custom buttons.

## TDD steps

1. Write failing tests:
   - NumberArrayField accepts free-text without forcing commas; parses on blur.
   - NumberWithLookupField with `hasIncrementButtons={false}` renders no buttons.
   - NumberWithLookupField with `hasIncrementButtons={true}` renders custom buttons (not native).
   Commit.
2. Implement Part 1.
3. Implement Part 2.
4. Audit call sites and set the prop where appropriate.
5. Update stories with both variants.

## Files

- [packages/web/src/components/NumberArrayField/NumberArrayField.tsx](../../packages/web/src/components/NumberArrayField/NumberArrayField.tsx)
- [packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx](../../packages/web/src/components/NumberWithLookupField/NumberWithLookupField.tsx)
- Stories + tests for both
- All `<NumberWithLookupField` call sites

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests first
- [ ] NumberArrayField parses on blur; free-text input
- [ ] NumberWithLookupField has `hasIncrementButtons` prop or equivalent
- [ ] Call sites audited
- [ ] Custom buttons styled to design system (no OS-native arrows visible anywhere)
- [ ] Stories show both with-buttons and without-buttons variants
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Validation rules (e.g. min/max) — handled separately
- Changing the underlying serialization
