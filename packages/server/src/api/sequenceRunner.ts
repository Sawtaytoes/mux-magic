import { logError, logInfo } from "@mux-magic/tools"
import type { Observable } from "rxjs"
import {
  getEffectiveCommandConfigs,
  type Scenario,
} from "../fake-data/index.js"
import {
  resolveDefaultThreadCount,
  resolveMaxThreads,
} from "../tools/resolveThreadEnvVars.js"
import { runJob } from "./jobRunner.js"
import {
  cancelOrSkipJob,
  completeSubject,
  createJob,
  createSubject,
  emitJobEvent,
  getJob,
  updateJob,
} from "./jobStore.js"
import { withJobContext } from "./logCapture.js"
import {
  resolveSequenceParams,
  type SequencePath,
  type StepRuntimeRecord,
} from "./resolveSequenceParams.js"
import {
  type CommandConfig,
  type CommandName,
  commandConfigs,
} from "./routes/commandRoutes.js"

export type SequenceStep = {
  kind?: "step"
  id?: string
  alias?: string
  command: string
  params?: Record<string, unknown>
  isCollapsed?: boolean
}

export type SequenceGroup = {
  kind: "group"
  id?: string
  label?: string
  isParallel?: boolean
  isCollapsed?: boolean
  steps: SequenceStep[]
}

export type SequenceItem = SequenceStep | SequenceGroup

export type SequenceVariable = {
  label?: string
  value: string
  type: string
}

export type SequenceBody = {
  paths?: Record<string, SequencePath>
  variables?: Record<string, SequenceVariable>
  steps: SequenceItem[]
}

// Resolves the per-job thread-count claim for a sequence run.
// Reads the `threadCount` variable from the variables block (singleton —
// the first one wins), clamps to MAX_THREADS, and falls back to
// DEFAULT_THREAD_COUNT when no threadCount variable is present.
const resolveThreadCountClaim = (
  variables: Record<string, SequenceVariable> | undefined,
): number => {
  const maxThreads = resolveMaxThreads()

  if (variables) {
    const entry = Object.values(variables).find(
      (variable) => variable.type === "threadCount",
    )
    if (entry) {
      const raw = Number(entry.value)
      if (Number.isInteger(raw) && raw >= 1) {
        return Math.min(raw, maxThreads)
      }
    }
  }

  return Math.min(resolveDefaultThreadCount(), maxThreads)
}

const isGroup = (
  item: SequenceItem,
): item is SequenceGroup => item.kind === "group"

// Flatten the top-level items into the linear list of underlying steps,
// preserving original (group, indexInGroup) provenance so the runner can
// route each child job back to its group when it advances. The flat list
// is what we use to pre-create child jobs, so the Jobs UI sees one child
// per actual step regardless of group nesting.
type FlatStep = {
  step: SequenceStep
  group: SequenceGroup | null
}

// Blank placeholder steps from the Builder UI are persisted in YAML
// (so undo/redo and `?seq=` round-trips don't drop them) but they are
// runtime no-ops — drop them here so they never get a child job and
// never appear in the iteration loop.
const flattenItems = (items: SequenceItem[]): FlatStep[] =>
  items.flatMap((item): FlatStep[] =>
    isGroup(item)
      ? item.steps
          .filter((step) => step.command !== "")
          .map((step): FlatStep => ({ step, group: item }))
      : item.command === ""
        ? []
        : [{ step: item, group: null }],
  )

const isKnownCommand = (
  name: string,
): name is CommandName =>
  Object.hasOwn(commandConfigs, name)

type StepRunOutcome =
  | {
      kind: "completed"
      stepId: string
      command: string
      outputs: Record<string, unknown> | null
      resolved: Record<string, unknown>
    }
  | { kind: "failed"; stepId: string; error: string }
  | { kind: "cancelled" }
  // Emitted when a step's outputs carry `shouldExit: true` (today only
  // `exitIfEmpty`, but the runner has no per-command knowledge — any
  // command publishing the reserved key wins this treatment). The step
  // itself ran to completion; the sequence as a whole takes a planned
  // exit at this point. The umbrella becomes `status: "exited"` and
  // every later flat step cascades to the same status (not "skipped",
  // which carries failure connotations — these steps never ran by
  // design, not because something went wrong earlier).
  | {
      kind: "exited"
      stepId: string
      command: string
      outputs: Record<string, unknown> | null
      resolved: Record<string, unknown>
      reason: string
    }

// Drives a sequence under a single umbrella job. Each step (whether at
// the top level or inside a group) is a real, first-class child Job
// (parentJobId = umbrellaId) with its own status, log stream, results,
// and cancel affordance — the Jobs UI groups by parentJobId on the
// client. Steps are pre-created up front in `pending` so the UI can
// render the entire step list immediately; each one then transitions
// through running → completed | failed | cancelled | skipped as the
// runner advances. The umbrella's own logs carry the cross-step
// "Step X starting / Run summary" markers.
//
// Groups are a flat-only container: a top-level item is either a
// `kind: "step"` (the bare step form) or a `kind: "group"` whose
// `steps` array is itself a list of bare steps. Serial groups iterate
// their inner steps the same way the outer loop does. Parallel groups
// run their inner steps concurrently via forkJoin and fail-fast: the
// first inner failure cancels the rest of the forkJoin, marks any
// still-pending siblings as cancelled, and skips the remaining outer
// items. There is no group-level child Job — group identity lives only
// in the YAML structure and the builder UI.
export const runSequenceJob = (
  jobId: string,
  body: SequenceBody,
  options: {
    isUsingFake?: boolean
    globalScenario?: Scenario | null
  } = {},
): void => {
  createSubject(jobId)
  updateJob(jobId, {
    startedAt: new Date(),
    status: "running",
  })

  const isUsingFake = options.isUsingFake ?? false
  // Resolve which configs map to consult for each step. The real map's
  // identity is preserved when useFake is false (no extra cost on the
  // production path); switching to the fake map flips every step's
  // observable to a scripted timer source. Both maps share the same
  // keys and metadata so resolveSequenceParams treats them identically.
  const effectiveConfigs = getEffectiveCommandConfigs(
    isUsingFake,
    options.globalScenario,
  )

  const pathsById: Record<string, SequencePath> = {
    ...body.paths,
    ...Object.fromEntries(
      Object.entries(body.variables ?? {}).filter(
        ([, variable]) => variable.type === "path",
      ),
    ),
  }
  const stepsById: Record<string, StepRuntimeRecord> = {}

  const threadCountClaim = resolveThreadCountClaim(
    body.variables,
  )

  // Walk every underlying step (flattening group children inline) once
  // up front so we can:
  //   - assign stable ids in document order (so existing tests that
  //     assert `step1`, `step2` for unnamed top-level steps still hold),
  //   - pre-create one child Job per actual step in `pending`,
  //   - look up the (childJobId, stepId) for any FlatStep cheaply during
  //     the run.
  const flatSteps = flattenItems(body.steps ?? [])
  let assignedCounter = 0
  const stepIds: string[] = flatSteps.map(({ step }) => {
    if (typeof step.id === "string" && step.id.length > 0)
      return step.id
    assignedCounter += 1
    return `step${assignedCounter}`
  })
  const childJobIds: string[] = flatSteps.map(
    ({ step }, index) => {
      const child = createJob({
        commandName: step.command,
        params: step.params ?? {},
        parentJobId: jobId,
        stepId: stepIds[index],
        threadCountClaim,
      })
      return child.id
    },
  )

  // (childJobId, stepId, command) lookup keyed by reference identity of
  // the underlying SequenceStep object — used during item iteration so a
  // group's inner steps can find their pre-allocated child rows.
  const childLookupByStep = new Map<
    SequenceStep,
    { childId: string; stepId: string }
  >()
  flatSteps.forEach((flat, index) => {
    childLookupByStep.set(flat.step, {
      childId: childJobIds[index],
      stepId: stepIds[index],
    })
  })

  const markChildTerminalIfPending = (
    childId: string,
    status: "skipped" | "exited",
  ): void => {
    if (getJob(childId)?.status === "pending") {
      updateJob(childId, {
        completedAt: new Date(),
        status,
      })
      completeSubject(childId)
    }
  }

  // Skip every still-pending child after a given flat-step index.
  // Used by both the outer item loop (after a serial failure) and by
  // parallel-group failure handling (to skip later outer items).
  // `status` distinguishes the two cascade flavours: `"skipped"` for
  // post-failure / post-cancel propagation (something went wrong, the
  // rest didn't run), `"exited"` for post-`exitIfEmpty` propagation
  // (the sequence reached a planned exit point and the rest didn't run
  // by design).
  const markRemainingTerminalFromFlatIndex = (
    fromFlatIndex: number,
    status: "skipped" | "exited",
  ): void => {
    for (
      let idx = fromFlatIndex;
      idx < childJobIds.length;
      idx += 1
    ) {
      markChildTerminalIfPending(childJobIds[idx], status)
    }
  }

  const logRunSummary = (): void => {
    if (flatSteps.length === 0) return
    logInfo("SEQUENCE", "Run summary:")
    flatSteps.forEach((flat, index) => {
      const stepId = stepIds[index]
      const childStatus =
        getJob(childJobIds[index])?.status ?? "pending"
      logInfo(
        "SEQUENCE",
        `  ${index + 1}. ${stepId} (${flat.step.command}): ${childStatus}`,
      )
    })
  }

  const finalize = (
    status: "completed" | "failed" | "cancelled" | "exited",
  ): void => {
    logRunSummary()
    updateJob(jobId, {
      completedAt: new Date(),
      status,
    })
    completeSubject(jobId)
  }

  // Called from any cancelled-outcome branch (plain step / serial group /
  // parallel group). Two paths reach a cancelled outcome:
  //   1. The user cancelled the umbrella job itself — `cancelJob`'s cascade
  //      already wrote `cancelled` on the umbrella + every child, so the
  //      umbrella is no longer `running` and we just surrender the loop.
  //   2. The user cancelled ONE child step directly. The umbrella is still
  //      `running`, the cancel hasn't propagated, and the rest of the
  //      sequence would otherwise sit `pending` forever. Skip the
  //      remainder and finalize the umbrella as `cancelled` so the UI
  //      sees the whole sequence terminate.
  const finalizeFromChildCancel = (
    lastStepInItem: SequenceStep,
  ): void => {
    const umbrella = getJob(jobId)
    if (!umbrella || umbrella.status !== "running") return
    markRemainingTerminalFromFlatIndex(
      flatIndexAfter(lastStepInItem),
      "skipped",
    )
    finalize("cancelled")
  }

  // Symmetric to `finalizeFromChildCancel` but for the
  // `exitIfEmpty` (or any future flow-control command publishing
  // `shouldExit: true`) path. The triggering step itself is already
  // `completed` — we just need to cascade `exited` over the remaining
  // pending children and finalize the umbrella as `exited`.
  const finalizeFromExit = (
    lastStepInItem: SequenceStep,
    reason: string,
  ): void => {
    const umbrella = getJob(jobId)
    if (!umbrella || umbrella.status !== "running") return
    logInfo(
      "SEQUENCE",
      `Sequence exiting cleanly at step "${lastStepInItem.id ?? lastStepInItem.command}": ${reason}`,
    )
    markRemainingTerminalFromFlatIndex(
      flatIndexAfter(lastStepInItem),
      "exited",
    )
    finalize("exited")
  }

  // Run a single step end-to-end and return a structured outcome. The
  // outcome is what the caller (item loop / serial group / parallel
  // group) inspects to decide whether to continue, skip, or fail.
  const runOneStep = async (
    step: SequenceStep,
  ): Promise<StepRunOutcome> => {
    const lookup = childLookupByStep.get(step)
    if (!lookup) {
      // Defensive — flatSteps came from the same body.steps the iteration
      // walks, so this should be unreachable.
      return {
        kind: "failed",
        stepId: "(unknown)",
        error: "Internal: no child job allocated for step",
      }
    }
    const { childId, stepId } = lookup

    if (!isKnownCommand(step.command)) {
      const error = `Unknown command "${step.command}"`
      logError("SEQUENCE", `Step ${stepId}: ${error}.`)
      updateJob(childId, {
        completedAt: new Date(),
        error,
        status: "failed",
      })
      completeSubject(childId)
      return { kind: "failed", stepId, error }
    }

    const config: CommandConfig =
      effectiveConfigs[step.command]

    const { resolved, errors } = resolveSequenceParams({
      rawParams: step.params ?? {},
      pathsById,
      stepsById,
      // resolveSequenceParams reads command schemas/outputFolderName,
      // both of which match between real and fake configs — pass the
      // effective map either way so the link-resolution path doesn't
      // need a second branch.
      commandConfigsByName: effectiveConfigs,
    })

    if (errors.length > 0) {
      errors.forEach((error) => {
        logError("SEQUENCE", `Step ${stepId}: ${error}`)
      })
      const message = errors.join("; ")
      updateJob(childId, {
        completedAt: new Date(),
        error: message,
        status: "failed",
      })
      completeSubject(childId)
      return { kind: "failed", stepId, error: message }
    }

    logInfo(
      "SEQUENCE",
      `Step ${stepId} (${step.command}): starting.`,
    )

    let stepObservable: Observable<unknown>
    try {
      stepObservable = config.getObservable(resolved)
    } catch (error) {
      const message = String(error)
      logError("SEQUENCE", `Step ${stepId}: ${message}`)
      updateJob(childId, {
        completedAt: new Date(),
        error: message,
        status: "failed",
      })
      completeSubject(childId)
      return { kind: "failed", stepId, error: message }
    }

    // Tell the umbrella stream a step is about to subscribe. Fires AFTER
    // the synchronous validation paths above have all cleared and we are
    // genuinely about to start work — a UI subscribed to the umbrella's
    // SSE uses this to open a per-child SSE and follow that step's
    // ProgressEvents (which fire on the child subject, not this one).
    emitJobEvent(jobId, {
      type: "step-started",
      childJobId: childId,
      stepId,
      status: "running",
    })

    const finalChild = await runJob(
      childId,
      stepObservable,
      {
        extractOutputs: config.extractOutputs,
        threadCountClaim,
      },
    )
    const childStatus = finalChild?.status

    // Mirror image of step-started — fires the moment the outcome is
    // decided, regardless of whether the step completed, failed, or was
    // cancelled. The modal's step-finished handler closes the open
    // per-child SSE so it can wire up the next step's events on the next
    // step-started.
    emitJobEvent(jobId, {
      type: "step-finished",
      childJobId: childId,
      stepId,
      status: childStatus ?? "failed",
      error: finalChild?.error ?? null,
    })

    if (childStatus === "cancelled") {
      return { kind: "cancelled" }
    }
    if (childStatus === "failed") {
      const message = finalChild?.error ?? "Step failed"
      return { kind: "failed", stepId, error: message }
    }

    // Completed. jobRunner uses results.concat(emission) which flattens
    // a single-level array — the original in-line subscriber comment
    // about array-of-array still applies here.
    const outputs = finalChild?.outputs ?? null

    // Reserved-output protocol for flow-control commands (today only
    // `exitIfEmpty`). When the step publishes `shouldExit: true`, the
    // step itself ran cleanly — we just translate that into the
    // sequence-level `exited` outcome so the item loop can short-
    // circuit the umbrella. Any other command publishing the same key
    // gets the same treatment for free.
    if (outputs !== null && outputs.shouldExit === true) {
      return {
        kind: "exited",
        stepId,
        command: step.command,
        outputs,
        resolved,
        reason:
          typeof outputs.exitReason === "string"
            ? outputs.exitReason
            : "",
      }
    }

    return {
      kind: "completed",
      stepId,
      command: step.command,
      outputs,
      resolved,
    }
  }

  // Returns the index of the first FlatStep whose underlying step
  // reference matches `target` — used to convert "we just finished
  // this group" into a flat-index for cascading skip.
  const flatIndexAfter = (
    lastStepInItem: SequenceStep,
  ): number => {
    const last = flatSteps.findIndex(
      (flat) => flat.step === lastStepInItem,
    )
    return last < 0 ? childJobIds.length : last + 1
  }

  // Kick the loop off without awaiting — the route handler treats this
  // as fire-and-forget. The `.catch` is the safety net: any throw from
  // a step that escapes the per-step try/catch (or from helper code
  // outside the step loop) must fail this umbrella job, not bubble to
  // the global `unhandledRejection` handler and take the API process
  // down. Worker 65-era sequence runs against invalid `sourcePath`
  // values (e.g. Windows paths in a Linux container) were the
  // motivating regression.
  void withJobContext(jobId, async () => {
    for (
      let itemIndex = 0;
      itemIndex < body.steps.length;
      itemIndex += 1
    ) {
      const umbrella = getJob(jobId)
      if (!umbrella || umbrella.status !== "running") return

      const rawItem = body.steps[itemIndex]

      // Blank top-level step — placeholder card from the Builder UI,
      // intentionally a no-op. flattenItems already excluded it from
      // the child-job pool, so there is nothing to skip-mark.
      if (!isGroup(rawItem) && rawItem.command === "")
        continue

      // Strip blank placeholder steps from inside groups too. If a
      // group has no real steps left after filtering, skip it
      // entirely (no log line, no umbrella thrash).
      const item: SequenceItem = isGroup(rawItem)
        ? {
            ...rawItem,
            steps: rawItem.steps.filter(
              (step) => step.command !== "",
            ),
          }
        : rawItem

      if (isGroup(item) && item.steps.length === 0) continue

      if (isGroup(item)) {
        const groupLabel =
          item.label ?? item.id ?? "(unlabeled)"

        if (item.isParallel === true) {
          logInfo(
            "SEQUENCE",
            `Group "${groupLabel}" (parallel, ${item.steps.length} step${item.steps.length === 1 ? "" : "s"}): starting.`,
          )
          // Kick off every inner step concurrently. Each runOneStep
          // returns a Promise that already represents the full child-job
          // lifecycle — runOneStep never throws (failures come back as
          // `{ kind: "failed" }`), so we drive the group with Promise.all
          // rather than forkJoin to keep the side-channel fail-fast logic
          // below straightforward.
          //
          // First-failure semantics: the moment any inner step resolves
          // with `{ kind: "failed" }`, walk the siblings and call
          // cancelOrSkipJob on each — running ones flip to `cancelled`
          // (subscription unsubscribed, in-flight work torn down via the
          // command's own teardown), pending ones flip to `skipped`. The
          // boolean latch makes the broadcast first-wins so two near-
          // simultaneous failures don't double-cancel.
          //
          // The cancelled siblings' runOneStep promises resolve cleanly
          // via runJob's `subscription.add(() => resolve(...))` teardown,
          // so awaiting Promise.all here doesn't hang.
          const innerPromises = item.steps.map(
            (innerStep) => runOneStep(innerStep),
          )

          // Broadcast on first failure OR first cancellation. Cancel
          // symmetry with failure: if the user cancels one parallel
          // sibling directly (DELETE /jobs/:childId), the others should
          // tear down too rather than continuing to run while the rest
          // of the sequence is doomed to skip anyway. cancelOrSkipJob
          // is idempotent, so the umbrella-cascade case (where every
          // sibling is already terminal by the time the watcher fires)
          // is a harmless no-op.
          let isStopBroadcast = false
          innerPromises.forEach((promise, stoppedIndex) => {
            void promise.then((outcome) => {
              if (
                outcome.kind === "completed" ||
                isStopBroadcast
              )
                return
              isStopBroadcast = true
              item.steps.forEach(
                (siblingStep, siblingIndex) => {
                  if (siblingIndex === stoppedIndex) return
                  const lookup =
                    childLookupByStep.get(siblingStep)
                  if (!lookup) return
                  cancelOrSkipJob(lookup.childId)
                },
              )
            })
          })

          const innerOutcomes =
            await Promise.all(innerPromises)

          // Apply outputs from every step that ran to a clean terminal
          // (`completed` OR `exited` — both ran their work fully) into
          // stepsById so steps after the parallel group can `linkedTo`
          // them. Failed / cancelled siblings have no outputs to apply.
          innerOutcomes.forEach((outcome) => {
            if (
              outcome.kind === "completed" ||
              outcome.kind === "exited"
            ) {
              stepsById[outcome.stepId] = {
                command: outcome.command,
                outputs: outcome.outputs,
                resolvedParams: outcome.resolved,
              }
            }
          })

          // Failure takes precedence over cancelled — cancelled siblings
          // here are the *consequence* of the failure, not an external
          // signal. A pure-cancelled outcome (no failures) only happens
          // when the umbrella job itself was externally cancelled, in
          // which case we surrender the loop without finalizing.
          const firstFailure = innerOutcomes.find(
            (
              outcome,
            ): outcome is Extract<
              StepRunOutcome,
              { kind: "failed" }
            > => outcome.kind === "failed",
          )
          if (firstFailure) {
            logError(
              "SEQUENCE",
              `Group "${groupLabel}" (parallel): one or more inner steps failed; siblings cancelled.`,
            )
            updateJob(jobId, { error: firstFailure.error })
            markRemainingTerminalFromFlatIndex(
              flatIndexAfter(
                item.steps[item.steps.length - 1],
              ),
              "skipped",
            )
            finalize("failed")
            return
          }

          if (
            innerOutcomes.some(
              (outcome) => outcome.kind === "cancelled",
            )
          ) {
            logInfo(
              "SEQUENCE",
              `Group "${groupLabel}" (parallel): cancelled.`,
            )
            finalizeFromChildCancel(
              item.steps[item.steps.length - 1],
            )
            return
          }

          // Any inner step requesting a sequence exit wins — the
          // umbrella exits at the group boundary. Take the first
          // exited outcome's reason for the log line; the rest were
          // independently arriving at the same conclusion.
          const firstExit = innerOutcomes.find(
            (
              outcome,
            ): outcome is Extract<
              StepRunOutcome,
              { kind: "exited" }
            > => outcome.kind === "exited",
          )
          if (firstExit) {
            finalizeFromExit(
              item.steps[item.steps.length - 1],
              firstExit.reason,
            )
            return
          }

          logInfo(
            "SEQUENCE",
            `Group "${groupLabel}" (parallel): completed.`,
          )
          continue
        }

        // Serial group — iterate inner steps in order, fail-fast.
        logInfo(
          "SEQUENCE",
          `Group "${groupLabel}" (serial, ${item.steps.length} step${item.steps.length === 1 ? "" : "s"}): starting.`,
        )
        let hasGroupFailed = false
        for (
          let innerIndex = 0;
          innerIndex < item.steps.length;
          innerIndex += 1
        ) {
          const innerStep = item.steps[innerIndex]
          const innerOutcome = await runOneStep(innerStep)
          if (innerOutcome.kind === "cancelled") {
            finalizeFromChildCancel(innerStep)
            return
          }
          if (innerOutcome.kind === "failed") {
            updateJob(jobId, { error: innerOutcome.error })
            // Skip from the next inner step onward — that captures both
            // remaining siblings inside this group AND every outer item
            // after it. Passing the failed step itself (innerStep) means
            // flatIndexAfter returns the flat-index of the next pending
            // child, since the failed child is already in `failed`
            // status (markChildTerminalIfPending only touches `pending`).
            markRemainingTerminalFromFlatIndex(
              flatIndexAfter(innerStep),
              "skipped",
            )
            hasGroupFailed = true
            break
          }
          if (innerOutcome.kind === "exited") {
            stepsById[innerOutcome.stepId] = {
              command: innerOutcome.command,
              outputs: innerOutcome.outputs,
              resolvedParams: innerOutcome.resolved,
            }
            finalizeFromExit(innerStep, innerOutcome.reason)
            return
          }
          stepsById[innerOutcome.stepId] = {
            command: innerOutcome.command,
            outputs: innerOutcome.outputs,
            resolvedParams: innerOutcome.resolved,
          }
          logInfo(
            "SEQUENCE",
            `Step ${innerOutcome.stepId} (${innerStep.command}): completed.`,
          )
        }
        if (hasGroupFailed) {
          logError(
            "SEQUENCE",
            `Group "${groupLabel}" (serial): failed at an inner step.`,
          )
          finalize("failed")
          return
        }
        logInfo(
          "SEQUENCE",
          `Group "${groupLabel}" (serial): completed.`,
        )
        continue
      }

      // Plain (non-group) top-level step.
      const outcome = await runOneStep(item)
      if (outcome.kind === "cancelled") {
        finalizeFromChildCancel(item)
        return
      }
      if (outcome.kind === "failed") {
        updateJob(jobId, { error: outcome.error })
        markRemainingTerminalFromFlatIndex(
          flatIndexAfter(item),
          "skipped",
        )
        finalize("failed")
        return
      }
      if (outcome.kind === "exited") {
        stepsById[outcome.stepId] = {
          command: outcome.command,
          outputs: outcome.outputs,
          resolvedParams: outcome.resolved,
        }
        finalizeFromExit(item, outcome.reason)
        return
      }
      stepsById[outcome.stepId] = {
        command: outcome.command,
        outputs: outcome.outputs,
        resolvedParams: outcome.resolved,
      }
      logInfo(
        "SEQUENCE",
        `Step ${outcome.stepId} (${item.command}): completed.`,
      )
    }

    logInfo(
      "SEQUENCE",
      `Completed all ${flatSteps.length} step(s).`,
    )
    finalize("completed")
  }).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error)
    logError(
      "SEQUENCE",
      `Umbrella job ${jobId} crashed: ${message}`,
    )
    const umbrella = getJob(jobId)
    if (umbrella?.status === "running") {
      updateJob(jobId, { error: message })
      markRemainingTerminalFromFlatIndex(0, "skipped")
      finalize("failed")
    }
  })
}
