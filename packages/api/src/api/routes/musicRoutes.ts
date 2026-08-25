import { mkdir, rename } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"

import {
  createRoute,
  OpenAPIHono,
  z,
} from "@hono/zod-openapi"
import { getChangedTagFields } from "@mux-magic/core/src/app-commands/writeAudioTags.js"
import type { AudioTags } from "@mux-magic/core/src/music/tags/audioTagFields.js"
import { readAudioTags } from "@mux-magic/core/src/music/tags/readAudioTags.js"
import { writeAudioTags } from "@mux-magic/core/src/music/tags/writeAudioTags.js"
import { submitAcoustIdFingerprints } from "@mux-magic/core/src/tools/acoustIdSubmit.js"
import { buildSeededReleaseForm } from "@mux-magic/core/src/tools/musicBrainzSubmit.js"
import {
  PathSafetyError,
  validateReadablePath,
} from "@mux-magic/core/src/tools/pathSafety.js"
import { firstValueFrom } from "rxjs"

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

// The copy's path below the scanned root, recreated under the holding
// folder. Flattening instead would make `Disc 1/01 Intro.flac` and
// `Disc 2/01 Intro.flac` collide, and the second move would land on the
// first one.
//
// A file outside the scanned root keeps only its name — `relative` would
// otherwise produce a `../..` chain that climbs back out of the holding
// folder, which is the traversal this whole surface refuses.
export const buildHoldingDestination = ({
  filePath,
  holdingFolderPath,
  sourceRootPath,
}: {
  filePath: string
  holdingFolderPath: string
  sourceRootPath: string
}) =>
  ((relativePath: string) =>
    resolve(
      join(
        holdingFolderPath,
        relativePath.startsWith("..")
          ? (filePath.split(/[\\/]/u).at(-1) ?? "")
          : relativePath,
      ),
    ))(relative(sourceRootPath, filePath))

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

// The duplicate compare table's confirm action.
//
// ⚠️ It MOVES and never deletes, and that is the whole design. The music
// library lives on a share with no Recycle Bin: a delete there is
// effectively permanent inside the hour, and the only safety net is the
// hourly ZFS snapshot. Moving the losing copy into a holding folder makes
// the decision reversible by dragging a file back, which is what "nothing
// deletes without a confirmed row" is actually protecting.
//
// A plain route rather than a command, for the same reason `POST
// /music/tags` is: the user has already reviewed the group, each row
// commits one file, and a row that fails must fail alone and say why on
// that row.
musicRoutes.openapi(
  createRoute({
    method: "post",
    path: "/music/duplicates/resolve",
    summary:
      "Move one redundant duplicate copy to a holding folder",
    description:
      "One confirmed row of the duplicate compare table, one request. The copy is MOVED, never deleted — the library share has no Recycle Bin, so a move into a holding folder is what makes the decision reversible. The copy's path below `sourceRootPath` is recreated under `holdingFolderPath`, so two same-named tracks from different albums cannot collide.",
    tags: ["Music Tagging"],
    request: {
      body: {
        content: {
          "application/json": {
            schema:
              schemas.musicDuplicateResolveRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description:
          "Move result for the copy, successful or not",
        content: {
          "application/json": {
            schema:
              schemas.musicDuplicateResolveResponseSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    try {
      const filePath = validateReadablePath(body.filePath)
      const destination = buildHoldingDestination({
        filePath,
        holdingFolderPath: validateReadablePath(
          body.holdingFolderPath,
        ),
        sourceRootPath: validateReadablePath(
          body.sourceRootPath,
        ),
      })

      if (!body.isDryRun) {
        await mkdir(dirname(destination), {
          recursive: true,
        })
        // Refused rather than overwritten. A collision here means the
        // holding folder already holds a different file at that path,
        // and silently replacing it would destroy the one thing this
        // route exists to preserve.
        await rename(filePath, destination)
      }

      return context.json(
        { destination, error: null, isOk: true },
        200,
      )
    } catch (error) {
      return context.json(
        {
          destination: null,
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

// ── Phase 9: writing back ───────────────────────────────────────────
//
// ⚠️ Nothing here runs by itself. These are public database entries made
// under the owner's account: a wrong one is visible to everybody and has
// to be undone by hand. So each is a route the user triggers from a
// review surface, never a step a sequence can schedule.
//
// AcoustID first, because it is the simplest and the most useful — it
// improves the database the tagger reads FROM, and every correctly
// matched file is a free contribution.
musicRoutes.openapi(
  createRoute({
    method: "post",
    path: "/music/acoustid/submit",
    summary: "Submit reviewed fingerprints to AcoustID",
    description:
      "Sends a batch of fingerprint-to-recording links to AcoustID under the owner's account. Explicit and reviewed only — this route is never called by a sequence step. The two AcoustID keys are not interchangeable: ACOUSTID_API_KEY is the application key sent as `client`, and ACOUSTID_USER_API_KEY is the account key sent as `user`, which is what authorises the submission.",
    tags: ["Music Tagging"],
    request: {
      body: {
        content: {
          "application/json": {
            schema:
              schemas.musicAcoustIdSubmitRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Submission result, successful or not",
        content: {
          "application/json": {
            schema:
              schemas.musicAcoustIdSubmitResponseSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    try {
      // A dry run must not reach the network at all. AcoustID queues a
      // submission the moment it accepts one, so there is no "preview"
      // request that leaves the database untouched.
      const submissions = body.isDryRun
        ? []
        : await firstValueFrom(
            submitAcoustIdFingerprints({
              submissions: body.submissions,
            }),
          )
      return context.json(
        { error: null, isOk: true, submissions },
        200,
      )
    } catch (error) {
      return context.json(
        {
          error: messageFromError(error),
          isOk: false,
          submissions: [],
        },
        200,
      )
    }
  },
)

// The half that is not an API. The MusicBrainz web service CANNOT create
// a release, a recording or an artist — it only submits tags, ratings,
// barcodes, ISRCs and collection membership to entities that already
// exist. A missing album therefore goes through the web release editor,
// seeded by a self-submitting form the owner opens while logged in.
//
// ⚠️ A seed in the query string is ignored; the editor opens empty. It
// reads its seed from a form POST body, which is why this returns HTML
// rather than a URL.
musicRoutes.openapi(
  createRoute({
    method: "post",
    path: "/music/musicbrainz/seed-release",
    summary:
      "Build a seeded MusicBrainz release-editor form",
    description:
      'Returns a self-submitting HTML form that opens the MusicBrainz release editor pre-filled with this album. Opening the editor saves nothing — the owner steps through the tabs and clicks the green "Enter edit" to create the release. This exists because the web service cannot create a release at all.',
    tags: ["Music Tagging"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.musicSeedReleaseRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description:
          "The self-submitting release-editor form",
        content: { "text/html": { schema: z.string() } },
      },
    },
  }),
  (context) =>
    context.html(
      buildSeededReleaseForm(context.req.valid("json")),
    ),
)
