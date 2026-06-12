import { describe, expect, test } from "vitest"

import { detectIsContainerized } from "./versionRoutes.js"

describe("detectIsContainerized", () => {
  test("returns true when IS_CONTAINERIZED env var is 'true'", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => "true",
      readCgroupContents: () => {
        throw new Error("should not be called")
      },
    })

    expect(isContainerized).toBe(true)
  })

  test("falls through to cgroup check when IS_CONTAINERIZED is 'false'", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => "false",
      readCgroupContents: () => "0::/init.scope",
    })

    expect(isContainerized).toBe(false)
  })

  test("falls through to cgroup check when IS_CONTAINERIZED is '1' (wrong shape)", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => "1",
      readCgroupContents: () => "0::/init.scope",
    })

    expect(isContainerized).toBe(false)
  })

  test("returns true when cgroup contains 'docker'", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => undefined,
      readCgroupContents: () =>
        "12:devices:/docker/abc123\n0::/ ",
    })

    expect(isContainerized).toBe(true)
  })

  test("returns true when cgroup contains 'containerd'", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => undefined,
      readCgroupContents: () =>
        "0::/system.slice/containerd.service/abc123",
    })

    expect(isContainerized).toBe(true)
  })

  test("returns true when cgroup contains 'kubepods'", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => undefined,
      readCgroupContents: () =>
        "12:devices:/kubepods/besteffort/pod123/abc",
    })

    expect(isContainerized).toBe(true)
  })

  test("returns false when cgroup reads as host systemd scope", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => undefined,
      readCgroupContents: () => "0::/init.scope",
    })

    expect(isContainerized).toBe(false)
  })

  test("returns false when cgroup read throws (e.g. ENOENT on Windows)", () => {
    const isContainerized = detectIsContainerized({
      getEnv: () => undefined,
      readCgroupContents: () => {
        throw Object.assign(new Error("ENOENT"), {
          code: "ENOENT",
        })
      },
    })

    expect(isContainerized).toBe(false)
  })

  test("does not consult /.dockerenv path at all", () => {
    const dockerenvPaths: string[] = []

    detectIsContainerized({
      getEnv: () => undefined,
      readCgroupContents: () => {
        throw Object.assign(new Error("ENOENT"), {
          code: "ENOENT",
        })
      },
    })

    expect(dockerenvPaths).toHaveLength(0)
  })
})
