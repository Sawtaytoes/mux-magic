import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { z } from "zod"

// Mirrors `serverIdRoutes.ts` — a tiny identity surface alongside
// /server-id/stream. Build identity (git SHA + build timestamp) is
// stamped into `public/api/version.json` by `scripts/build-version.cjs`
// at `prebuild`/`prestart`. The route reads that file at request time
// (rather than importing it once at module load) so a `yarn
// build-version` re-run during `tsx watch` development picks up the
// fresh values without restarting the server.
//
// In dev, if the prebuild hook never fired (e.g. `tsx src/api-server.ts`
// invoked directly outside `yarn`), the route degrades gracefully to
// `gitSha: "dev"` instead of erroring — the curl-able endpoint still
// answers, and the UI footer can still render *something*.

const versionFileSchema = z.object({
  gitSha: z.string(),
  gitShaShort: z.string(),
  buildTime: z.string().nullable(),
  packageVersion: z.string().nullable(),
  nodeVersion: z.string(),
  isContainerized: z
    .boolean()
    .describe(
      "True when running inside a Docker container (detected via /.dockerenv). Used by the UI to hide host-only affordances like 'Open in player' that depend on the OS shell-open mechanism, which doesn't work from within a container.",
    ),
})

type VersionPayload = z.infer<typeof versionFileSchema>

// Resolve once at module load so the read path is stable regardless of
// the cwd the server was launched from. `import.meta.url` here points at
// `src/api/routes/versionRoutes.ts` (or the tsx-loader equivalent); the
// json sits four levels up at `<repo>/public/api/version.json`.
const moduleDir = dirname(fileURLToPath(import.meta.url))
const versionFilePath = join(
  moduleDir,
  "..",
  "..",
  "..",
  "public",
  "api",
  "version.json",
)

const readPackageVersion = async (): Promise<
  string | null
> => {
  try {
    const pkg = JSON.parse(
      await readFile(
        join(moduleDir, "..", "..", "..", "package.json"),
        "utf8",
      ),
    ) as { version?: unknown }

    return typeof pkg.version === "string"
      ? pkg.version
      : null
  } catch {
    return null
  }
}

// Cached at module load — checking the filesystem once is fine
// since the Docker bind-mount (or its absence) doesn't change at
// runtime and we don't want every /version hit to stat the root.
const isContainerized = existsSync("/.dockerenv")

const buildDevFallback =
  async (): Promise<VersionPayload> => ({
    gitSha: "dev",
    gitShaShort: "dev",
    buildTime: null,
    packageVersion: await readPackageVersion(),
    nodeVersion: process.version,
    isContainerized,
  })

const readVersionPayload =
  async (): Promise<VersionPayload> => {
    try {
      const raw = await readFile(versionFilePath, "utf8")
      // Stamp `isContainerized` onto the parsed payload — older
      // version.json files written before the schema bump won't have
      // it, but the live runtime check is the source of truth anyway.
      const data = JSON.parse(raw) as Record<
        string,
        unknown
      >
      data.isContainerized = isContainerized
      const parsed = versionFileSchema.safeParse(data)

      if (!parsed.success) {
        return await buildDevFallback()
      }

      return parsed.data
    } catch {
      return await buildDevFallback()
    }
  }

export const versionRoutes = new OpenAPIHono()

versionRoutes.openapi(
  createRoute({
    method: "get",
    path: "/version",
    summary:
      "Build identity (git sha, build time, package + node version)",
    description:
      "Returns the build identity stamped into `public/api/version.json` by `scripts/build-version.cjs`. Mirrors Mux-Magic's existing `/server-id/stream` precedent — boot identity has its sibling here in build identity. Falls back to `{ gitSha: \"dev\" }` when the prebuild hook didn't run, so dev environments still answer.",
    tags: ["Server"],
    responses: {
      200: {
        description: "Build identity JSON.",
        content: {
          "application/json": {
            schema: versionFileSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const payload = await readVersionPayload()
    return context.json(payload, 200)
  },
)
