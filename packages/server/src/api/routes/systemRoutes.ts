import { cpus } from "node:os"

import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"

import {
  resolveDefaultThreadCount,
  resolveMaxThreads,
} from "../../tools/resolveThreadEnvVars.js"

const systemThreadsSchema = z.object({
  maxThreads: z
    .number()
    .int()
    .positive()
    .describe(
      "Resolved MAX_THREADS — the hard ceiling on concurrent task slots across all jobs. Defaults to os.cpus().length when MAX_THREADS is unset or zero.",
    ),
  defaultThreadCount: z
    .number()
    .int()
    .positive()
    .describe(
      "Resolved DEFAULT_THREAD_COUNT — the per-job thread claim applied when a sequence has no threadCount variable. Defaults to 2. Clamped to maxThreads. Set DEFAULT_THREAD_COUNT=0 to use maxThreads as the default instead.",
    ),
  totalCpus: z
    .number()
    .int()
    .positive()
    .describe(
      "os.cpus().length — informational; the raw CPU count that maxThreads defaults to when MAX_THREADS is unset.",
    ),
})

export const systemRoutes = new OpenAPIHono()

systemRoutes.openapi(
  createRoute({
    method: "get",
    path: "/system/threads",
    summary: "Thread concurrency limits",
    description:
      "Returns the resolved thread-concurrency configuration. The UI calls this to pre-fill the threadCount variable default and display the system ceiling in the Edit Variables modal.",
    tags: ["Server"],
    responses: {
      200: {
        description: "Thread limits JSON.",
        content: {
          "application/json": {
            schema: systemThreadsSchema,
          },
        },
      },
    },
  }),
  (context) =>
    context.json(
      {
        maxThreads: resolveMaxThreads(),
        defaultThreadCount: resolveDefaultThreadCount(),
        totalCpus: cpus().length,
      },
      200,
    ),
)
