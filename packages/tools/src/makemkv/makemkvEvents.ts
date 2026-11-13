/**
 * MakeMKV robot-mode (`-r`) output model, shared by mux-magic and rip-deck.
 *
 * Both apps once carried their own copy of this file (rip-deck in
 * `packages/contracts/src/makemkv.ts`, mux-magic in
 * `packages/core/src/tools/makemkv/makemkvEvents.ts`). This is the merge of
 * the two: mux-magic's spelled-out field names, and the union of both
 * apps' message codes and predicates.
 *
 * Field layouts come from real `makemkvcon` output, not the docs. The docs
 * omit the index prefixes on TINFO / SINFO and undercount DRV.
 */

/** `DRV:index,visible,enabled,flags,name,discName,devicePath` */
export type MakemkvDriveEvent = {
  type: "DRV"
  index: number
  visible: number
  enabled: number
  flags: number
  driveName: string
  discName: string
  devicePath: string
}

/**
 * `MSG:code,flags,count,message,format,param0..paramN`
 *
 * `flags` is a bitfield. The one that matters operationally is BOXYESNO;
 * see `getIsMakemkvPrompt`.
 */
export type MakemkvMessageEvent = {
  type: "MSG"
  code: number
  flags: number
  count: number
  message: string
  format: string
  params: string[]
}

/** `TCOUNT:count` — number of titles on the disc. */
export type MakemkvTitleCountEvent = {
  type: "TCOUNT"
  count: number
}

/** `CINFO:id,code,value` — disc-level attribute. */
export type MakemkvDiscAttributeEvent = {
  type: "CINFO"
  attributeId: number
  code: number
  value: string
}

/** `TINFO:title,id,code,value` — title-level attribute. */
export type MakemkvTitleAttributeEvent = {
  type: "TINFO"
  titleIndex: number
  attributeId: number
  code: number
  value: string
}

/** `SINFO:title,stream,id,code,value` — stream-level attribute. */
export type MakemkvStreamAttributeEvent = {
  type: "SINFO"
  titleIndex: number
  streamIndex: number
  attributeId: number
  code: number
  value: string
}

/** `PRGC:code,id,name` — the operation running right now. */
export type MakemkvCurrentProgressTitleEvent = {
  type: "PRGC"
  code: number
  operationId: number
  name: string
}

/** `PRGT:code,id,name` — the overall operation. */
export type MakemkvTotalProgressTitleEvent = {
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
export type MakemkvProgressValuesEvent = {
  type: "PRGV"
  current: number
  total: number
  max: number
}

/** A line whose prefix was recognised but could not be parsed. */
export type MakemkvMalformedEvent = {
  type: "MALFORMED"
  prefix: string
  raw: string
  reason: string
}

/** A line with no known robot-mode prefix. */
export type MakemkvUnknownEvent = {
  type: "UNKNOWN"
  raw: string
}

export type MakemkvEvent =
  | MakemkvDriveEvent
  | MakemkvMessageEvent
  | MakemkvTitleCountEvent
  | MakemkvDiscAttributeEvent
  | MakemkvTitleAttributeEvent
  | MakemkvStreamAttributeEvent
  | MakemkvCurrentProgressTitleEvent
  | MakemkvTotalProgressTitleEvent
  | MakemkvProgressValuesEvent
  | MakemkvMalformedEvent
  | MakemkvUnknownEvent

export type MakemkvEventType = MakemkvEvent["type"]

/**
 * MSG codes that drive control flow. Everything else is informational.
 */
export const makemkvMessageCode = {
  /** "MakeMKV vX started" — the binary actually launched. */
  STARTED: 1005,
  /** SCSI read error with sense data. */
  READ_ERROR: 2003,
  /** Opening a folder/disc source. */
  OPENING_SOURCE: 3006,
  /** Title skipped for being shorter than the minimum length. */
  TITLE_TOO_SHORT: 3025,
  /**
   * "File %1 was added as title #%2".
   *
   * rip-deck counts it as the per-title completion signal of a `backup`
   * run; mux-magic reads the source file name and title index from it.
   */
  TITLE_ADDED: 3307,
  /** Title skipped as identical to another title. */
  TITLE_IS_DUPLICATE: 3309,
  /**
   * "%1 titles saved, %2 failed" — the code the MakeMKV docs give for the
   * end of an `mkv` run.
   *
   * Neither app has captured it. A real `mkv` extraction on MakeMKV
   * v1.18.4 emits `COPY_COMPLETE` (5036) and `TITLES_SAVED` (5005)
   * instead, and `backup` emits none of the three. It is still read as a
   * titles-saved message so a MakeMKV build that does emit it is not
   * reported as a silent success.
   */
  DOCUMENTED_COPY_COMPLETE: 5004,
  /** "N titles saved" — the count, in `params[0]`. N===0 is a FAILURE. */
  TITLES_SAVED: 5005,
  /** "Saving N titles into directory <url>" — the save pass started. */
  SAVING_TITLES: 5014,
  /** Evaluation period expired. */
  KEY_EXPIRED: 5021,
  /**
   * "Copy complete. N titles saved." — captured off a real `mkv`
   * extraction on MakeMKV v1.18.4. N===0 is a FAILURE.
   */
  COPY_COMPLETE: 5036,
  /** No usable optical drives — expected and harmless for `file:` sources. */
  NO_OPTICAL_DRIVES: 5042,
  /** Registration key expired / invalid. */
  KEY_INVALID: 5052,
  /** Beta key needs updating. */
  KEY_BETA_EXPIRED: 5055,
  /**
   * "Backup failed" / "Backup failed." — the failure twins of
   * `BACKUP_DONE` / `BACKUP_DONE_FINAL`. MakeMKV still exits 0 after them.
   */
  BACKUP_FAILED: 5069,
  /**
   * "Backup done" — what `backup` emits instead of a titles-saved count.
   * Two codes for the same English string, in this order; treat either as
   * completion.
   */
  BACKUP_DONE: 5070,
  /**
   * "Backing up disc into folder %1" — the copy of a `backup` run starts
   * here. Everything before it is MakeMKV opening the disc and negotiating
   * keys; everything after it is the copy.
   */
  BACKUP_STARTED: 5072,
  BACKUP_FAILED_FINAL: 5080,
  BACKUP_DONE_FINAL: 5081,
  /**
   * "Loaded content hash table, will verify integrity of M2TS files." —
   * MakeMKV verifies this rip itself. Blu-ray only; a DVD carries no
   * content hash table, so its absence on a DVD says nothing.
   */
  BACKUP_HASH_TABLE_LOADED: 5085,
} as const

/**
 * Key failure outranks every other reason: an expired or invalid key makes
 * every downstream symptom (zero titles, empty graph) a consequence rather
 * than a cause, so it must be reported first. makemkvcon exits 0 with an
 * expired key, so the exit code proves nothing and the code must be read.
 */
export const makemkvKeyFailureMessageCodes: readonly number[] =
  [
    makemkvMessageCode.KEY_EXPIRED,
    makemkvMessageCode.KEY_INVALID,
    makemkvMessageCode.KEY_BETA_EXPIRED,
  ]

export const getIsMakemkvKeyFailureEvent = (
  event: MakemkvEvent,
): event is MakemkvMessageEvent =>
  event.type === "MSG" &&
  makemkvKeyFailureMessageCodes.includes(event.code)

/**
 * The messages that report how many titles a save pass wrote. The count is
 * read from `params`, not the rendered message, so a locale change cannot
 * break it.
 */
export const makemkvTitlesSavedMessageCodes: readonly number[] =
  [
    makemkvMessageCode.COPY_COMPLETE,
    makemkvMessageCode.TITLES_SAVED,
    makemkvMessageCode.DOCUMENTED_COPY_COMPLETE,
  ]

const titlesSavedMessagePattern = /(\d+)\s+titles?\s+saved/i

/**
 * How many titles one titles-saved message reports, or null when the
 * message is not one or carries no count.
 *
 * Robot mode still exits 0 when that number is zero, which is ARM's
 * silent-success bug (#1298). The first integer param wins; the rendered
 * message is a fallback only for a message with no numeric param.
 */
export const getMakemkvTitlesSavedFromMessage = (
  event: MakemkvMessageEvent,
): number | null =>
  makemkvTitlesSavedMessageCodes.includes(event.code)
    ? (event.params
        .map((param) => Number.parseInt(param, 10))
        .find((count) => Number.isInteger(count)) ??
      ((matchedMessage) =>
        matchedMessage === null
          ? null
          : Number.parseInt(matchedMessage[1], 10))(
        event.message.match(titlesSavedMessagePattern),
      ))
    : null

/**
 * How many titles the save pass actually wrote, or null if it never said.
 *
 * `makemkvcon` exits 0 having saved NOTHING — the same silent-success trap
 * the key check exists for.
 */
export const getMakemkvSavedTitleCount = (
  events: MakemkvEvent[],
): number | null =>
  events
    .filter(
      (event): event is MakemkvMessageEvent =>
        event.type === "MSG",
    )
    .map(getMakemkvTitlesSavedFromMessage)
    .find((count) => count !== null) ?? null

/**
 * MakeMKV's `flags` bitfield carries the dialog type in the low bits.
 * `flags & 3854 === 776` is BOXYESNO: makemkvcon is waiting for an
 * interactive answer that a robot-mode pipe will never supply. Treat it as
 * a hang, kill it, and log the question.
 */
export const makemkvBoxYesNoMask = 3854
export const makemkvBoxYesNoValue = 776

export const getIsMakemkvPrompt = (
  event: MakemkvEvent,
): event is MakemkvMessageEvent =>
  event.type === "MSG" &&
  (event.flags & makemkvBoxYesNoMask) ===
    makemkvBoxYesNoValue

/**
 * The CSS handshake artefact every protected DVD produces.
 *
 * On a CSS DVD exactly one `MSG:2003` arrives before the copy begins:
 *
 *     MSG:2003,0,3,"Error 'Scsi error - ILLEGAL REQUEST:READ OF
 *     SCRAMBLED SECTOR WITHOUT AUTHENTICATION' occurred while
 *     reading '…' at offset '1048576'"
 *
 * It is MakeMKV probing the disc before the title key is known. It is not
 * damage, and counting it as a read error failed a perfect DVD backup.
 *
 * This predicate is the TEXT half of the test. A caller must also check
 * POSITION (before `BACKUP_STARTED`): a mid-disc scrambled-sector error is
 * still a real error, and the rendered text is translated while the
 * position is not.
 */
export const makemkvScrambledSectorMarker =
  "READ OF SCRAMBLED SECTOR WITHOUT AUTHENTICATION"

export const getIsMakemkvScrambledSectorError = (
  event: MakemkvMessageEvent,
): boolean =>
  event.code === makemkvMessageCode.READ_ERROR &&
  [event.message, event.format]
    .concat(event.params)
    .some((field) =>
      field
        .toUpperCase()
        .includes(makemkvScrambledSectorMarker),
    )

/** Did the backup reach `MSG:5070` / `MSG:5081`? */
export const getIsMakemkvBackupCompleteMessage = (
  event: MakemkvMessageEvent,
): boolean =>
  event.code === makemkvMessageCode.BACKUP_DONE ||
  event.code === makemkvMessageCode.BACKUP_DONE_FINAL

/** Did MakeMKV say the backup failed? */
export const getIsMakemkvBackupFailureMessage = (
  event: MakemkvMessageEvent,
): boolean =>
  event.code === makemkvMessageCode.BACKUP_FAILED ||
  event.code === makemkvMessageCode.BACKUP_FAILED_FINAL

/**
 * MakeMKV's own integrity check, when it says it FAILED.
 *
 * Matched by text because no captured rip has ever failed a hash check, so
 * no capture carries the message code. The strings were read out of the
 * `libmakemkv.so.1` that MakeMKV 1.18.4 ships:
 *
 *     "Backup done but %1 files failed hash check"
 *     "Hash check failed for file %1 at offset %2, file is corrupt."
 *     "Too many hash check errors in file %1."
 *
 * Replace this with the codes the first time a capture carries one — a
 * text match is locale-fragile and a code is not.
 */
const hashCheckFailureMarker = "HASH CHECK"

export const getIsMakemkvHashCheckFailureMessage = (
  event: MakemkvMessageEvent,
): boolean =>
  ((haystack) =>
    haystack.includes(hashCheckFailureMarker) &&
    (haystack.includes("FAILED HASH CHECK") ||
      haystack.includes("HASH CHECK FAILED") ||
      haystack.includes("HASH CHECK ERRORS")))(
    `${event.message} ${event.format}`
      .toUpperCase()
      .replaceAll(/\s+/gu, " "),
  )
