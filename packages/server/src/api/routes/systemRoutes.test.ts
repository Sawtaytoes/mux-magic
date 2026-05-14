import { cpus } from "node:os"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import { systemRoutes } from "./systemRoutes.js"

let savedMaxThreads: string | undefined
let savedDefaultThreadCount: string | undefined

beforeEach(() => {
  savedMaxThreads = process.env.MAX_THREADS
  savedDefaultThreadCount = process.env.DEFAULT_THREAD_COUNT
  delete process.env.MAX_THREADS
  delete process.env.DEFAULT_THREAD_COUNT
})

afterEach(() => {
  if (savedMaxThreads === undefined) {
    delete process.env.MAX_THREADS
  } else {
    process.env.MAX_THREADS = savedMaxThreads
  }
  if (savedDefaultThreadCount === undefined) {
    delete process.env.DEFAULT_THREAD_COUNT
  } else {
    process.env.DEFAULT_THREAD_COUNT =
      savedDefaultThreadCount
  }
})

describe("GET /system/threads", () => {
  test("returns the correct shape with default env", async () => {
    const response = await systemRoutes.request(
      "/system/threads",
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      maxThreads: unknown
      defaultThreadCount: unknown
      totalCpus: unknown
    }
    expect(typeof body.maxThreads).toBe("number")
    expect(typeof body.defaultThreadCount).toBe("number")
    expect(typeof body.totalCpus).toBe("number")
    expect(body.totalCpus).toBe(cpus().length)
  })

  test("maxThreads respects MAX_THREADS env var", async () => {
    process.env.MAX_THREADS = "6"
    const response = await systemRoutes.request(
      "/system/threads",
    )
    const body = (await response.json()) as {
      maxThreads: number
      defaultThreadCount: number
      totalCpus: number
    }

    expect(body.maxThreads).toBe(6)
  })

  test("defaultThreadCount defaults to 2 when env var is unset", async () => {
    process.env.MAX_THREADS = "8"
    const response = await systemRoutes.request(
      "/system/threads",
    )
    const body = (await response.json()) as {
      maxThreads: number
      defaultThreadCount: number
      totalCpus: number
    }

    expect(body.defaultThreadCount).toBe(2)
  })

  test("defaultThreadCount falls back to maxThreads when DEFAULT_THREAD_COUNT is 0", async () => {
    process.env.MAX_THREADS = "8"
    process.env.DEFAULT_THREAD_COUNT = "0"
    const response = await systemRoutes.request(
      "/system/threads",
    )
    const body = (await response.json()) as {
      maxThreads: number
      defaultThreadCount: number
      totalCpus: number
    }

    expect(body.defaultThreadCount).toBe(8)
    expect(body.maxThreads).toBe(8)
  })

  test("defaultThreadCount is clamped to maxThreads", async () => {
    process.env.MAX_THREADS = "4"
    process.env.DEFAULT_THREAD_COUNT = "99"
    const response = await systemRoutes.request(
      "/system/threads",
    )
    const body = (await response.json()) as {
      maxThreads: number
      defaultThreadCount: number
      totalCpus: number
    }

    expect(body.maxThreads).toBe(4)
    expect(body.defaultThreadCount).toBe(4)
  })
})
