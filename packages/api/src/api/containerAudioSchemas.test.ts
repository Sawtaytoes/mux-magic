import { describe, expect, test } from "vitest"
import {
  convertContainerAudioToFlacRequestSchema,
  findContainerAudioFilesRequestSchema,
} from "./schemas.js"

describe("findContainerAudioFilesRequestSchema", () => {
  test("round-trips with minimal required sourcePath", () => {
    const parsed =
      findContainerAudioFilesRequestSchema.parse({
        isRecursive: false,
        sourcePath: "/music",
      })
    expect(parsed.sourcePath).toBe("/music")
    expect(parsed.isRecursive).toBe(false)
  })

  test("rejects empty sourcePath", () => {
    expect(() =>
      findContainerAudioFilesRequestSchema.parse({
        isRecursive: false,
        sourcePath: "",
      }),
    ).toThrow()
  })

  test("defaults isRecursive to false when omitted", () => {
    const parsed =
      findContainerAudioFilesRequestSchema.parse({
        sourcePath: "/music",
      })
    expect(parsed.isRecursive).toBe(false)
  })

  test("accepts isRecursive: true", () => {
    const parsed =
      findContainerAudioFilesRequestSchema.parse({
        isRecursive: true,
        sourcePath: "/music",
      })
    expect(parsed.isRecursive).toBe(true)
  })
})

describe("convertContainerAudioToFlacRequestSchema", () => {
  test("round-trips with minimal required fields", () => {
    const parsed =
      convertContainerAudioToFlacRequestSchema.parse({
        isRecursive: false,
        sourcePath: "/music",
      })
    expect(parsed.sourcePath).toBe("/music")
    expect(parsed.isRecursive).toBe(false)
  })

  test("rejects empty sourcePath", () => {
    expect(() =>
      convertContainerAudioToFlacRequestSchema.parse({
        isRecursive: false,
        sourcePath: "",
      }),
    ).toThrow()
  })

  test("defaults isSourceDeleted to false when omitted", () => {
    const parsed =
      convertContainerAudioToFlacRequestSchema.parse({
        isRecursive: false,
        sourcePath: "/music",
      })
    expect(parsed.isSourceDeleted).toBe(false)
  })

  test("defaults isVideoDropAcknowledged to false when omitted", () => {
    const parsed =
      convertContainerAudioToFlacRequestSchema.parse({
        isRecursive: false,
        sourcePath: "/music",
      })
    expect(parsed.isVideoDropAcknowledged).toBe(false)
  })

  test("defaults isRecursive to false when omitted", () => {
    const parsed =
      convertContainerAudioToFlacRequestSchema.parse({
        sourcePath: "/music",
      })
    expect(parsed.isRecursive).toBe(false)
  })

  test("accepts all optional booleans explicitly set", () => {
    const parsed =
      convertContainerAudioToFlacRequestSchema.parse({
        isRecursive: true,
        isSourceDeleted: true,
        isVideoDropAcknowledged: true,
        sourcePath: "/music",
      })
    expect(parsed.isRecursive).toBe(true)
    expect(parsed.isSourceDeleted).toBe(true)
    expect(parsed.isVideoDropAcknowledged).toBe(true)
  })
})
