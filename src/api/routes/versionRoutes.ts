import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
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

const readPackageVersion = async (): Promise<string | null> => {
  try {
    const pkg = JSON.parse(
      await readFile(
        join(moduleDir, "..", "..", "..", "package.json"),
        "utf8",
      ),
    ) as { version?: unknown }

    return (
      typeof pkg.version === "string"
      ? pkg.version
      : null
    )
  }
  catch {
    return null
  }
}

const buildDevFallback = async (): Promise<VersionPayload> => ({
  gitSha: "dev",
  gitShaShort: "dev",
  buildTime: null,
  packageVersion: await readPackageVersion(),
  nodeVersion: process.version,
})

const readVersionPayload = async (): Promise<VersionPayload> => {
  try {
    const raw = await readFile(versionFilePath, "utf8")
    const parsed = versionFileSchema.safeParse(JSON.parse(raw))

    if (!parsed.success) {
      return await buildDevFallback()
    }

    return parsed.data
  }
  catch {
    return await buildDevFallback()
  }
}

export const versionRoutes = new OpenAPIHono()

versionRoutes.openapi(
  createRoute({
    method: "get",
    path: "/version",
    summary: "Build identity (git sha, build time, package + node version)",
    description: "Returns the build identity stamped into `public/api/version.json` by `scripts/build-version.cjs`. Mirrors media-tools' existing `/server-id/stream` precedent — boot identity has its sibling here in build identity. Falls back to `{ gitSha: \"dev\" }` when the prebuild hook didn't run, so dev environments still answer.",
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
