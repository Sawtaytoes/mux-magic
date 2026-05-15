# Worker 2a — server-template-storage

**Model:** Sonnet · **Thinking:** ON · **Effort:** High
**Branch:** `feat/mux-magic-revamp/2a-server-template-storage`
**Worktree:** `.claude/worktrees/2a_server-template-storage/`
**Phase:** 4 (server infrastructure)
**Depends on:** 01 (rebrand)
**Parallel with:** 41, 2c, 38, 3b, 3c, 3e, 40. Adds new server routes + a new web sidebar surface; doesn't touch the existing YAML codec internals (it consumes them), so it doesn't collide with Phase 3 NSF work or the Variables foundation from 36/37.

> **Why this worker exists:** sequence templates today live in three places: the URL query string (`?seq=…` encoded YAML; see [encodeSeqParam.ts](../../packages/web/src/jobs/encodeSeqParam.ts)), pasted YAML via the Load modal ([LoadModal.tsx](../../packages/web/src/components/LoadModal/LoadModal.tsx) + [useAutoClipboardLoad.ts](../../packages/web/src/hooks/useAutoClipboardLoad.ts)), and ad-hoc files the user keeps locally. There is no shared library, no way to send "the same template" to a second machine without copy/paste, and no way for Home Assistant or a future webhook trigger to invoke a named template by id. This worker adds server-side persistence: `GET/POST/PUT/DELETE /api/templates` backed by a flat JSON file on disk, plus a new web sidebar listing the saved templates and one-click load. The server becomes the source of truth; the URL query string stays as the ephemeral "share-this-instance" mechanism.

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Tests must cover the change scope. Yarn only. Manifest row update lands as its own `chore(manifest):` commit. One component per file. See [AGENTS.md](../../AGENTS.md).

## Your Mission

### Server side

1. New routes file: [packages/server/src/api/routes/templateRoutes.ts](../../packages/server/src/api/routes/templateRoutes.ts):
   - `GET    /api/templates`            → list `{ id, name, description, updatedAt }[]`
   - `GET    /api/templates/:id`         → full template `{ id, name, description, yaml, createdAt, updatedAt }`
   - `POST   /api/templates`             → create; body `{ name, description?, yaml }`; server assigns `id` (slug-of-name with collision suffix) + timestamps
   - `PUT    /api/templates/:id`         → update; body `{ name?, description?, yaml }`; `updatedAt` bumped
   - `DELETE /api/templates/:id`         → delete

   All routes use `@hono/zod-openapi`'s `createRoute` so they show up in `/openapi.json`.

2. Storage: a single JSON file at `${APP_DATA_DIR}/templates.json` (where `APP_DATA_DIR` comes from [appPaths.ts](../../packages/server/src/tools/appPaths.ts)). Shape:

   ```ts
   type TemplatesFile = {
     version: 1
     templates: Array<{
       id: string
       name: string
       description?: string
       yaml: string
       createdAt: string // ISO 8601
       updatedAt: string
     }>
   }
   ```

   Read/write with `fs.promises`. Use a write-then-rename pattern (`writeFile(tmp); rename(tmp, final)`) for atomic-ish writes — the file is small, no need for sqlite or a real DB.

3. Concurrency: serialize writes with a per-process mutex (a single `Promise` chain `lastWrite = lastWrite.then(...)`). Multi-process is out of scope; document the single-process assumption.

4. Validation: `yaml` is validated by round-tripping through the existing [yamlCodec.ts](../../packages/web/src/jobs/yamlCodec.ts) parse path. **Move the parser into `@mux-magic/tools`** if it's not already accessible from the server — but only the parser/validator function. The web's UI atoms stay web-only.

   - On `POST`/`PUT` with invalid YAML: 400 with `{ error: "invalid yaml", details: <parse error> }`.

5. Slug generation for `id`: `kebab-case(name)`; on collision, append `-2`, `-3`, etc. Surface the chosen id in the 201 response.

### Web side

1. New right-sidebar section: "Saved Templates". Renders the list from `GET /api/templates`. Each row has:
   - Template name (click to load → populates the current sequence)
   - "Update from current" button (sends current sequence YAML to `PUT /api/templates/:id`)
   - Three-dot menu: Rename, Edit description, Delete (with confirm)

2. A "Save current sequence as template" button at the top of the sidebar. Opens a small modal asking for name + optional description; on submit, `POST /api/templates`.

3. Loading a template replaces the current sequence and clears the `?seq=` query string. Surface an undo-toast that restores the prior sequence if the user clicks "Undo".

4. New atoms in `packages/web/src/state/` (or wherever similar atoms live today):
   - `templatesAtom` — list, refetched on mount + after every mutation
   - `selectedTemplateIdAtom` — the currently-loaded template id (null if user is editing an unsaved one)

5. Sidebar lives next to (or inside) the Edit Variables surface from worker 37 — verify with the screenshot/Storybook that the new section fits the existing layout. If layout breaks, file the smallest visual fix.

### Out of scope

- Multi-user auth on templates (single-user assumption today).
- Multi-process file locking.
- Template versioning beyond `updatedAt` (no history, no rollback).
- Folder/tag organization for templates — flat list only.
- Importing templates from URLs/disks — only the web UI's "save current sequence" path creates them in v1.
- Migrating existing browser-local saved sequences (if any) — those stay where they are.

## Tests (per test-coverage discipline)

- **Unit:** slug generator produces stable kebab-case; collision handling appends `-2`, `-3`, etc.
- **Unit:** the on-disk reader handles a missing file by returning `{ version: 1, templates: [] }`.
- **Unit:** invalid YAML in `POST`/`PUT` body returns 400 with `error: "invalid yaml"` and `details`.
- **Unit:** the write-then-rename storage pattern doesn't leave a temp file behind on success; on failure (throw mid-write) the original file is preserved.
- **Integration:** full CRUD round-trip via the route handlers (`POST`, `GET list`, `GET id`, `PUT`, `DELETE`, `GET id` 404).
- **Integration:** concurrent writes (two `POST`s started simultaneously) both land; the serializer doesn't drop either.
- **Web:** the sidebar lists templates from `GET /api/templates`; clicking a template triggers a fetch + loads the YAML into the sequence atoms.
- **Web:** "Save current sequence" round-trips through the API and the new template appears in the list.
- **e2e:** save → reload page → template still in sidebar; loading it produces the same sequence visually as the original.

## TDD steps

1. Failing tests for slug, storage reader/writer, validation. Commit `test(server-templates): failing tests for storage layer`.
2. Implement storage layer + slug logic. Green.
3. Failing tests for the four route handlers. Commit.
4. Implement the routes; wire them into [hono-routes.ts](../../packages/server/src/api/hono-routes.ts). Green.
5. Move the YAML parser/validator into `@mux-magic/tools` if needed; verify nothing in the web app broke.
6. Failing tests for the web sidebar component + save modal. Commit.
7. Implement the web UI + atoms. Green.
8. e2e: save + reload. Green.
9. Manifest row → `done` (separate commit).

## Files

- [packages/server/src/api/routes/templateRoutes.ts](../../packages/server/src/api/routes/templateRoutes.ts) — new
- [packages/server/src/api/routes/templateRoutes.test.ts](../../packages/server/src/api/routes/templateRoutes.test.ts) — new
- [packages/server/src/api/templateStore.ts](../../packages/server/src/api/templateStore.ts) — new; the file-backed CRUD layer
- [packages/server/src/api/templateStore.test.ts](../../packages/server/src/api/templateStore.test.ts) — new
- [packages/server/src/api/hono-routes.ts](../../packages/server/src/api/hono-routes.ts) — wire the new routes in
- [packages/tools/src/yaml/](../../packages/tools/src/yaml/) — move parser/validator here if it's still web-only
- [packages/web/src/components/SavedTemplates/](../../packages/web/src/components/SavedTemplates/) — new sidebar component (one component per file: `SavedTemplatesList.tsx`, `SavedTemplateRow.tsx`, `SaveTemplateModal.tsx`)
- [packages/web/src/state/templatesAtoms.ts](../../packages/web/src/state/templatesAtoms.ts) — new atoms
- One existing sidebar / layout file (location depends on worker 37's output) — host the new section
- Tests for all of the above

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Failing tests committed first
- [ ] Server routes registered and show up in `/openapi.json`
- [ ] Storage file at `${APP_DATA_DIR}/templates.json` (atomic write)
- [ ] Invalid YAML rejected with 400 + structured error
- [ ] Web sidebar lists templates and supports load / save-current / rename / delete
- [ ] Loading a template clears `?seq=` from the URL and shows an undo-toast
- [ ] e2e: save → reload → load works end-to-end
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done` in a separate commit
