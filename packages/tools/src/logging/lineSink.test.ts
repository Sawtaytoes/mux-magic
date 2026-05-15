import { describe, expect, test } from "vitest"

import { formatLogLine } from "./lineSink.js"

describe(formatLogLine.name, () => {
  test("uses bracketed local-time timestamp prefix matching legacy logCapture", () => {
    const now = new Date()
    now.setHours(8, 21, 33, 512)

    const line = formatLogLine(
      { level: "info", msg: "copy finished" },
      now,
    )

    expect(line.startsWith("[08:21:33.512]")).toBe(true)
  })

  test("emits `<timestamp> <level> <msg>` for a record with no extra fields", () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const line = formatLogLine(
      { level: "warn", msg: "be careful" },
      now,
    )

    expect(line).toBe("[00:00:00.000] warn be careful")
  })

  test("renders extra fields inline as field=value before the msg", () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)

    const line = formatLogLine(
      {
        level: "info",
        msg: "step started",
        stepIndex: 2,
        fileId: "foo.mkv",
      },
      now,
    )

    expect(line).toBe(
      "[12:00:00.000] info stepIndex=2 fileId=foo.mkv step started",
    )
  })

  test("does not render undefined fields", () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const line = formatLogLine(
      {
        level: "info",
        msg: "m",
        jobId: undefined,
        stepIndex: 1,
      },
      now,
    )

    expect(line).not.toContain("jobId")
    expect(line).toContain("stepIndex=1")
  })

  test("quotes string values that contain whitespace", () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const line = formatLogLine(
      {
        level: "info",
        msg: "named",
        detail: "two words",
      },
      now,
    )

    expect(line).toContain(`detail="two words"`)
  })

  test("renders `[ts] [TAG] msg` when a `tag` field is present (preserves legacy chalk-stripped shape)", () => {
    const now = new Date()
    now.setHours(8, 21, 33, 512)

    const line = formatLogLine(
      {
        level: "info",
        msg: "Step step1 starting.",
        tag: "SEQUENCE",
      },
      now,
    )

    expect(line).toBe(
      "[08:21:33.512] [SEQUENCE] Step step1 starting.",
    )
  })

  test("tag-mode line still appends remaining extra fields", () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const line = formatLogLine(
      {
        level: "info",
        msg: "Step step1 starting.",
        tag: "SEQUENCE",
        stepIndex: 1,
      },
      now,
    )

    expect(line).toBe(
      "[00:00:00.000] [SEQUENCE] stepIndex=1 Step step1 starting.",
    )
  })

  test("serialises nested objects via JSON", () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const line = formatLogLine(
      {
        level: "error",
        msg: "boom",
        meta: { code: 42 },
      },
      now,
    )

    expect(line).toContain(`meta={"code":42}`)
  })
})
