import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { getChangedTagFields } from "@mux-magic/core/src/app-commands/writeAudioTags.js"
import type { AudioTags } from "@mux-magic/core/src/music/tags/audioTagFields.js"
import { readAudioTags } from "@mux-magic/core/src/music/tags/readAudioTags.js"
import { writeAudioTags } from "@mux-magic/core/src/music/tags/writeAudioTags.js"
import {
  PathSafetyError,
  validateReadablePath,
} from "@mux-magic/core/src/tools/pathSafety.js"

import * as schemas from "../schemas.js"

// The reviewed, per-file tag write behind the tag table's Apply button.
//
// It is a plain route and NOT a command on purpose. Apply is not a job:
// the user has already reviewed the diff in the modal, each row commits
// its own tag set, and a row that fails must fail alone and say why on
// that row. Wrapping it in the job runner would give one job id for
// forty independent writes and one failure would read as forty.
//
// The bulk equivalent — one tag set over a whole folder — IS a command:
// `writeAudioTags`, in `commandRoutes.ts`.

export const musicRoutes = new OpenAPIHono()

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

// Only the fields the caller sent are written. An absent key means "leave
// what is there"; the modal drops empty rows before it posts, so a field
// the user cleared arrives as an empty string and reads as a removal.
const toAudioTags = (
  tags: Record<string, unknown>,
): AudioTags =>
  Object.fromEntries(
    Object.entries(tags).filter(
      ([, value]) => value !== undefined,
    ),
  ) as AudioTags

musicRoutes.openapi(
  createRoute({
    method: "post",
    path: "/music/tags",
    summary:
      "Write the reviewed tag set for one audio file",
    description:
      "One row of the tag review table, one request. The table's Apply button posts these sequentially so a per-row failure stays a per-row failure and lands on that row. Only the fields present in `tags` are compared and written — an absent field leaves whatever the file already has. Returns the fields that changed, which is empty when the file already carried these values.",
    tags: ["Music Tagging"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.musicTagWriteRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description:
          "Write result for the file, successful or not",
        content: {
          "application/json": {
            schema: schemas.musicTagWriteResponseSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    try {
      const filePath = validateReadablePath(body.filePath)
      const tags = toAudioTags(body.tags)
      const { tags: currentTags } =
        await readAudioTags(filePath)
      const changedFields = getChangedTagFields({
        currentTags,
        tags,
      })
      // A file already carrying these values is not rewritten. Re-opening
      // the table and pressing Apply again must not touch the file, and
      // must not report a change that did not happen.
      if (changedFields.length > 0 && !body.isDryRun) {
        await writeAudioTags({
          filePath,
          isTimestampPreserved: body.isTimestampPreserved,
          tags,
        })
      }
      return context.json(
        { changedFields, error: null, isOk: true },
        200,
      )
    } catch (error) {
      // 200 with `isOk: false`, not a 4xx. The modal renders one row per
      // request and needs the reason as data; a thrown status would give
      // it "HTTP 400" and nothing about which field or why.
      return context.json(
        {
          changedFields: [],
          error:
            error instanceof PathSafetyError
              ? error.message
              : messageFromError(error),
          isOk: false,
        },
        200,
      )
    }
  },
)
