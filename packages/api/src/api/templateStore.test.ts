import { randomUUID } from "node:crypto"
import { existsSync, writeFileSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { describe, expect, test } from "vitest"

import {
  __testing,
  createTemplateStore,
  type TemplateStore,
} from "./templateStore.js"

const { slugifyName, findUniqueSlug } = __testing

const SAMPLE_YAML =
  "steps:\n  - id: a\n    command: ''\n    params: {}\n"

// memfs (via vitest.setup.ts) wipes the in-memory FS in its afterEach,
// so each call here produces an isolated tree. We return both the
// scratch dir and the store so individual tests can poke at the
// underlying file when they need to assert atomic-write side effects.
const setup = (): {
  scratchDir: string
  store: TemplateStore
} => {
  const scratchDir = `/mm-templates/${randomUUID()}`
  const store = createTemplateStore({
    filePath: join(scratchDir, "templates.json"),
  })
  return { scratchDir, store }
}

describe("slugifyName", () => {
  test("kebab-cases a simple name", () => {
    expect(slugifyName("Hello World")).toBe("hello-world")
  })

  test("strips punctuation and collapses dashes", () => {
    expect(slugifyName("Foo / Bar (Baz!)")).toBe(
      "foo-bar-baz",
    )
  })

  test("falls back to 'template' for empty input", () => {
    expect(slugifyName("")).toBe("template")
    expect(slugifyName("!!!")).toBe("template")
  })

  test("strips leading/trailing dashes", () => {
    expect(slugifyName("--hi--")).toBe("hi")
  })
})

describe("findUniqueSlug", () => {
  test("returns the base when unused", () => {
    expect(findUniqueSlug("hello", () => false)).toBe(
      "hello",
    )
  })

  test("appends -2 on first collision, -3 on second", () => {
    const taken = new Set(["hello"])
    expect(
      findUniqueSlug("hello", (id) => taken.has(id)),
    ).toBe("hello-2")
    taken.add("hello-2")
    expect(
      findUniqueSlug("hello", (id) => taken.has(id)),
    ).toBe("hello-3")
  })
})

describe("templateStore — missing file", () => {
  test("listTemplates returns [] when the file does not exist", async () => {
    const { store } = setup()
    const list = await store.listTemplates()
    expect(list).toEqual([])
  })

  test("getTemplate returns null when the file does not exist", async () => {
    const { store } = setup()
    const result = await store.getTemplate("anything")
    expect(result).toBeNull()
  })
})

describe("templateStore — CRUD round-trip", () => {
  test("create assigns slug id + ISO timestamps; updates list", async () => {
    const { store } = setup()
    const created = await store.createTemplate({
      name: "Movie Workflow",
      description: "First pass",
      yaml: SAMPLE_YAML,
    })

    expect(created.id).toBe("movie-workflow")
    expect(created.name).toBe("Movie Workflow")
    expect(created.description).toBe("First pass")
    expect(created.yaml).toBe(SAMPLE_YAML)
    expect(new Date(created.createdAt).toISOString()).toBe(
      created.createdAt,
    )
    expect(created.updatedAt).toBe(created.createdAt)

    const list = await store.listTemplates()
    expect(list).toEqual([
      {
        id: "movie-workflow",
        name: "Movie Workflow",
        description: "First pass",
        updatedAt: created.updatedAt,
      },
    ])
  })

  test("collision: second template with the same name gets -2 id", async () => {
    const { store } = setup()
    const first = await store.createTemplate({
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    const second = await store.createTemplate({
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    expect(first.id).toBe("movie-workflow")
    expect(second.id).toBe("movie-workflow-2")
  })

  test("update bumps updatedAt and rewrites yaml/name/description", async () => {
    const { store } = setup()
    const created = await store.createTemplate({
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const updated = await store.updateTemplate(created.id, {
      name: "Renamed",
      description: "now described",
      yaml: "steps: []\n",
    })
    expect(updated).not.toBeNull()
    expect(updated?.id).toBe("movie-workflow")
    expect(updated?.name).toBe("Renamed")
    expect(updated?.description).toBe("now described")
    expect(updated?.yaml).toBe("steps: []\n")
    expect(updated?.createdAt).toBe(created.createdAt)
    expect(updated?.updatedAt).not.toBe(created.updatedAt)
  })

  test("update of a missing id returns null", async () => {
    const { store } = setup()
    const updated = await store.updateTemplate("nope", {
      yaml: SAMPLE_YAML,
    })
    expect(updated).toBeNull()
  })

  test("delete removes the template; second delete returns false", async () => {
    const { store } = setup()
    const created = await store.createTemplate({
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    expect(await store.deleteTemplate(created.id)).toBe(
      true,
    )
    expect(await store.getTemplate(created.id)).toBeNull()
    expect(await store.deleteTemplate(created.id)).toBe(
      false,
    )
  })
})

describe("templateStore — atomic write + corruption tolerance", () => {
  test("no .tmp file left behind after a successful write", async () => {
    const { scratchDir, store } = setup()
    await store.createTemplate({
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })
    const entries = await readdir(scratchDir)
    expect(entries).toContain("templates.json")
    expect(
      entries.filter((entry) => entry.endsWith(".tmp")),
    ).toEqual([])
  })

  test("malformed JSON on disk is treated as empty list", async () => {
    const { scratchDir, store } = setup()
    const filePath = join(scratchDir, "templates.json")
    // memfs needs the parent dir to exist before a sync write.
    const fs = await import("node:fs")
    fs.mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, "this is not json")
    const list = await store.listTemplates()
    expect(list).toEqual([])
  })
})

describe("templateStore — concurrency", () => {
  test("two concurrent creates both land; ids do not collide", async () => {
    const { store } = setup()
    const [first, second] = await Promise.all([
      store.createTemplate({
        name: "Movie Workflow",
        yaml: SAMPLE_YAML,
      }),
      store.createTemplate({
        name: "Movie Workflow",
        yaml: SAMPLE_YAML,
      }),
    ])
    expect(first.id).not.toBe(second.id)
    const list = await store.listTemplates()
    expect(list).toHaveLength(2)
  })
})

describe("templateStore — persistence across instances", () => {
  test("a fresh store reads previously-written templates from the same file", async () => {
    const { scratchDir } = setup()
    const filePath = join(scratchDir, "templates.json")
    const writer = createTemplateStore({ filePath })
    await writer.createTemplate({
      name: "Movie Workflow",
      yaml: SAMPLE_YAML,
    })

    const reader = createTemplateStore({ filePath })
    const list = await reader.listTemplates()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe("movie-workflow")
  })

  test("write creates parent directory if missing", async () => {
    const { scratchDir } = setup()
    const nested = join(
      scratchDir,
      "deep",
      "nested",
      "templates.json",
    )
    const nestedStore = createTemplateStore({
      filePath: nested,
    })
    await nestedStore.createTemplate({
      name: "X",
      yaml: SAMPLE_YAML,
    })
    expect(existsSync(nested)).toBe(true)
    const raw = await readFile(nested, "utf8")
    expect(
      (JSON.parse(raw) as { version: number }).version,
    ).toBe(1)
  })
})
