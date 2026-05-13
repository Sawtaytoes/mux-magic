import {
  createRoute,
  OpenAPIHono,
  z,
} from "@hono/zod-openapi"

import { isFakeRequest } from "../../fake-data/index.js"
import { resolvePrompt } from "../promptStore.js"
import { jobNotFoundSchema } from "../schemas.js"

export const inputRoutes = new OpenAPIHono()

const inputBodySchema = z.object({
  promptId: z
    .string()
    .describe("Prompt ID from the SSE prompt event"),
  selectedIndex: z
    .number()
    .describe(
      "Index of the selected option (-1 to skip/don't rename)",
    ),
})

const inputResponseSchema = z.object({
  ok: z.literal(true),
})

inputRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/:id/input",
    summary: "Submit a response to a job prompt",
    tags: ["Job Management"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Job ID",
        schema: { type: "string" },
      },
    ],
    request: {
      body: {
        content: {
          "application/json": {
            schema: inputBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Input accepted",
        content: {
          "application/json": {
            schema: inputResponseSchema,
          },
        },
      },
      404: {
        description: "Prompt not found or already resolved",
        content: {
          "application/json": {
            schema: jobNotFoundSchema,
          },
        },
      },
    },
  }),
  (context) => {
    // Fake mode never enqueues real prompts, so resolvePrompt would
    // 404 even though the UI's submit was the expected action — short-
    // circuit to a 200 ack so the Builder's prompt modal closes cleanly
    // when designers exercise the prompt UI in fake mode.
    if (isFakeRequest(context)) {
      return context.json({ ok: true as const }, 200)
    }
    const body = context.req.valid("json")
    const isResolved = resolvePrompt(
      body.promptId,
      body.selectedIndex,
    )

    if (!isResolved) {
      return context.json(
        { error: "Job not found" as const },
        404,
      )
    }

    return context.json({ ok: true as const }, 200)
  },
)
