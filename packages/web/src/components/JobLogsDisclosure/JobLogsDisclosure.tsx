import { Accordion, LogViewer } from "@charcuterie/ui"
import { useAtomValue } from "jotai"
import { useEffect } from "react"

import { useLogStream } from "../../hooks/useLogStream"
import { logsByJobIdAtom } from "../../state/logsByJobIdAtom"
import { CopyTextButton } from "../CopyTextButton/CopyTextButton"

const LOGS_KEY = "logs"

/**
 * ### The auto-scroll that followed nothing
 *
 * ```tsx
 * useEffect(() => {
 *   const pane = paneRef.current
 *   if (pane) pane.scrollTop = pane.scrollHeight
 * }, [])          // ← empty deps
 * ```
 *
 * It ran **once**, on mount, when the pane was empty and `scrollHeight`
 * *was* `clientHeight`. Every line after that arrived below the fold, so a
 * running job's log never followed — and it reads as correct, which is why
 * it survived. `LogViewer` follows the tail and pins that following to the
 * user's own scroll position, with a **Jump to latest** button for when
 * they have scrolled away.
 *
 * ### The pane is mounted inside the collapsed panel, and that is fine now
 *
 * `AccordionSection` renders its panel `hidden` rather than unmounting it,
 * deliberately — an unmounted panel loses a scroll position and any
 * subscription its content opened, and this is exactly that. A `hidden`
 * subtree has no layout box, so `LogViewer`'s mount effect used to measure
 * `scrollHeight 0`, write `scrollTop = 0`, and never run again: the log
 * opened on its **first** line. A local `DisclosedLogViewer` worked around
 * it by withholding the pane until the section had been opened once.
 *
 * `@charcuterie/ui@1.0.0` fixed it in the library — a `ResizeObserver` on
 * the pane, live only while following, for which *gaining a box is the
 * first callback* — so the workaround is deleted and this renders the two
 * components directly.
 *
 * ### `data-log-id` is gone
 *
 * It was a `data-testid` under another name — a handle only the suite could
 * see. The pane is found by its `label` now, which is the query Playwright
 * and a screen reader both make.
 */
export const JobLogsDisclosure = ({
  jobId,
  jobStatus,
}: {
  jobId: string
  jobStatus: string
}) => {
  const logsByJobId = useAtomValue(logsByJobIdAtom)
  const lines = logsByJobId.get(jobId) ?? []
  const { connect } = useLogStream(jobId)

  useEffect(() => {
    if (jobStatus === "running") {
      connect()
    }
  }, [jobStatus, connect])

  return (
    <Accordion
      items={[
        {
          content: (
            <div className="flex flex-col gap-1">
              {/*
                Above the pane rather than in the trigger: `Accordion`'s
                trigger is a `<button>`, and a `<button>` inside one is
                invalid markup browsers repair by hoisting it out.
              */}
              <div className="flex justify-end">
                <CopyTextButton
                  getText={() =>
                    lines
                      .map(({ line }) => line)
                      .join("\n")
                  }
                />
              </div>

              <LogViewer
                label={`Logs for job ${jobId}`}
                lines={lines.map(({ key, line }) => ({
                  key,
                  text: line,
                }))}
              />
            </div>
          ),
          key: LOGS_KEY,
          label: "Logs",
        },
      ]}
      onChange={(expandedKeys) => {
        if (!expandedKeys.includes(LOGS_KEY)) {
          return
        }

        connect()
      }}
    />
  )
}
