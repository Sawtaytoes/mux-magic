import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises"
import { dirname } from "node:path"

// File-backed CRUD for saved sequence templates. The flat JSON file at
// `templateStore.filePath` is the source of truth; everything is read
// from disk per operation (the file is small — flat list of templates,
// each carrying short YAML text — so a 50-template store is still well
// under 1 MB). No in-memory cache, no invalidation, no sqlite.
//
// Multi-process is out of scope: the per-instance write serializer
// prevents intra-process write interleaving, but a second server pointed
// at the same APP_DATA_DIR would race. APP_DATA_DIR is overridable via
// env so e2e workers can each point at their own tmpdir.

export type StoredTemplate = {
  id: string
  name: string
  description?: string
  yaml: string
  createdAt: string
  updatedAt: string
}

export type TemplateListItem = {
  id: string
  name: string
  description?: string
  updatedAt: string
}

export type TemplatesFile = {
  version: 1
  templates: StoredTemplate[]
}

export type TemplateStore = {
  listTemplates: () => Promise<TemplateListItem[]>
  getTemplate: (
    id: string,
  ) => Promise<StoredTemplate | null>
  createTemplate: (input: {
    name: string
    description?: string
    yaml: string
  }) => Promise<StoredTemplate>
  updateTemplate: (
    id: string,
    changes: {
      name?: string
      description?: string
      yaml?: string
    },
  ) => Promise<StoredTemplate | null>
  deleteTemplate: (id: string) => Promise<boolean>
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

// Combining-diacritic block U+0300..U+036F; built via RegExp constructor
// so the file stays ASCII-safe on Windows toolchains that misread direct
// non-BMP literals.
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g

const slugifyName = (name: string): string => {
  const stripped = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return stripped.length > 0 ? stripped : "template"
}

const findUniqueSlug = (
  base: string,
  isTaken: (candidate: string) => boolean,
  attempt = 1,
): string => {
  const candidate =
    attempt === 1 ? base : `${base}-${attempt}`
  return isTaken(candidate)
    ? findUniqueSlug(base, isTaken, attempt + 1)
    : candidate
}

// ─── Write serializer (per-instance) ─────────────────────────────────────────

// Holds the tail of the in-flight write chain. Mutating `tail` on the
// captured object — rather than reassigning a `let` — keeps us inside the
// repo's "no `let` reassignment" rule while preserving the canonical
// Promise-chain mutex pattern.
const createWriteSerializer = () => {
  const state: { tail: Promise<void> } = {
    tail: Promise.resolve(),
  }
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const next = state.tail.then(operation, operation)
    state.tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

// ─── Disk IO ─────────────────────────────────────────────────────────────────

const readTemplatesFile = async (
  filePath: string,
): Promise<TemplatesFile> => {
  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw) as Partial<TemplatesFile>
    if (
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.templates)
    ) {
      return { version: 1, templates: parsed.templates }
    }
    // Schema drift / wrong shape — treat as empty so the next write
    // overwrites with a valid file. Logging is intentionally absent
    // here; the caller controls how loudly to react.
    return { version: 1, templates: [] }
  } catch (error) {
    const isMissingFile =
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissingFile) return { version: 1, templates: [] }
    // Malformed JSON or transient read failure — degrade to empty.
    // Round-trip writes will overwrite the corrupt content.
    return { version: 1, templates: [] }
  }
}

// Write-then-rename for atomic replacement. The temp file uses a fixed
// `.tmp` suffix on the target path so a crashed process leaves at most
// one detritus file — easy to spot, easy to clean up. We don't bother
// with cross-volume rename handling because APP_DATA_DIR and its temp
// sibling are always on the same filesystem by construction.
const writeTemplatesFile = async (
  filePath: string,
  data: TemplatesFile,
): Promise<void> => {
  const parentDir = dirname(filePath)
  await mkdir(parentDir, { recursive: true })
  const tempPath = `${filePath}.tmp`
  const serialized = JSON.stringify(data, null, 2)
  await writeFile(tempPath, serialized, "utf8")
  await rename(tempPath, filePath)
}

// ─── Public factory ──────────────────────────────────────────────────────────

export const createTemplateStore = ({
  filePath,
}: {
  filePath: string
}): TemplateStore => {
  const serializeWrite = createWriteSerializer()

  const toListItem = (
    template: StoredTemplate,
  ): TemplateListItem => ({
    id: template.id,
    name: template.name,
    ...(template.description !== undefined
      ? { description: template.description }
      : {}),
    updatedAt: template.updatedAt,
  })

  const listTemplates = async (): Promise<
    TemplateListItem[]
  > => {
    const file = await readTemplatesFile(filePath)
    return file.templates.map(toListItem)
  }

  const getTemplate = async (
    id: string,
  ): Promise<StoredTemplate | null> => {
    const file = await readTemplatesFile(filePath)
    return (
      file.templates.find((tpl) => tpl.id === id) ?? null
    )
  }

  const createTemplate = async (input: {
    name: string
    description?: string
    yaml: string
  }): Promise<StoredTemplate> =>
    serializeWrite(async () => {
      const file = await readTemplatesFile(filePath)
      const existingIds = new Set(
        file.templates.map((tpl) => tpl.id),
      )
      const id = findUniqueSlug(
        slugifyName(input.name),
        (candidate) => existingIds.has(candidate),
      )
      const now = new Date().toISOString()
      const created: StoredTemplate = {
        id,
        name: input.name,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        yaml: input.yaml,
        createdAt: now,
        updatedAt: now,
      }
      const next: TemplatesFile = {
        version: 1,
        templates: file.templates.concat(created),
      }
      await writeTemplatesFile(filePath, next)
      return created
    })

  const updateTemplate = async (
    id: string,
    changes: {
      name?: string
      description?: string
      yaml?: string
    },
  ): Promise<StoredTemplate | null> =>
    serializeWrite(async () => {
      const file = await readTemplatesFile(filePath)
      const existing = file.templates.find(
        (tpl) => tpl.id === id,
      )
      if (!existing) return null
      const merged: StoredTemplate = {
        ...existing,
        ...(changes.name !== undefined
          ? { name: changes.name }
          : {}),
        ...(changes.description !== undefined
          ? { description: changes.description }
          : {}),
        ...(changes.yaml !== undefined
          ? { yaml: changes.yaml }
          : {}),
        updatedAt: new Date().toISOString(),
      }
      const next: TemplatesFile = {
        version: 1,
        templates: file.templates.map((tpl) =>
          tpl.id === id ? merged : tpl,
        ),
      }
      await writeTemplatesFile(filePath, next)
      return merged
    })

  const deleteTemplate = async (
    id: string,
  ): Promise<boolean> =>
    serializeWrite(async () => {
      const file = await readTemplatesFile(filePath)
      const hasMatch = file.templates.some(
        (tpl) => tpl.id === id,
      )
      if (!hasMatch) return false
      const next: TemplatesFile = {
        version: 1,
        templates: file.templates.filter(
          (tpl) => tpl.id !== id,
        ),
      }
      await writeTemplatesFile(filePath, next)
      return true
    })

  return {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  }
}

// Test-only exports for the pure helpers. Kept in a single namespace
// so production callers see one surface; tests reach into __testing.
export const __testing = {
  slugifyName,
  findUniqueSlug,
}
