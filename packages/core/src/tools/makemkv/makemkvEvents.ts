/**
 * MakeMKV robot-mode (`-r`) output model.
 *
 * Ported from rip-deck `packages/contracts/src/makemkv.ts` (2026-08-12).
 * Separate repos with no shared package, so this is a copy rather than a
 * dependency. Field layouts come from real `makemkvcon` output, not the
 * docs — the docs omit the index prefixes on TINFO / SINFO and undercount
 * DRV. Captured samples live in `__fixtures__/`.
 */

/** `DRV:index,visible,enabled,flags,name,discName,devicePath` */
export type DriveEvent = {
  type: "DRV"
  index: number
  visible: number
  enabled: number
  flags: number
  driveName: string
  discName: string
  devicePath: string
}

/** `MSG:code,flags,count,message,format,param0..paramN` */
export type MessageEvent = {
  type: "MSG"
  code: number
  flags: number
  count: number
  message: string
  format: string
  params: string[]
}

/** `TCOUNT:count` — number of titles on the disc. */
export type TitleCountEvent = {
  type: "TCOUNT"
  count: number
}

/** `CINFO:id,code,value` — disc-level attribute. */
export type DiscAttributeEvent = {
  type: "CINFO"
  attributeId: number
  code: number
  value: string
}

/** `TINFO:title,id,code,value` — title-level attribute. */
export type TitleAttributeEvent = {
  type: "TINFO"
  titleIndex: number
  attributeId: number
  code: number
  value: string
}

/** `SINFO:title,stream,id,code,value` — stream-level attribute. */
export type StreamAttributeEvent = {
  type: "SINFO"
  titleIndex: number
  streamIndex: number
  attributeId: number
  code: number
  value: string
}

/** `PRGC:code,id,name` — the operation running right now. */
export type CurrentProgressTitleEvent = {
  type: "PRGC"
  code: number
  operationId: number
  name: string
}

/** `PRGT:code,id,name` — the overall operation. */
export type TotalProgressTitleEvent = {
  type: "PRGT"
  code: number
  operationId: number
  name: string
}

/**
 * `PRGV:current,total,max` — progress values.
 *
 * `current` tracks the PRGC operation, `total` tracks PRGT, and both are
 * scaled against `max` (not against each other, and `max` is not always
 * 65536 — never assume it).
 */
export type ProgressValuesEvent = {
  type: "PRGV"
  current: number
  total: number
  max: number
}

/** A line we recognised the prefix of but could not parse. */
export type MalformedEvent = {
  type: "MALFORMED"
  prefix: string
  raw: string
  reason: string
}

/** A line with no known robot-mode prefix. */
export type UnknownEvent = {
  type: "UNKNOWN"
  raw: string
}

export type MakemkvEvent =
  | DriveEvent
  | MessageEvent
  | TitleCountEvent
  | DiscAttributeEvent
  | TitleAttributeEvent
  | StreamAttributeEvent
  | CurrentProgressTitleEvent
  | TotalProgressTitleEvent
  | ProgressValuesEvent
  | MalformedEvent
  | UnknownEvent

export type MakemkvEventType = MakemkvEvent["type"]

/**
 * MSG codes this repo acts on. Everything else is informational.
 *
 * The three key codes are the reason `analyseDiscBackup` can fail loudly:
 * makemkvcon exits 0 with an expired key and simply reports nothing, so
 * the exit code proves nothing and the code must be read.
 */
export const makemkvMessageCode = {
  /** "MakeMKV vX started" — the binary actually launched. */
  STARTED: 1005,
  /** Opening a folder/disc source. */
  OPENING_SOURCE: 3006,
  /** Title was added, with its source file name. */
  TITLE_ADDED: 3307,
  /** Title skipped for being shorter than the minimum length. */
  TITLE_TOO_SHORT: 3025,
  /** Title skipped as identical to another title. */
  TITLE_IS_DUPLICATE: 3309,
  /** "Saving N titles into directory <url>" — the save pass started. */
  SAVING_TITLES: 5014,
  /** "N titles saved" — the count, in `params[0]`. N===0 is a FAILURE. */
  TITLES_SAVED: 5005,
  /**
   * "Copy complete. N titles saved."
   *
   * 5036, NOT the 5004 the docs and rip-deck's contracts name. Captured
   * off a real `mkv` extraction on MakeMKV v1.18.4 —
   * `__fixtures__/desk-set-bluray-extract-title.robot.log` contains 5036
   * and 5005 and no 5004 at all. rip-deck only ever runs `backup`, which
   * emits neither, so its 5004 has never been exercised.
   */
  COPY_COMPLETE: 5036,
  /** No usable optical drives — expected and harmless for `file:` sources. */
  NO_OPTICAL_DRIVES: 5042,
  /** Evaluation period expired. */
  KEY_EXPIRED: 5021,
  /** Registration key expired / invalid. */
  KEY_INVALID: 5052,
  /** Beta key needs updating. */
  KEY_BETA_EXPIRED: 5055,
} as const

/**
 * Key failure outranks every other reason.
 *
 * Same precedence rule as rip-deck's `rip/outcome.ts`: an expired or
 * invalid key makes every downstream symptom (zero titles, empty graph)
 * a consequence rather than a cause, so it must be reported first.
 */
export const keyFailureMessageCodes = [
  makemkvMessageCode.KEY_EXPIRED,
  makemkvMessageCode.KEY_INVALID,
  makemkvMessageCode.KEY_BETA_EXPIRED,
] as const

export const getIsKeyFailureEvent = (
  event: MakemkvEvent,
): event is MessageEvent =>
  event.type === "MSG" &&
  (keyFailureMessageCodes as readonly number[]).includes(
    event.code,
  )

/**
 * How many titles the save pass actually wrote, or null if it never said.
 *
 * `makemkvcon` exits 0 having saved NOTHING — the same silent-success trap
 * the key check exists for. The count is read from `params`, not the
 * rendered message, so a locale change cannot break it.
 */
export const getSavedTitleCount = (
  events: MakemkvEvent[],
) =>
  events
    .filter(
      (event): event is MessageEvent =>
        event.type === "MSG" &&
        (event.code === makemkvMessageCode.COPY_COMPLETE ||
          event.code === makemkvMessageCode.TITLES_SAVED),
    )
    .flatMap((event) => event.params)
    .map((param) => Number.parseInt(param, 10))
    .filter((count) => Number.isInteger(count))
    .at(0) ?? null

/**
 * MakeMKV's `flags` bitfield carries the dialog type in the low bits.
 * `flags & 3854 === 776` is BOXYESNO: makemkvcon is waiting for an
 * interactive answer that a robot-mode pipe will never supply. Treat it
 * as a hang, kill it, and log the question.
 */
export const boxYesNoMask = 3854
export const boxYesNoValue = 776

export const getIsMakemkvPrompt = (
  event: MakemkvEvent,
): event is MessageEvent =>
  event.type === "MSG" &&
  (event.flags & boxYesNoMask) === boxYesNoValue
