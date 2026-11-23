import type { MakemkvEvent } from "@mux-magic/tools"

const getLastMessageText = (events: MakemkvEvent[]) =>
  events.findLast((event) => event.type === "MSG")
    ?.message ?? null

// Describes a makemkvcon run that ended without success. A crash ends the
// process with a signal and no exit code (MakeMKV 2.0.0's segfault on a
// decrypted Blu-ray backup arrives as SIGSEGV), so a signal counts as a
// failure as much as a non-zero code does. The last MSG line says how far
// MakeMKV got, which is the clue a bare exit code lacks.
export const buildExitFailureError = ({
  code,
  events,
  signal,
  stderrText,
}: {
  code: number | null
  events: MakemkvEvent[]
  signal: NodeJS.Signals | null
  stderrText: string
}) =>
  ((lastMessageText) =>
    new Error(
      [
        code === null
          ? `makemkvcon crashed with ${signal ?? "an unknown signal"}.`
          : `makemkvcon exited with code ${code}.`,
      ]
        .concat(
          lastMessageText === null
            ? []
            : [`Last message: ${lastMessageText}`],
        )
        .concat(
          stderrText === ""
            ? []
            : [`stderr: ${stderrText}`],
        )
        .join(" "),
    ))(getLastMessageText(events))
