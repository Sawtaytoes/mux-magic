/**
 * Phase 0 spike — zod/mini + @hono/zod-openapi interop probe
 *
 * PURPOSE
 * -------
 * Determine whether `@hono/zod-openapi@^1.4.0` can consume schemas built
 * with the `zod/mini` functional API instead of chained `zod`. The spike
 * must be deleted before the final PR; its findings drive the Green/Yellow/Red
 * outcome that gates the full migration.
 *
 * OUTCOME: RED
 * ------------
 * `@asteasolutions/zod-to-openapi@8.5.0` (the OpenAPI generation engine
 * underneath `@hono/zod-openapi`) calls `zodSchema.meta()` on EVERY schema
 * it encounters while generating the OpenAPI document (see
 * `Metadata.getMetadataFromRegistry` in the dist/index.cjs source, line ~399).
 *
 * Regular chained-`zod` schemas have `.meta()` because `extendZodWithOpenApi`
 * patches it onto `zod.ZodType.prototype` at import time. `zod/mini` schemas
 * (`ZodMiniString`, `ZodMiniObject`, etc.) do NOT inherit from `zod.ZodType`
 * — they have their own prototype chain that ends at `ZodMiniString` with no
 * `.meta()` method.
 *
 * Verified at runtime (Node, CJS require):
 *
 *   const { z: miniZ } = require('zod/mini');
 *   const s = miniZ.string();
 *   typeof s.meta   // => 'undefined'
 *   typeof s.openapi // => 'undefined'
 *
 *   const mainZ = require('zod');
 *   const s2 = mainZ.z.string();
 *   typeof s2.meta   // => 'function'  (patched by extendZodWithOpenApi)
 *
 * Passing a `zod/mini` schema as a route's request or response schema causes
 * the OpenAPI doc generation (`app.getOpenAPI31Document(...)`) to throw:
 *
 *   TypeError: zodSchema.meta is not a function
 *     at Metadata.getMetadataFromRegistry (…zod-to-openapi/dist/index.cjs:399)
 *     at Metadata.collectMetadata (…:290)
 *     …
 *
 * WORKAROUND ANALYSIS
 * -------------------
 * There is no practical workaround within this worker's scope:
 *
 * 1. Monkey-patching `ZodMiniString.prototype.meta` would require importing
 *    each `ZodMini*` class from zod internals (not a public API) and patching
 *    them all before any schema is created — fragile and unsupported.
 *
 * 2. The `$ZodType` base class (from `zod/v4/core`) also has no `.meta()`
 *    on its prototype (`Object.getOwnPropertyNames($ZodType.prototype)` returns
 *    `['constructor']` only), so patching the common ancestor is not possible
 *    without deep internal access.
 *
 * 3. A Yellow migration (core + non-route helpers only) has very little value:
 *    only 2 of 8 import sites are outside route files, and `schemas.ts` (the
 *    bulk of the schema surface) is consumed directly by route files, so it
 *    cannot be migrated independently without migrating the routes.
 *
 * UNBLOCK PATH
 * ------------
 * This worker should be re-attempted when ONE of the following happens:
 *   a. `@asteasolutions/zod-to-openapi` ships support for the `zod/mini`
 *      schema prototype (i.e. uses `zodSchema._zod` / `.register()` instead
 *      of `.meta()` for metadata retrieval), OR
 *   b. `@hono/zod-openapi` switches to an alternative OpenAPI generator that
 *      is `zod/mini`-aware, OR
 *   c. We replace `@hono/zod-openapi` with a route-definition layer that
 *      reads metadata via `z.globalRegistry` (which IS shared between chained
 *      zod and zod/mini).
 *
 * This file is intentionally NOT imported anywhere and is deleted as part of
 * the `blocked` commit. It serves as the paper trail for the RED decision.
 */

// The code below is the proof-of-concept that was used to confirm the failure.
// It is commented out because running it as a module would crash the process.
//
// import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
// import { z } from "zod/mini"
//
// const schema = z.object({
//   name: z.string(),
// })
//
// const app = new OpenAPIHono()
// app.openapi(
//   createRoute({
//     method: "get",
//     path: "/test",
//     summary: "Test",
//     tags: ["Test"],
//     responses: {
//       200: {
//         description: "OK",
//         content: { "application/json": { schema } },
//       },
//     },
//   }),
//   (c) => c.json({ name: "hi" }, 200),
// )
//
// // This line throws: TypeError: zodSchema.meta is not a function
// app.getOpenAPI31Document({ openapi: "3.1.0", info: { title: "Test", version: "1" } })
