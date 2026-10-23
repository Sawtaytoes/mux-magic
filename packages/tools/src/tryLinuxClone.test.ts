import { beforeEach, expect, test, vi } from "vitest"

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock("node:child_process", () => ({ execFile: execute }))

import { tryLinuxClone } from "./tryLinuxClone.js"

beforeEach(() => {
  vi.clearAllMocks()
})

test("passes source paths literally to an exclusive content-only clone", async () => {
  execute.mockImplementationOnce((...arguments_) =>
    arguments_.at(-1)(null, "", ""),
  )
  await expect(
    tryLinuxClone({
      platform: "linux",
      source: "/staged/$(literal).mkv",
      destination: "/staged/.unique.tmp",
    }),
  ).resolves.toBe(true)
  expect(execute).toHaveBeenCalledWith(
    "python3",
    [
      "-c",
      expect.any(String),
      "/staged/$(literal).mkv",
      "/staged/.unique.tmp",
    ],
    { timeout: 60_000, maxBuffer: 16_384 },
    expect.any(Function),
  )
})

test("declines cloning when Python or the filesystem operation fails", async () => {
  execute.mockImplementationOnce((...arguments_) =>
    arguments_.at(-1)(new Error("unsupported"), "", ""),
  )
  await expect(
    tryLinuxClone({
      platform: "linux",
      source: "/staged/source.mkv",
      destination: "/staged/.unique.tmp",
    }),
  ).resolves.toBe(false)
})

test("uses the existing copy path on systems without the Linux ioctl", async () => {
  await expect(
    tryLinuxClone({
      platform: "win32",
      source: "source.mkv",
      destination: "temporary.mkv",
    }),
  ).resolves.toBe(false)
  expect(execute).not.toHaveBeenCalled()
})
