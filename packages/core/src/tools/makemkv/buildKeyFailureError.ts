import { makeMkvHomePath } from "../appPaths.js"
import type { MessageEvent } from "./makemkvEvents.js"

/**
 * Describe a MakeMKV key failure in the terms the operator can act on.
 *
 * Key failure outranks every other reason (same precedence rule as
 * rip-deck's `rip/outcome.ts`): with an expired key makemkvcon still exits
 * 0 and simply reports no titles, so "no titles found" would be reported
 * as a disc problem when it is a licensing problem.
 */
export const buildKeyFailureError = (
  keyFailureMessages: MessageEvent[],
) =>
  new Error(
    [
      "makemkvcon reported a registration-key failure:",
      keyFailureMessages
        .map(
          (event) => `MSG:${event.code} ${event.message}`,
        )
        .join("; "),
      `Put a valid key in ${makeMkvHomePath ?? "$HOME"}/.MakeMKV/settings.conf`,
      "(bind /mnt/TrueNAS-Apps/App-Configs/mux-magic/makemkv -> /makemkv-config).",
      "The key is never baked into the image and never committed.",
    ].join(" "),
  )
