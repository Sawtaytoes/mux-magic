# 2026-08-13 — Sequence groups are flat-only (no parallel-of-sequences) — *feature gap*

- **Status:** Known limitation — feature wanted, not yet built
- **Date decided:** 2026-08-13
- **Area:** api (sequenceRunner) + web (builder UI)
- **Source:** chat session (Trapped in a Dating Sim S1 two-release mux; owner:
  "Doesn't parallel now allow passing in sequential streams too? Maybe that never
  got implemented. I can't seem to do it in the UI. We should document that in
  mux-magic as something we need.")

## The limitation (current behaviour)

A sequence is a flat list of items, where each item is either a bare **step** or a
**group** of bare steps. `flattenItems` (`packages/api/src/api/sequenceRunner.ts`)
flattens exactly **one** level: a group's `steps` are treated as bare steps and a
**nested group is not expanded**. The runner comment says it outright: *"Groups
are a flat-only container… a `kind: "group"` whose `steps` array is itself a list
of bare steps."*

- A **serial** group runs its bare steps in order.
- A **parallel** group runs its bare steps concurrently via `forkJoin`, fail-fast.

Even though the `SequenceGroup.steps` type is `SequenceItem[]` (which *includes*
`SequenceGroup`), a group nested inside a group is **not** executed as a unit.

## What we can't do (but want to)

Run **two independent multi-step streams in parallel within one sequence**, then
have later steps depend on both — i.e. a **parallel group whose members are
themselves serial sub-sequences**. Concretely, the two-release mux wants:

```
parallel:
  stream A (base):  rename → keepLanguages           ─┐
  stream B (subs):  rename → reorderTracks           ─┘ both finish
then serial:        replaceTracks → replaceFlacWithPcmAudio → moveFiles
```

Today each "stream" is more than one step, so it can't be a parallel-group member.
Workarounds:

- Put only the **single** independent steps in a parallel group (works when each
  stream is one step), or
- Split into **separate YAMLs** run back-to-back (what the OP/ED + episodes passes
  do for the Trapped-in-a-Dating-Sim mux).

## What building this would take

- **Runner:** make `flattenItems` / the group executor recurse so a nested
  `kind: "group"` runs as a unit (a serial sub-group inside a parallel parent runs
  its steps in order while sibling sub-groups run concurrently; a barrier joins
  them before the next item). Preserve the existing fail-fast + child-Job model.
- **UI (builder):** expose nesting — a parallel group must be able to contain
  serial groups, not just bare steps. This is the piece the owner "can't do in the
  UI" today.
- **Step links:** `{ linkedTo }` resolution must reach across sub-group boundaries.

## What we rejected — DO NOT revert to this

- **Silently flattening a nested group into its parent** (dropping the inner
  group's serial/parallel intent). That would run steps in the wrong concurrency
  mode and is worse than the honest current limitation. If nesting isn't supported
  yet, the runner should **surface** it, not quietly reinterpret it.
- Faking parallelism by interleaving unrelated steps in one flat parallel group —
  it loses the per-stream ordering guarantee.

Until this is built, **two independent multi-step streams = two sequences.**
