import { describe, expect, test } from "vitest"

import {
  getIsMakemkvBackupCompleteMessage,
  getIsMakemkvBackupFailureMessage,
  getIsMakemkvHashCheckFailureMessage,
  getIsMakemkvKeyFailureEvent,
  getIsMakemkvPrompt,
  getIsMakemkvScrambledSectorError,
  getMakemkvSavedTitleCount,
  getMakemkvTitlesSavedFromMessage,
  type MakemkvMessageEvent,
  makemkvMessageCode,
} from "./makemkvEvents.js"
import { parseMakemkvLine } from "./parseLine.js"

// The message predicates, tested against the shapes real captures carry —
// never a shape invented to make a predicate pass.

const createMessage = (
  overrides: Partial<MakemkvMessageEvent> = {},
): MakemkvMessageEvent => ({
  code: makemkvMessageCode.READ_ERROR,
  count: 3,
  flags: 0,
  format: "",
  message: "",
  params: [],
  type: "MSG",
  ...overrides,
})

const parseMessageLine = (line: string) =>
  ((event) =>
    event.type === "MSG"
      ? event
      : createMessage({ code: -1 }))(parseMakemkvLine(line))

describe(getMakemkvTitlesSavedFromMessage.name, () => {
  test("reads the count from the documented MSG:5004 params", () => {
    expect(
      getMakemkvTitlesSavedFromMessage(
        parseMessageLine(
          'MSG:5004,0,2,"2 titles saved, 0 failed","%1 titles ' +
            'saved, %2 failed","2","0"',
        ),
      ),
    ).toBe(2)
  })

  test("reads ZERO titles saved — the silent-success trap", () => {
    // makemkvcon exits 0 here. ARM reports this as a success (upstream
    // #1298). It is a failure.
    expect(
      getMakemkvTitlesSavedFromMessage(
        parseMessageLine(
          'MSG:5004,0,2,"0 titles saved, 1 failed","%1 titles ' +
            'saved, %2 failed","0","1"',
        ),
      ),
    ).toBe(0)
  })

  test("reads the captured MSG:5036 that a real mkv extraction emits", () => {
    expect(
      getMakemkvTitlesSavedFromMessage(
        parseMessageLine(
          'MSG:5036,260,1,"Copy complete. 1 titles saved.",' +
            '"Copy complete. %1 titles saved.","1"',
        ),
      ),
    ).toBe(1)
  })

  test("falls back to the rendered message when no param is numeric", () => {
    expect(
      getMakemkvTitlesSavedFromMessage(
        createMessage({
          code: makemkvMessageCode.TITLES_SAVED,
          message: "3 titles saved",
        }),
      ),
    ).toBe(3)
  })

  test("returns null for a message that is not a titles-saved message", () => {
    expect(
      getMakemkvTitlesSavedFromMessage(
        parseMessageLine(
          'MSG:1005,0,0,"started","started"',
        ),
      ),
    ).toBeNull()
  })
})

describe(getMakemkvSavedTitleCount.name, () => {
  test("takes the first count any titles-saved message reports", () => {
    expect(
      getMakemkvSavedTitleCount(
        [
          'MSG:1005,0,0,"started","started"',
          'MSG:5036,260,1,"Copy complete. 2 titles saved.","Copy complete. %1 titles saved.","2"',
          'MSG:5005,0,1,"2 titles saved","%1 titles saved","2"',
        ].map(parseMakemkvLine),
      ),
    ).toBe(2)
  })

  test("returns null when nothing reported a count", () => {
    expect(
      getMakemkvSavedTitleCount(
        ['MSG:5070,0,0,"Backup done","Backup done"'].map(
          parseMakemkvLine,
        ),
      ),
    ).toBeNull()
  })
})

describe(getIsMakemkvKeyFailureEvent.name, () => {
  test.each([
    makemkvMessageCode.KEY_EXPIRED,
    makemkvMessageCode.KEY_INVALID,
    makemkvMessageCode.KEY_BETA_EXPIRED,
  ])("matches key failure code %i", (code) => {
    expect(
      getIsMakemkvKeyFailureEvent(createMessage({ code })),
    ).toBe(true)
  })

  test("does not match an ordinary message", () => {
    expect(
      getIsMakemkvKeyFailureEvent(
        createMessage({ code: makemkvMessageCode.STARTED }),
      ),
    ).toBe(false)
  })
})

describe(getIsMakemkvPrompt.name, () => {
  test("detects a dialog makemkvcon will wait forever on", () => {
    expect(
      getIsMakemkvPrompt(
        parseMakemkvLine(
          'MSG:5011,776,0,"Do you want to continue?","%1"',
        ),
      ),
    ).toBe(true)
  })

  test("does not flag an ordinary message", () => {
    expect(
      getIsMakemkvPrompt(
        parseMakemkvLine(
          'MSG:1005,0,0,"started","started"',
        ),
      ),
    ).toBe(false)
  })
})

describe(getIsMakemkvScrambledSectorError.name, () => {
  test("matches the CSS handshake probe every protected DVD raises", () => {
    expect(
      getIsMakemkvScrambledSectorError(
        createMessage({
          message:
            "Error 'Scsi error - ILLEGAL REQUEST:READ OF " +
            "SCRAMBLED SECTOR WITHOUT AUTHENTICATION' " +
            "occurred while reading 'BD-RE ASUS BW-16D1HT' " +
            "at offset '1048576'",
          params: [
            "Scsi error - ILLEGAL REQUEST:READ OF SCRAMBLED " +
              "SECTOR WITHOUT AUTHENTICATION",
            "BD-RE ASUS BW-16D1HT",
            "1048576",
          ],
        }),
      ),
    ).toBe(true)
  })

  test("does NOT match an unrecovered medium error", () => {
    // The sense a genuinely bad sector reports. Waving this through would
    // be the ARM bug, not a fix for it.
    expect(
      getIsMakemkvScrambledSectorError(
        createMessage({
          message:
            "Error 'Scsi error - MEDIUM ERROR:UNRECOVERED " +
            "READ ERROR' occurred while reading " +
            "'/BDMV/STREAM/00001.m2ts' at offset '2097152'",
          params: ["Scsi error", "00001.m2ts", "2097152"],
        }),
      ),
    ).toBe(false)
  })

  test("does not match a message that merely quotes the words on another code", () => {
    // It is a READ_ERROR predicate. An informational line that happened to
    // contain the phrase is not a read error.
    expect(
      getIsMakemkvScrambledSectorError(
        createMessage({
          code: 1011,
          message:
            "READ OF SCRAMBLED SECTOR WITHOUT AUTHENTICATION",
        }),
      ),
    ).toBe(false)
  })
})

describe("the backup completion twins", () => {
  test("treats 5070 and 5081 as completion", () => {
    expect(
      getIsMakemkvBackupCompleteMessage(
        createMessage({ code: 5070 }),
      ),
    ).toBe(true)
    expect(
      getIsMakemkvBackupCompleteMessage(
        createMessage({ code: 5081 }),
      ),
    ).toBe(true)
  })

  test("treats 5069 and 5080 as failure", () => {
    expect(
      getIsMakemkvBackupFailureMessage(
        createMessage({ code: 5069 }),
      ),
    ).toBe(true)
    expect(
      getIsMakemkvBackupFailureMessage(
        createMessage({ code: 5080 }),
      ),
    ).toBe(true)
  })

  test("keeps the two sets apart", () => {
    expect(
      getIsMakemkvBackupFailureMessage(
        createMessage({ code: 5070 }),
      ),
    ).toBe(false)
    expect(
      getIsMakemkvBackupCompleteMessage(
        createMessage({ code: 5069 }),
      ),
    ).toBe(false)
  })
})

describe(getIsMakemkvHashCheckFailureMessage.name, () => {
  // These strings were read out of the `libmakemkv.so.1` that MakeMKV
  // 1.18.4 ships. Their codes are unknown, which is why the predicate
  // matches text.
  test.each([
    "Backup done but 3 files failed hash check",
    "Backup done but 3 files failed hash check.",
    "Hash check failed for file 00001.m2ts at offset 12, file is corrupt.",
    "Too many hash check errors in file 00001.m2ts.",
  ])("matches %s", (text) => {
    expect(
      getIsMakemkvHashCheckFailureMessage(
        createMessage({ code: 5086, message: text }),
      ),
    ).toBe(true)
  })

  test("does NOT match the hash table merely being loaded", () => {
    // MSG:5085 is the GOOD news — MakeMKV is about to verify the copy.
    expect(
      getIsMakemkvHashCheckFailureMessage(
        createMessage({
          code: makemkvMessageCode.BACKUP_HASH_TABLE_LOADED,
          message:
            "Loaded content hash table, will verify " +
            "integrity of M2TS files.",
        }),
      ),
    ).toBe(false)
  })
})
