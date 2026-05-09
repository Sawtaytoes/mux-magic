import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { z } from "zod"

// Feature flags sourced from environment variables at request time so that
// a running `tsx watch` server picks up `.env` changes after a restart
// without requiring a code change.

const featuresSchema = z.object({
  experimentalFfmpegTranscoding: z.boolean().describe(
    "When true, the video player uses the MSE + ffmpeg transcode path for "
    + "browser-incompatible audio (TrueHD, DTS, etc.). "
    + "Enabled by setting EXPERIMENTAL_FFMPEG_TRANSCODING=true in .env. "
    + "Disabled by default while seek / InvalidStateError bugs are being resolved.",
  ),
})

export const featuresRoutes = new OpenAPIHono()

featuresRoutes.openapi(
  createRoute({
    method: "get",
    path: "/features",
    summary: "Runtime feature flags",
    description: "Returns feature flags sourced from server environment variables.",
    tags: ["Server"],
    responses: {
      200: {
        description: "Feature flags JSON.",
        content: {
          "application/json": {
            schema: featuresSchema,
          },
        },
      },
    },
  }),
  (context) => context.json({
    experimentalFfmpegTranscoding: (
      process.env["EXPERIMENTAL_FFMPEG_TRANSCODING"] === "true"
    ),
  }, 200),
)
