# Specials checkbox-list / mapping UX approaches

Audience: `nameSpecialFeatures` command + builder UI. Driven by the user's
experimental prompt: present a checkbox list of possible specials, let the user
select which ones they have, then map each selected name to a ripped file.

---

## 1. Goal restatement

When DVDCompare lists extras without reliable timecodes, `nameSpecialFeatures`
falls back to emitting `unrenamedFilenames` (the files it could not place) plus
`possibleNames` (the untimed suggestions it could not anchor). Today the user
sees a static dump of both lists and must rename by hand.

The desired improvement: let the user resolve this mismatch interactively —
selecting which candidate names from DVDCompare they actually have on disk and
then pairing each selected name with the correct ripped file — without knowing
the timecodes or index positions by heart.

The UX surface is a post-`nameSpecialFeatures` review step, triggered only when
`unrenamedFilenames.length > 0` and `possibleNames.length > 0` (i.e. the happy
path where every file matched suppresses this UI entirely).

---

## 2. UX options

### Option A — Plain checkbox list (the user's idea)

The user first sees a scrollable list of candidate names. Each row has a
checkbox. Click selects one; Shift+click extends the selection contiguously
(standard ARIA pattern). After confirming the selection the user sees a second
screen: each selected name paired with a file picker (the unmatched files as a
dropdown). They click a name row to see a metadata panel (duration, filename) so
they can verify what kind of special it is before committing.

```
┌─ Which specials do you have? ────────────────────────────────────────┐
│  [x] Commentary: Director                                            │
│  [ ] Commentary: Cast                                                │
│  [x] Behind the Scenes                                               │
│  [x] Deleted Scenes                                                  │
│  [ ] Theatrical Trailer                                              │
│  [ ] Isolated Score                                                  │
│                                                    [Cancel] [Next →] │
└──────────────────────────────────────────────────────────────────────┘

  (Shift+click to select a range; Space to toggle focused row)

After "Next →":

┌─ Map each special to a file ─────────────────────────────────────────┐
│  Commentary: Director      → [▾ BONUS_1.mkv (0:23:47)            ]  │
│  Behind the Scenes         → [▾ BONUS_2.mkv (0:14:02)            ]  │
│  Deleted Scenes            → [▾ (unassigned)                      ]  │
│                                                  [← Back] [Rename] │
└──────────────────────────────────────────────────────────────────────┘
```

**Click + Shift-click multi-select:** standard browser pattern — mousedown on
row A, shift+click on row B selects A through B. Keyboard: Tab to list, arrow
keys move focus, Space toggles, Shift+Down/Up extends. No custom drag involved.

**Keyboard accessibility:** fully achievable with native `<input type="checkbox">`
+ `role="listbox"` or just a table with checkboxes. No exotic ARIA needed.

**Mobile:** checkboxes are touch-friendly with sufficient row height (44 px min).
Shift+click has no touch equivalent — replace with "tap to toggle, long-press
to range-select" or a "Select range" mode button.

**Honest assessment:** the two-screen flow (select → map) is the user's own
idea and is conceptually clear. The main risk is that the first screen asks the
user to identify specials by name alone, before they have mapped the files —
they may not know which candidate names they have until they compare file
durations. Mitigated by showing a duration hint beside each candidate name
(pulled from the `possibleNames` DVDCompare data if timecode is available).

---

### Option B — Two-pane drag-and-drop

Left pane: the `possibleNames` candidate list (DVDCompare extras without
confirmed timecodes). Right pane: the `unrenamedFilenames` list (ripped files
the matcher left over). The user drags a file from the right pane and drops it
onto a candidate name on the left; the pair locks together and a rename preview
appears inline. Unmatched items on either side stay highlighted until placed or
explicitly discarded.

```
┌─ Drag files onto names ──────────────────────────────────────────────┐
│  CANDIDATE NAMES              │  UNMATCHED FILES                     │
│  ─────────────────────────── │  ─────────────────────────────────── │
│  Commentary: Director      ←─┼─ [BONUS_1.mkv  0:23:47] ▓▓▓ drag me │
│  Commentary: Cast             │  [BONUS_2.mkv  0:14:02]              │
│  Behind the Scenes         ←─┼─ [BONUS_3.mkv  0:08:15] (dropped)    │
│  Deleted Scenes               │                                       │
│  Theatrical Trailer           │                                       │
│                               │                    [Cancel] [Rename] │
└──────────────────────────────────────────────────────────────────────┘
```

**Click + Shift-click:** shift-click selects a contiguous range of files in the
right pane so the user can drag multiple files as a group onto one candidate
(useful only in the unusual case of multiple copies of the same extra).

**Keyboard accessibility:** drag-and-drop UIs need a keyboard fallback. The
standard pattern is "press Space/Enter to 'pick up' an item, arrow keys to
navigate the drop targets, Space/Enter again to drop." Requires explicit ARIA
`role="application"` + live region announcements. Non-trivial to implement
correctly.

**Mobile:** drag-and-drop on touch works but requires careful pointer-event
handling (`touchstart`, `touchmove`, `touchend` with scroll suppression). The
existing `public/builder/js/components/drag-and-drop.js` may already implement
enough plumbing to reuse, but would need extending.

**Honest assessment:** drag-and-drop is visually intuitive for sighted desktop
users and maps naturally to the "pair these two things" mental model. The two
main costs are: (1) keyboard and screen-reader accessibility is genuinely hard;
(2) touch drag requires extra work. Given this is a power-user feature in a
local-first tool, the accessibility bar is lower than a public app — but it is
still worth noting. This option has higher implementation effort than A and C
for a UX gain that is mostly aesthetic.

---

### Option C — Smart-suggestion-first (recommended)

Before showing any interactive UI, compute a fuzzy match score for each
(candidate name, unmatched file) pair using two signals already available:

1. **Duration proximity** — `|fileSeconds - candidateTimecodeSeconds|` when the
   candidate has a timecode (even an unreliable one the main matcher rejected
   due to out-of-tolerance drift). Normalized to a 0–1 closeness score.
2. **Filename fuzz** — Levenshtein or trigram similarity between `fileInfo.filename`
   and the candidate name words (e.g. "commentary" appears in both). Cheap
   computation client-side.

The UI pre-fills each unmatched file with its highest-scoring candidate name.
The user sees the suggestions and either accepts (click Rename) or overrides
(click a dropdown to pick a different candidate). Each row is individually
confirmable; a row with low confidence (score < threshold) is shown with a
yellow highlight prompting explicit confirmation.

```
┌─ Confirm or adjust suggested matches ────────────────────────────────┐
│  FILE                     SUGGESTED NAME              CONF.  ACTION  │
│  ──────────────────────── ─────────────────────────── ─────  ─────── │
│  BONUS_1.mkv (0:23:47) →  Commentary: Director         92%  [✓] [▾] │
│  BONUS_2.mkv (0:14:02) →  Behind the Scenes            78%  [✓] [▾] │
│  BONUS_3.mkv (0:08:15) →  [⚠ Deleted Scenes?]          41%  [✓] [▾] │
│                                                                       │
│  Click [▾] to choose a different name from the candidate list.       │
│                                                    [Cancel] [Rename] │
└──────────────────────────────────────────────────────────────────────┘
```

**Click + Shift-click:** not needed on the primary confirmation screen (each row
is independent). Shift-click is useful on a secondary "accept all" scenario:
the user can shift-click to select a range of rows and bulk-accept or
bulk-assign a single candidate name — equivalent to Option A's checkbox
selection but anchored in the file list rather than the name list.

**Keyboard accessibility:** the confirmation table is a standard focusable table.
[✓] and [▾] are `<button>` elements; Tab/Enter suffice. No exotic ARIA.

**Mobile:** works well — each row is independently actionable. No drag involved.
The [▾] dropdown opens a native `<select>` or a touch-friendly list modal.

---

## 3. Where it lives in the UI

The mapping step should be a modal that mounts after `nameSpecialFeatures`
completes (i.e. after the final `{ unrenamedFilenames, possibleNames }` summary
record arrives from the SSE stream). It is logically part of the
post-`nameSpecialFeatures` review flow, which today renders
"Files not renamed: …" and "Possible names: …" as static text in the run modal.

The mount point is whatever component renders the job result in
`public/builder/index.html`. W2b is splitting that file; the mapping modal
should be wired to whichever component owns the `nameSpecialFeatures` result
display after the split, not to `index.html` directly. Coordinate with W2b to
reserve a `<slot>` or result-action extension point rather than hard-coding into
`index.html`.

The modal needs two pieces of data passed in:

- `unrenamedFilenames: string[]` — from the summary record's field of the same
  name (the files the pipeline could not place).
- `possibleNames: string[]` — candidate names from DVDCompare with no anchored
  timecode.

For Option C the server would ideally also forward the per-candidate timecode
(even when it was out of tolerance) so the client can compute duration
proximity. That requires a small shape extension to `possibleNames`
(currently `string[]` → `{ name: string, timecode?: string }[]`) tracked as an
open question below.

---

## 4. Recommendation

**Use Option C (smart-suggestion-first).**

The user's own Option A is not bad — a two-step checkbox-then-map flow is
coherent — but it forces the user to identify which specials they have before
they can see the file durations that would help them decide. Option C inverts
that: show the files (with durations the user can inspect at a glance) and
pre-fill the best guess, so the user's job is mostly confirmation rather than
identification. The confidence score makes low-quality matches visually
salient instead of hiding uncertainty behind a clean-looking table. For the
rare case where DVDCompare has zero timecodes for a special (pure name match),
the score degrades gracefully to filename-fuzz only and the yellow highlight
warns the user. Option B's drag-and-drop is the most visually polished but
carries the highest implementation cost and the worst keyboard/touch story for
the smallest UX gain; it is the weakest choice given this tool's desktop
power-user audience and local-first context. The user asked "is this just bad?"
about the checkbox idea: it is not bad, but Option C is strictly better because
it does the same job with one fewer screen, reduces decision fatigue, and
leverages data already available from the pipeline.

---

## 5. Implementation footprint (for W8b)

**Server-side (small):**

- `src/app-commands/nameSpecialFeatures.ts`: extend the `possibleNames` field
  from `string[]` to `{ name: string, timecode?: string }[]` so the client
  has duration data to compute confidence scores. Update `NameSpecialFeaturesResult`
  union type accordingly.
- `src/tools/parseSpecialFeatures.ts`: confirm `possibleNames` already carries
  timecode info (or add it) when parsing the DVDCompare extras text.

**API layer (tiny):**

- Ensure the `{ unrenamedFilenames, possibleNames }` summary record is forwarded
  through the SSE stream to the builder. Verify the `commandRoutes.ts`
  `extractOutputs` (or equivalent) includes it; currently the summary record is
  emitted as a plain `NameSpecialFeaturesResult` which should pass through.

**Client-side (medium):**

- New component: `public/builder/js/components/specials-mapping-modal.js`.
  Renders the Option C confirmation table.
- Fuzzy-match helper (pure JS, ~50 LOC): `public/builder/js/util/specials-fuzzy.js`.
  Implements duration-proximity + Levenshtein/trigram scoring over
  `(unrenamedFilenames, possibleNames)` pairs.
- Wire the modal to the `nameSpecialFeatures` result handler (wherever W2b
  places it after the `index.html` split).
- When the user clicks Rename, call the rename API (or invoke a new
  `nameSpecialFeaturesManual` command endpoint that accepts explicit
  `{ filename, newName }` pairs).

**New command endpoint (optional but cleaner):**

- Register a `renameFiles` or `applyManualRenames` command that accepts a list
  of `{ oldPath, newName }` pairs and calls `fileInfo.renameFile` for each.
  This avoids the mapping modal needing to re-run `nameSpecialFeatures` or
  call a raw filesystem API.

**Estimated LOC:** ~300 client + ~50 server (type changes + timecode passthrough).
No build tooling changes; all new files are plain JS matching the existing
builder module style.

---

## Open questions

1. **Does `possibleNames` carry timecodes today?** The `parseSpecialFeatures`
   result shape needs inspection. If `possibleNames` is truly `string[]` with
   no duration data, Option C's confidence score degrades to filename-fuzz only,
   which is weaker but still useful. Extending the type is the highest-priority
   prerequisite.
2. **Where does W2b put the result display after splitting `index.html`?** The
   mapping modal needs a stable mount point. W2b should reserve an extension
   slot before W8b lands.
3. **Manual rename API vs. client-side file rename.** The builder currently
   triggers renames by running a full command job. A lightweight
   `applyManualRenames` endpoint would be simpler for the mapping modal's
   confirm action, but adds a new route. Alternative: re-run
   `nameSpecialFeatures` with an explicit `manualMappings` param passed through
   the pipeline (more invasive).
4. **Confidence threshold.** What score below which a suggestion is flagged
   yellow? Needs calibration against real disc-rip data. Start at 60% and
   tune.
5. **Zero candidates vs. zero unmatched.** The modal should not appear when
   `possibleNames` is empty (nothing to offer) or `unrenamedFilenames` is empty
   (no files to map). Both guards are cheap; confirm they are in place before
   shipping.
