# External Tool Binaries (Windows)

Windows executables that are not installed system-wide live under `apps.downloaded/` at the repo root (the directory is gitignored — populate it locally):

| Tool | Path |
|------|------|
| ffmpeg | `apps.downloaded/ffmpeg/bin/ffmpeg.exe` |
| MediaInfo | `apps.downloaded/mediainfo/MediaInfo.exe` |
| mkvextract | `apps.downloaded/mkvtoolnix/mkvextract.exe` |
| mkvmerge | `apps.downloaded/mkvtoolnix/mkvmerge.exe` |
| mkvpropedit | `apps.downloaded/mkvtoolnix/mkvpropedit.exe` |

Path resolution is anchored to the repo root (computed from the source file's location via `import.meta.url`) so the bundled binaries are found regardless of the process's current working directory — important because CLI commands are routinely invoked from arbitrary media folders. If the bundled file is missing, the path falls back to the bare command name and resolves via `PATH`.

The `MEDIAINFO_PATH` environment variable overrides the default MediaInfo path (useful for pointing at a system-installed copy or a different version). See [packages/server/src/tools/appPaths.ts](../../packages/server/src/tools/appPaths.ts) for all path resolution logic.

On Linux/Mac, all tools are assumed to be in `PATH` — no `apps.downloaded/` directory is used.
