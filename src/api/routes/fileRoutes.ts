import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { homedir } from "node:os"
import { extname } from "node:path"
import { Readable } from "node:stream"

import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { firstValueFrom, lastValueFrom } from "rxjs"

import { renameFileOrFolder } from "../../tools/createRenameFileOrFolder.js"
import {
  fakeDefaultPath,
  fakeDeleteMode,
  fakeListFiles,
  isFakeRequest,
} from "../../fake-data/index.js"
import {
  deleteFiles,
  getDeleteMode,
  getEffectiveDeleteMode,
} from "../../tools/deleteFiles.js"
import { getMediaInfo } from "../../tools/getMediaInfo.js"
import { isNetworkPath } from "../../tools/isNetworkPath.js"
import { listFilesWithMetadata } from "../../tools/listFilesWithMetadata.js"
import { openInExternalApp } from "../../tools/openInExternalApp.js"
import {
  PathSafetyError,
  validateReadablePath,
} from "../../tools/pathSafety.js"
import * as schemas from "../schemas.js"

export const fileRoutes = new OpenAPIHono()

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return String(error)
}

// Best-effort MIME for the in-browser <video> tag. Browsers don't all
// agree on .mkv (none stream it natively) but advertising the right MIME
// at least lets supportive browsers (Chrome with codec support) try.
const guessMimeType = (path: string): string => {
  const ext = extname(path).toLowerCase()
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4"
  if (ext === ".webm") return "video/webm"
  if (ext === ".mkv") return "video/x-matroska"
  if (ext === ".avi") return "video/x-msvideo"
  if (ext === ".mov") return "video/quicktime"
  return "application/octet-stream"
}

fileRoutes.openapi(
  createRoute({
    method: "get",
    path: "/files/default-path",
    summary: "Suggested starting path when the explorer opens with no input",
    description: "The Builder's Browse triggers fall back to this when the field they're attached to is empty. Returns the OS user's home directory (`os.homedir()`) — a safe, always-existing root the user can navigate from. Could later be extended to remember the last-used path per session.",
    tags: ["File Operations"],
    responses: {
      200: {
        description: "Suggested default starting path",
        content: {
          "application/json": { schema: schemas.defaultPathResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeDefaultPath(), 200)
    }
    return context.json({ path: homedir() }, 200)
  },
)

fileRoutes.openapi(
  createRoute({
    method: "get",
    path: "/files/list",
    summary: "List files in a directory with metadata",
    description: "Used by the file-explorer modal in the Builder UI. Returns one entry per direct child of `path`, with isFile/isDirectory + size + mtime. Path must be absolute and traversal-free; this is a read-only operation, so it is NOT gated by ALLOWED_DELETE_ROOTS.",
    tags: ["File Operations"],
    request: {
      query: schemas.listFilesRequestSchema,
    },
    responses: {
      200: {
        description: "Directory listing or error message",
        content: {
          "application/json": { schema: schemas.listFilesResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeListFiles(), 200)
    }
    const { path, includeDuration } = context.req.valid("query")
    const wantsDuration = (
      includeDuration === "1"
      || includeDuration === "true"
    )
    try {
      const result = await listFilesWithMetadata(path, { includeDuration: wantsDuration })
      return context.json({ ...result, error: null }, 200)
    }
    catch (error) {
      return context.json(
        { entries: [], separator: "/", error: messageFromError(error) },
        200,
      )
    }
  },
)

fileRoutes.openapi(
  createRoute({
    method: "get",
    path: "/files/delete-mode",
    summary: "Report whether deletes go to the OS trash or are permanent",
    description: "Called by the file-explorer modal so the confirm dialog can label its action accurately. The base mode is controlled by the DELETE_TO_TRASH env var (default 'trash'). When `path` is supplied AND the path lives on a Windows network drive, the response downgrades to 'permanent' since the OS Recycle Bin can't service network shares — the UI surfaces this via the badge so the user isn't surprised when 'trash' silently became permanent.",
    tags: ["File Operations"],
    request: {
      query: schemas.deleteModeRequestSchema,
    },
    responses: {
      200: {
        description: "Active delete mode for the queried path (or the global setting when no path supplied)",
        content: {
          "application/json": { schema: schemas.deleteModeResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    if (isFakeRequest(context)) {
      return context.json(fakeDeleteMode(), 200)
    }
    const { path } = context.req.valid("query")
    const baseMode = getDeleteMode()
    if (!path) {
      return context.json({ mode: baseMode, reason: null }, 200)
    }
    const effectiveMode = getEffectiveDeleteMode(path)
    let reason: string | null = null
    if (baseMode === "permanent") {
      reason = "DELETE_TO_TRASH is set to false"
    }
    else if (effectiveMode === "permanent" && isNetworkPath(path)) {
      reason = "Path is on a network drive — Windows Recycle Bin can't service network shares, so deletes will be permanent."
    }
    return context.json({ mode: effectiveMode, reason }, 200)
  },
)

fileRoutes.openapi(
  createRoute({
    method: "get",
    path: "/files/audio-codec",
    summary: "Report the audio codec/format of a file's first audio track",
    description: "Used by the file-explorer modal's <video> sub-modal to decide whether to point at /files/stream (browser can decode) or /transcode/audio (browser can't decode the source audio — DTS, TrueHD, AC-3 outside Edge, etc.). Returns the raw mediainfo `Format` value of the first audio track; the caller maps that to a MediaSource.isTypeSupported() probe and picks the URL. Validates path via `validateReadablePath` (absolute, no traversal). Returns audioFormat=null on no-audio-track or mediainfo failure rather than 5xx-ing.",
    tags: ["File Operations"],
    request: {
      query: schemas.audioCodecRequestSchema,
    },
    responses: {
      200: {
        description: "First audio track's raw mediainfo Format, or null when unavailable",
        content: {
          "application/json": { schema: schemas.audioCodecResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const { path } = context.req.valid("query")
    let validated: string
    try {
      validated = validateReadablePath(path)
    }
    catch (error) {
      if (error instanceof PathSafetyError) {
        return context.json({ audioFormat: null, error: error.message }, 200)
      }
      return context.json({ audioFormat: null, error: messageFromError(error) }, 200)
    }
    try {
      const mediaInfo = await firstValueFrom(getMediaInfo(validated))
      const tracks = mediaInfo.media?.track ?? []
      const firstAudio = tracks.find((track) => track["@type"] === "Audio")
      if (!firstAudio) {
        return context.json({ audioFormat: null, error: null }, 200)
      }
      const format = (
        "Format" in firstAudio
        && typeof firstAudio.Format === "string"
        && firstAudio.Format.length > 0
      )
        ? firstAudio.Format
        : null
      return context.json({ audioFormat: format, error: null }, 200)
    }
    catch (error) {
      return context.json({ audioFormat: null, error: messageFromError(error) }, 200)
    }
  },
)

fileRoutes.openapi(
  createRoute({
    method: "post",
    path: "/files/open-external",
    summary: "Hand a file off to the OS shell to open in the default app",
    description: "Used by the file-explorer modal as a fallback when a video's codecs (DTS / TrueHD / HEVC without hardware decode) can't be decoded in-browser. Calls the platform's shell-open mechanism: `cmd /C start` on Windows, `open` on macOS, `xdg-open` on Linux. The launcher process is detached + unref'd so the API request returns immediately.",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.openExternalRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Launcher spawned (or validation/spawn error)",
        content: {
          "application/json": { schema: schemas.openExternalResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const { path } = context.req.valid("json")
    try {
      openInExternalApp(path)
      return context.json({ ok: true, error: null }, 200)
    }
    catch (error) {
      return context.json({ ok: false, error: messageFromError(error) }, 200)
    }
  },
)

fileRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/files",
    summary: "Delete one or more files",
    description: "Bulk delete used by the file-explorer modal. Each path is validated against ALLOWED_DELETE_ROOTS independently; a failure on one path does NOT abort the batch — the response carries per-path success/failure. Strategy (Recycle Bin vs permanent) is set globally via DELETE_TO_TRASH and reported through GET /files/delete-mode.",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.deleteFilesRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Per-path delete results",
        content: {
          "application/json": { schema: schemas.deleteFilesResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const { paths } = context.req.valid("json")
    const result = await deleteFiles(paths)
    return context.json(result, 200)
  },
)

fileRoutes.openapi(
  createRoute({
    method: "post",
    path: "/files/rename",
    summary: "Rename a single file in place",
    description: "Used by the nameSpecialFeatures result card so the user can fix unrenamed entries one row at a time. Both `oldPath` and `newPath` are validated for absolute / no-traversal safety. The underlying helper aborts when `newPath` already exists, so the API can't silently overwrite an existing file.",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.renameFileRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Rename outcome — `ok: true` plus the validated new path on success, `ok: false` plus a message on failure.",
        content: {
          "application/json": { schema: schemas.renameFileResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const { oldPath, newPath } = context.req.valid("json")
    const validation = (() => {
      try {
        return {
          ok: true as const,
          oldPath: validateReadablePath(oldPath),
          newPath: validateReadablePath(newPath),
        }
      }
      catch (error) {
        if (error instanceof PathSafetyError) {
          return { ok: false as const, error: error.message }
        }
        return { ok: false as const, error: messageFromError(error) }
      }
    })()
    if (!validation.ok) {
      return context.json({ ok: false, newPath: null, error: validation.error }, 200)
    }
    try {
      await lastValueFrom(
        renameFileOrFolder({
          newPath: validation.newPath,
          oldPath: validation.oldPath,
        }),
      )
      return context.json({ ok: true, newPath: validation.newPath, error: null }, 200)
    }
    catch (error) {
      return context.json(
        { ok: false, newPath: null, error: messageFromError(error) },
        200,
      )
    }
  },
)

// HTTP Range streaming for the in-browser <video> tag. Hono routes that
// stream binary aren't OpenAPI-friendly (the response is bytes, not
// JSON) so this one is registered via `.get()` instead of `.openapi()`.
// The OpenAPI doc page would mis-describe it as JSON anyway.
fileRoutes.get("/files/stream", async (context) => {
  const path = context.req.query("path")
  if (!path) {
    return context.json({ error: "path query parameter is required" }, 400)
  }
  let validated: string
  try {
    validated = validateReadablePath(path)
  }
  catch (error) {
    if (error instanceof PathSafetyError) {
      return context.json({ error: error.message }, 400)
    }
    return context.json({ error: messageFromError(error) }, 400)
  }

  let stats
  try {
    stats = await stat(validated)
  }
  catch {
    return context.json({ error: `File not found: ${path}` }, 404)
  }
  if (!stats.isFile()) {
    return context.json({ error: `Not a file: ${path}` }, 400)
  }

  const totalSize = stats.size
  const mimeType = guessMimeType(validated)
  const rangeHeader = context.req.header("range")

  // No Range header → send the whole file with 200 OK. Browsers' <video>
  // tags use Range for scrubbing once they know the duration; the first
  // request typically has no Range and reads enough bytes to parse the
  // container.
  if (!rangeHeader) {
    const stream = Readable.toWeb(createReadStream(validated)) as ReadableStream
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
      },
    })
  }

  // Parse `bytes=START-END` (END is optional and defaults to last byte).
  // Multiple ranges (`bytes=0-100,200-300`) aren't supported — browsers
  // never send those for video scrubbing in practice, and the multipart
  // response would be a much bigger lift.
  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/)
  if (!match) {
    return context.json({ error: `Unsupported Range header: ${rangeHeader}` }, 416)
  }
  const start = Number(match[1])
  const end = match[2] === "" ? totalSize - 1 : Number(match[2])
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= totalSize) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${totalSize}`,
      },
    })
  }
  const stream = Readable.toWeb(
    createReadStream(validated, { start, end }),
  ) as ReadableStream
  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Accept-Ranges": "bytes",
    },
  })
})
