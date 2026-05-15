import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"

import { redeliverError } from "../jobErrorDeliveryQueue.js"
import {
  deleteJobError,
  getJobError,
  listJobErrors,
} from "../jobErrorStore.js"

const deliveryStateSchema = z.enum([
  "pending",
  "delivered",
  "exhausted",
])

const webhookDeliverySchema = z.object({
  attempts: z.number().int().nonnegative(),
  lastAttemptAt: z.string().optional(),
  lastError: z.string().optional(),
  state: deliveryStateSchema,
})

const persistedJobErrorSchema = z.object({
  errorName: z.string().optional(),
  fileId: z.string().optional(),
  id: z.string(),
  jobId: z.string(),
  level: z.literal("error"),
  msg: z.string(),
  occurredAt: z.string(),
  spanId: z.string().optional(),
  stack: z.string().optional(),
  stepIndex: z.number().int().optional(),
  traceId: z.string().optional(),
  webhookDelivery: webhookDeliverySchema,
})

const notFoundSchema = z.object({
  error: z.string(),
})

const ERROR_NOT_FOUND = "Error record not found"

export const errorRoutes = new OpenAPIHono()

errorRoutes.openapi(
  createRoute({
    method: "get",
    path: "/errors",
    summary:
      "List persisted job error records, newest first",
    tags: ["Errors"],
    request: {
      query: z.object({
        jobId: z.string().optional(),
        state: deliveryStateSchema.optional(),
      }),
    },
    responses: {
      200: {
        description: "List of persisted job errors",
        content: {
          "application/json": {
            schema: z.array(persistedJobErrorSchema),
          },
        },
      },
    },
  }),
  (context) => {
    const { jobId, state } = context.req.valid("query")
    return context.json(listJobErrors({ jobId, state }))
  },
)

errorRoutes.openapi(
  createRoute({
    method: "get",
    path: "/errors/:id",
    summary: "Get a single persisted job error record",
    tags: ["Errors"],
    parameters: [
      {
        description: "Error record ID",
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Error record",
        content: {
          "application/json": {
            schema: persistedJobErrorSchema,
          },
        },
      },
      404: {
        description: ERROR_NOT_FOUND,
        content: {
          "application/json": { schema: notFoundSchema },
        },
      },
    },
  }),
  (context) => {
    const record = getJobError(context.req.param("id"))
    if (!record) {
      return context.json({ error: ERROR_NOT_FOUND }, 404)
    }
    return context.json(record, 200)
  },
)

errorRoutes.openapi(
  createRoute({
    method: "post",
    path: "/errors/:id/redeliver",
    summary:
      "Manually re-queue an exhausted (or any) error for webhook delivery",
    description:
      "Resets attempts to 0 and flips state back to pending, then enqueues an immediate delivery attempt. Idempotent against already-delivered records: they will simply be re-attempted as pending.",
    tags: ["Errors"],
    parameters: [
      {
        description: "Error record ID",
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Record flipped back to pending",
        content: {
          "application/json": {
            schema: persistedJobErrorSchema,
          },
        },
      },
      404: {
        description: ERROR_NOT_FOUND,
        content: {
          "application/json": { schema: notFoundSchema },
        },
      },
    },
  }),
  async (context) => {
    const updated = await redeliverError(
      context.req.param("id"),
    )
    if (!updated) {
      return context.json({ error: ERROR_NOT_FOUND }, 404)
    }
    return context.json(updated, 200)
  },
)

errorRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/errors/:id",
    summary: "Dismiss / delete a persisted error record",
    tags: ["Errors"],
    parameters: [
      {
        description: "Error record ID",
        in: "path",
        name: "id",
        required: true,
        schema: { type: "string" },
      },
    ],
    responses: {
      204: { description: "Record deleted" },
      404: {
        description: ERROR_NOT_FOUND,
        content: {
          "application/json": { schema: notFoundSchema },
        },
      },
    },
  }),
  async (context) => {
    const id = context.req.param("id")
    const existing = getJobError(id)
    if (!existing) {
      return context.json({ error: ERROR_NOT_FOUND }, 404)
    }
    await deleteJobError(id)
    return context.body(null, 204)
  },
)
