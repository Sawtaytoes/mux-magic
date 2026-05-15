import { randomUUID } from "node:crypto"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import { createTemplateStore } from "../templateStore.js"
import {
  __setTemplateStoreForTests,
  templateRoutes,
} from "./templateRoutes.js"

const SAMPLE_YAML =
  "steps:\n  - id: a\n    command: ''\n    params: {}\n"

const baseUrl = "http://localhost"

const get = (path: string) =>
  templateRoutes.request(`${baseUrl}${path}`)

const postJson = (path: string, body: unknown) =>
  templateRoutes.request(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const putJson = (path: string, body: unknown) =>
  templateRoutes.request(`${baseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const del = (path: string) =>
  templateRoutes.request(`${baseUrl}${path}`, {
    method: "DELETE",
  })

beforeEach(() => {
  __setTemplateStoreForTests(
    createTemplateStore({
      filePath: `/templates-test/${randomUUID()}/templates.json`,
    }),
  )
})

afterEach(() => {
  __setTemplateStoreForTests(null)
})

describe("GET /api/templates", () => {
  test("returns an empty list initially", async () => {
    const response = await get("/api/templates")
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      templates: unknown[]
    }
    expect(body.templates).toEqual([])
  })
})

describe("POST /api/templates", () => {
  test("creates a template, returns 201 with full body + slug id", async () => {
    const response = await postJson("/api/templates", {
      name: "Movie Workflow",
      description: "First pass",
      yaml: SAMPLE_YAML,
    })
    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      id: string
      name: string
      description?: string
      yaml: string
      createdAt: string
      updatedAt: string
    }
    expect(body.id).toBe("movie-workflow")
    expect(body.name).toBe("Movie Workflow")
    expect(body.description).toBe("First pass")
    expect(body.yaml).toBe(SAMPLE_YAML)
    expect(body.createdAt).toBe(body.updatedAt)
  })

  test("collision: second POST with same name gets a -2 suffix", async () => {
    await postJson("/api/templates", {
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    const second = await postJson("/api/templates", {
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    expect(second.status).toBe(201)
    const body = (await second.json()) as { id: string }
    expect(body.id).toBe("movie-workflow-2")
  })

  test("rejects invalid YAML with 400 + error: invalid yaml + details", async () => {
    const response = await postJson("/api/templates", {
      name: "Bad",
      yaml: "just a scalar",
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
      details?: string
    }
    expect(body.error).toBe("invalid yaml")
    expect(typeof body.details).toBe("string")
    expect(body.details?.length ?? 0).toBeGreaterThan(0)
  })

  test("rejects empty name via zod validation (400)", async () => {
    const response = await postJson("/api/templates", {
      name: "",
      yaml: SAMPLE_YAML,
    })
    expect(response.status).toBe(400)
  })
})

describe("GET /api/templates/:id", () => {
  test("returns 404 for an unknown id", async () => {
    const response = await get("/api/templates/nope")
    expect(response.status).toBe(404)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toBe("not found")
  })

  test("returns the full template after create", async () => {
    await postJson("/api/templates", {
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    const response = await get(
      "/api/templates/movie-workflow",
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      id: string
      yaml: string
    }
    expect(body.id).toBe("movie-workflow")
    expect(body.yaml).toBe(SAMPLE_YAML)
  })
})

describe("PUT /api/templates/:id", () => {
  test("updates name + description + yaml; bumps updatedAt", async () => {
    const created = (await (
      await postJson("/api/templates", {
        name: "Movie Workflow",
        yaml: SAMPLE_YAML,
      })
    ).json()) as { id: string; updatedAt: string }
    await new Promise((resolve) => setTimeout(resolve, 5))
    const response = await putJson(
      `/api/templates/${created.id}`,
      {
        name: "Renamed",
        description: "now described",
        yaml: "steps: []\n",
      },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      id: string
      name: string
      description?: string
      yaml: string
      updatedAt: string
    }
    expect(body.id).toBe(created.id)
    expect(body.name).toBe("Renamed")
    expect(body.description).toBe("now described")
    expect(body.yaml).toBe("steps: []\n")
    expect(body.updatedAt).not.toBe(created.updatedAt)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await putJson("/api/templates/nope", {
      yaml: SAMPLE_YAML,
    })
    expect(response.status).toBe(404)
  })

  test("rejects invalid YAML with 400", async () => {
    await postJson("/api/templates", {
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    const response = await putJson(
      "/api/templates/movie-workflow",
      { yaml: "scalar" },
    )
    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: string
    }
    expect(body.error).toBe("invalid yaml")
  })
})

describe("DELETE /api/templates/:id", () => {
  test("returns 204 on success; second delete is 404", async () => {
    await postJson("/api/templates", {
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    const first = await del("/api/templates/movie-workflow")
    expect(first.status).toBe(204)
    const second = await del(
      "/api/templates/movie-workflow",
    )
    expect(second.status).toBe(404)
  })
})

describe("full round-trip", () => {
  test("POST → GET list → GET id → PUT → DELETE → GET id 404", async () => {
    const create = await postJson("/api/templates", {
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    expect(create.status).toBe(201)
    const { id } = (await create.json()) as { id: string }

    const list = (await (
      await get("/api/templates")
    ).json()) as { templates: { id: string }[] }
    expect(
      list.templates.map((template) => template.id),
    ).toContain(id)

    const fetched = await get(`/api/templates/${id}`)
    expect(fetched.status).toBe(200)

    const updated = await putJson(`/api/templates/${id}`, {
      yaml: "steps: []\n",
    })
    expect(updated.status).toBe(200)

    const deleted = await del(`/api/templates/${id}`)
    expect(deleted.status).toBe(204)

    const after = await get(`/api/templates/${id}`)
    expect(after.status).toBe(404)
  })
})
