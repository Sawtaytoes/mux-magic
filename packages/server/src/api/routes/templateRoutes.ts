import { join } from "node:path"

import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"

import { APP_DATA_DIR } from "../../tools/appPaths.js"
import {
  createTemplateStore,
  type TemplateStore,
} from "../templateStore.js"
import { validateTemplateYaml } from "../templateYamlValidator.js"

// ─── Singleton wiring ────────────────────────────────────────────────────────
//
// Production templateStore is a lazy-initialized singleton pointing at
// `${APP_DATA_DIR}/templates.json`. Tests inject their own store via
// `__setTemplateStoreForTests` so they can use a memfs-backed file
// without disturbing the real per-user APP_DATA_DIR.
//
// The holder is a single-key object whose `current` field we mutate —
// preserves the "no `let` reassignment" rule while keeping the
// canonical lazy-singleton pattern.

const storeHolder: { current: TemplateStore | null } = {
  current: null,
}

const getStore = (): TemplateStore => {
  if (storeHolder.current === null) {
    storeHolder.current = createTemplateStore({
      filePath: join(APP_DATA_DIR, "templates.json"),
    })
  }
  return storeHolder.current
}

export const __setTemplateStoreForTests = (
  store: TemplateStore | null,
): void => {
  storeHolder.current = store
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const templateListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  updatedAt: z.string(),
})

const fullTemplateSchema = templateListItemSchema.extend({
  yaml: z.string(),
  createdAt: z.string(),
})

const createTemplateRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  yaml: z.string(),
})

const updateTemplateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  yaml: z.string(),
})

const errorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
})

const idParamSchema = z.object({
  id: z.string().min(1),
})

// ─── Router ──────────────────────────────────────────────────────────────────

export const templateRoutes = new OpenAPIHono()

templateRoutes.openapi(
  createRoute({
    method: "get",
    path: "/api/templates",
    summary: "List saved sequence templates",
    description:
      "Returns the per-user library of saved sequence templates. Each entry includes only metadata; fetch the full body (including YAML) via GET /api/templates/:id.",
    tags: ["Templates"],
    responses: {
      200: {
        description: "List of saved templates.",
        content: {
          "application/json": {
            schema: z.object({
              templates: z.array(templateListItemSchema),
            }),
          },
        },
      },
    },
  }),
  async (context) => {
    const templates = await getStore().listTemplates()
    return context.json({ templates }, 200)
  },
)

templateRoutes.openapi(
  createRoute({
    method: "get",
    path: "/api/templates/{id}",
    summary: "Fetch a single saved template by id",
    tags: ["Templates"],
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: "Full template body.",
        content: {
          "application/json": {
            schema: fullTemplateSchema,
          },
        },
      },
      404: {
        description: "No template with that id.",
        content: {
          "application/json": {
            schema: errorSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const { id } = context.req.valid("param")
    const template = await getStore().getTemplate(id)
    if (template === null) {
      return context.json({ error: "not found" }, 404)
    }
    return context.json(template, 200)
  },
)

templateRoutes.openapi(
  createRoute({
    method: "post",
    path: "/api/templates",
    summary: "Save a new sequence template",
    description:
      "Server assigns the id (kebab-case of name with a -2/-3/... collision suffix). YAML is validated for structural shape before persistence; semantic command-name validation happens on the web side at apply time.",
    tags: ["Templates"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createTemplateRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description:
          "Created template, with server-assigned id.",
        content: {
          "application/json": {
            schema: fullTemplateSchema,
          },
        },
      },
      400: {
        description: "Invalid YAML body.",
        content: {
          "application/json": {
            schema: errorSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    const validation = validateTemplateYaml(body.yaml)
    if (!validation.isValid) {
      return context.json(
        {
          error: validation.error,
          details: validation.details,
        },
        400,
      )
    }
    const created = await getStore().createTemplate(body)
    return context.json(created, 201)
  },
)

templateRoutes.openapi(
  createRoute({
    method: "put",
    path: "/api/templates/{id}",
    summary: "Update a saved template",
    description:
      "Bumps updatedAt; createdAt + id are preserved. YAML body is required and re-validated.",
    tags: ["Templates"],
    request: {
      params: idParamSchema,
      body: {
        content: {
          "application/json": {
            schema: updateTemplateRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated template.",
        content: {
          "application/json": {
            schema: fullTemplateSchema,
          },
        },
      },
      400: {
        description: "Invalid YAML body.",
        content: {
          "application/json": {
            schema: errorSchema,
          },
        },
      },
      404: {
        description: "No template with that id.",
        content: {
          "application/json": {
            schema: errorSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const { id } = context.req.valid("param")
    const body = context.req.valid("json")
    const validation = validateTemplateYaml(body.yaml)
    if (!validation.isValid) {
      return context.json(
        {
          error: validation.error,
          details: validation.details,
        },
        400,
      )
    }
    const updated = await getStore().updateTemplate(
      id,
      body,
    )
    if (updated === null) {
      return context.json({ error: "not found" }, 404)
    }
    return context.json(updated, 200)
  },
)

templateRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/api/templates/{id}",
    summary: "Delete a saved template",
    tags: ["Templates"],
    request: {
      params: idParamSchema,
    },
    responses: {
      204: {
        description: "Deleted.",
      },
      404: {
        description: "No template with that id.",
        content: {
          "application/json": {
            schema: errorSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const { id } = context.req.valid("param")
    const isDeleted = await getStore().deleteTemplate(id)
    if (!isDeleted) {
      return context.json({ error: "not found" }, 404)
    }
    return context.body(null, 204)
  },
)
