# Worker 78 — File explorer: native audio + image preview

**Status:** ready
**Track:** web+srv
**Model:** Haiku
**Effort:** Low
**Thinking:** OFF
**Phase:** 5
**Depends:** —
**Branch:** `worker-78-file-explorer-audio-and-image-preview`
**Worktree:** `.claude/worktrees/78_file-explorer-audio-and-image-preview/`
**Parallel with:** any worker not touching [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) or [packages/api/src/api/routes/fileRoutes.ts](../../packages/api/src/api/routes/fileRoutes.ts). Workers [48](48_file-explorer-modal-search-and-filters.md) and [73](73_file-explorer-delete-in-picker-mode.md) also touch FileExplorerModal — coordinate with whichever lands first (rebase the loser).

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Why

The file explorer renders a clickable preview for video only — see the `VIDEO_EXTENSIONS` set at [FileExplorerModal.tsx:24-35](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L24-L35) and the `setVideoPreview(...)` row-click at lines 671-679. Music folders (`G:\Music\…`) and image-bearing folders (album `cover.jpg` / `cover.png`, manga thumbnails) show up as inert 📄 rows. To verify a track or peek at cover art, the user has to leave the app — yet Chromium/Firefox/Safari render `.flac`/`.mp3`/`.wav`/`.m4a`/`.ogg`/`.opus` natively via `<audio>` and `.jpg`/`.jpeg`/`.png`/`.webp`/`.gif` natively via `<img>` in 2026.

The existing `GET /files/stream` route at [fileRoutes.ts:458-556](../../packages/api/src/api/routes/fileRoutes.ts#L458-L556) already streams bytes with `Content-Type` from `guessMimeType()` and supports HTTP Range (needed for `<audio>` seek). Only the MIME map and the front-end preview modals need to grow.

ffmpeg transcoding is **deliberately out of scope** — browsers handle the supported list natively. A future worker wires on-demand transcoding for edge cases (uncommon ALAC-in-M4A variants, exotic Opus profiles); for now, an unsupported file falls through to a stubbed "transcode (coming later)" placeholder in the modal.

## What

Three coordinated changes, mirroring the existing `VideoPreviewModal` pattern so each new modality is a peer, not a special case inside the video player.

### 1. Extension sets + helpers in FileExplorerModal

In [FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) (currently lines 24-56), add alongside the existing `VIDEO_EXTENSIONS` / `isVideoFile`:

```ts
const AUDIO_EXTENSIONS = new Set([
  ".aac", ".aif", ".aiff", ".flac", ".m4a", ".m4b",
  ".mp3", ".ogg", ".opus", ".wav", ".wave",
])
const IMAGE_EXTENSIONS = new Set([
  ".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".webp",
])

const isAudioFile = (name: string) =>
  AUDIO_EXTENSIONS.has(extname(name).toLowerCase())
const isImageFile = (name: string) =>
  IMAGE_EXTENSIONS.has(extname(name).toLowerCase())
```

Same shape as `isVideoFile` — same `extname().toLowerCase()` pattern — so a later refactor could fold all three into a `previewKindFor(name)` helper without changing call sites.

### 2. Two new preview modals (parallel to VideoPreviewModal)

Create siblings of [VideoPreviewModal](../../packages/web/src/components/VideoPreviewModal/VideoPreviewModal.tsx):

- **`packages/web/src/components/AudioPreviewModal/AudioPreviewModal.tsx`** — renders `<audio controls preload="metadata" src={streamUrl(path)}>` inside the same shared modal chrome. Smaller footprint than the video modal (centered ~480px card, not full-screen). Title bar shows the file name. Click-outside / Escape / ✕ button all dismiss.
- **`packages/web/src/components/ImagePreviewModal/ImagePreviewModal.tsx`** — renders `<img src={streamUrl(path)} alt={path} className="max-w-full max-h-[80vh] object-contain" />` with the same dismissal semantics. No zoom/pan controls (out of scope).

Each modal owns its own jotai atom: `audioPreviewModalAtom.ts` and `imagePreviewModalAtom.ts`. Shape mirrors [videoPreviewModalAtom.ts](../../packages/web/src/components/VideoPreviewModal/videoPreviewModalAtom.ts): `{ path: string } | null`.

The `streamUrl(path)` helper — building `/files/stream?path=<encoded>` — already exists in [FileVideoPlayer.tsx](../../packages/web/src/components/VideoPreviewModal/FileVideoPlayer.tsx). Lift it (if not already exported) into a tiny shared module the new modals can import. Don't reimplement the URL builder.

### 3. Row-click dispatch in FileExplorerModal

The existing `onClick` at [FileExplorerModal.tsx:671-679](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L671-L679) becomes a small dispatch:

```ts
onClick={() => {
  const fullPath = joinPath(currentPath, entry.name, separator)
  if (isVideoFile(entry.name)) setVideoPreview({ path: fullPath })
  else if (isAudioFile(entry.name)) setAudioPreview({ path: fullPath })
  else if (isImageFile(entry.name)) setImagePreview({ path: fullPath })
}}
```

Icon column ([lines 617-621](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx#L617-L621)) gains 🎵 (audio) and 🖼️ (image) variants alongside the existing 🎬 (video) and 📄 (other). Folder behavior is unchanged.

### 4. Mount the two new modals

Wherever `<VideoPreviewModal />` currently mounts (grep `VideoPreviewModal` in `packages/web/src/` — per the Explore pass this is likely [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx) around lines 190-191; verify before editing), add `<AudioPreviewModal />` and `<ImagePreviewModal />` as siblings. If the video modal is mounted inside FileExplorerModal itself, mount the new ones in the same place.

### 5. Extend `guessMimeType()` on the server

In [packages/api/src/api/routes/fileRoutes.ts](../../packages/api/src/api/routes/fileRoutes.ts) (around lines 43-51), extend the MIME map:

```
.flac  → audio/flac
.mp3   → audio/mpeg
.wav   → audio/wav
.wave  → audio/wav
.m4a   → audio/mp4
.m4b   → audio/mp4
.ogg   → audio/ogg
.opus  → audio/ogg
.aac   → audio/aac
.aif   → audio/aiff
.aiff  → audio/aiff
.jpg   → image/jpeg
.jpeg  → image/jpeg
.png   → image/png
.webp  → image/webp
.gif   → image/gif
.bmp   → image/bmp
.avif  → image/avif
```

No new route. HTTP Range continues to work for audio seek; do not touch the range code.

## TDD steps

1. **Failing unit tests** in [FileExplorerModal.test.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx):
   - Click on `cover.jpg` row → `imagePreviewModalAtom` set; audio + video atoms untouched.
   - Click on `01 Primal Planet.flac` row → `audioPreviewModalAtom` set; image + video atoms untouched.
   - Click on `movie.mkv` row → existing video behavior unchanged (regression guard).
   - Icon column shows `🎵` for `.flac`, `🖼️` for `.jpg`, `🎬` for `.mkv`, `📄` for `.txt`. Inline-expected values — no snapshots per test rules.
2. **Failing modal tests** — `AudioPreviewModal.test.tsx` and `ImagePreviewModal.test.tsx`: opening with a path renders an `<audio>` / `<img>` element whose `src` points at `/files/stream?path=<encoded>`. Use `.toBeVisible()` per [feedback_tobevisible_over_inthedocument](../../C%3A/Users/satur/.claude/projects/d--Projects-Personal-mux-magic/memory/feedback_tobevisible_over_inthedocument.md). Dismissal: Escape / backdrop click clears the atom.
3. **Failing server test** for `guessMimeType()`: each new extension maps to the documented MIME string. Inline expected values, no snapshots.
4. Implement until green. Two commits per concern (audio batch, then image batch) — or one bundled commit if the surface stays small.
5. **Storybook stories** — add `AudioPreviewModal.stories.tsx` + `ImagePreviewModal.stories.tsx` (mirror the existing video modal stories). Also extend `FileExplorerModal.stories.tsx` with `WithAudioRows` + `WithImageRows` story variants using mock listings — so worker 6a's VRT snapshot rig has something to grab when it lands.
6. Standard gate: `yarn lint → yarn typecheck → yarn test → yarn e2e → yarn lint`.

## Files

### New

- `packages/web/src/components/AudioPreviewModal/AudioPreviewModal.tsx`
- `packages/web/src/components/AudioPreviewModal/AudioPreviewModal.test.tsx`
- `packages/web/src/components/AudioPreviewModal/audioPreviewModalAtom.ts`
- `packages/web/src/components/AudioPreviewModal/AudioPreviewModal.stories.tsx`
- `packages/web/src/components/ImagePreviewModal/ImagePreviewModal.tsx`
- `packages/web/src/components/ImagePreviewModal/ImagePreviewModal.test.tsx`
- `packages/web/src/components/ImagePreviewModal/imagePreviewModalAtom.ts`
- `packages/web/src/components/ImagePreviewModal/ImagePreviewModal.stories.tsx`

### Extend

- [packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.tsx) — extension sets, helpers, row dispatch, icon column.
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.test.tsx) — new click + icon tests.
- [packages/web/src/components/FileExplorerModal/FileExplorerModal.stories.tsx](../../packages/web/src/components/FileExplorerModal/FileExplorerModal.stories.tsx) — `WithAudioRows`, `WithImageRows`.
- [packages/api/src/api/routes/fileRoutes.ts](../../packages/api/src/api/routes/fileRoutes.ts) — `guessMimeType()` extension.
- Wherever `<VideoPreviewModal />` mounts today (grep result; likely [BuilderPage.tsx](../../packages/web/src/pages/BuilderPage/BuilderPage.tsx)) — add the two new modal mounts as siblings.

### Reuse — do not reinvent

- [VideoPreviewModal.tsx](../../packages/web/src/components/VideoPreviewModal/VideoPreviewModal.tsx) — modal chrome + atom pattern. Audio is a downscale; image is similar without `<video>` track logic.
- [videoPreviewModalAtom.ts](../../packages/web/src/components/VideoPreviewModal/videoPreviewModalAtom.ts) — jotai atom shape to mirror.
- [FileVideoPlayer.tsx](../../packages/web/src/components/VideoPreviewModal/FileVideoPlayer.tsx) — only the `streamUrl` helper. The rest is video-track logic that doesn't apply.
- `/files/stream` HTTP Range handling — works as-is for `<audio>` seek; do not touch.

## Verification checklist

- [ ] Worktree at `.claude/worktrees/78_file-explorer-audio-and-image-preview/`
- [ ] Manifest row flipped to `in-progress` in its own `chore(manifest):` commit at the start
- [ ] Failing-test commits precede green-implementation commits
- [ ] Click `cover.jpg` in the file explorer → image modal opens, `<img>` renders the cover
- [ ] Click `*.flac` in the file explorer → audio modal opens, `<audio>` plays the track (seekable)
- [ ] Click `*.mkv` → existing video modal still works (regression check)
- [ ] Folder click behavior unchanged (still navigates into the folder)
- [ ] Picker mode's `📌 Use this folder` button still works (no regression from icon-dispatch change)
- [ ] `guessMimeType()` returns correct MIME for each new extension (server test green)
- [ ] Storybook builds with new stories
- [ ] Standard gate clean (`yarn lint → typecheck → test → e2e → lint`)
- [ ] Manifest row flipped to `done` after merge per [feedback_workers_flip_own_done](../../C%3A/Users/satur/.claude/projects/d--Projects-Personal-mux-magic/memory/feedback_workers_flip_own_done.md)
- [ ] PR opened against `feat/mux-magic-revamp`

## Out of scope

- **ffmpeg transcoding for audio.** Browsers handle the supported list natively. If a file fails to load, the modal shows a stub "Your browser can't play this file — transcode (coming later)" placeholder. A future worker wires ffmpeg-on-demand.
- **Image zoom / pan / lightbox** (arrow-key cycle through all images in the folder). Mention as a follow-up worker; not in this scope. The user said "view images", which is single-image render.
- **Inline thumbnails in the row list.** Adding inline thumbs would require a fixed-width thumb column on every row — visual change beyond click-to-preview.
- **Cover-art auto-detection** (always show `cover.jpg` next to the folder header). User mentioned it as motivation, but clickable preview already solves the verify-the-cover use case without the layout cost.
- **Audio metadata display** (album/artist/title from ID3 / Vorbis / iTunes tags). Native `<audio>` doesn't read tags; would need a separate parser.
- **Audio playlist / queue** across multiple rows. Single-file preview only.
- **Video extension changes.** This worker is additive; the existing `VIDEO_EXTENSIONS` set stays as-is.
