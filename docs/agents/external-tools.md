# External Tool Binaries (Windows)

Windows executables that are not installed system-wide live under `packages/server/assets.downloaded/`:

| Tool | Path |
|------|------|
| MediaInfo | `assets.downloaded/mediainfo/MediaInfo.exe` |
| mkvextract | `assets.downloaded/mkvtoolnix/mkvextract.exe` |
| mkvmerge | `assets.downloaded/mkvtoolnix/mkvmerge.exe` |
| mkvpropedit | `assets.downloaded/mkvtoolnix/mkvpropedit.exe` |

The `MEDIAINFO_PATH` environment variable overrides the default MediaInfo path (useful for pointing at a system-installed copy or a different version). See [packages/server/src/tools/appPaths.ts](../../packages/server/src/tools/appPaths.ts) for all path resolution logic.

On Linux/Mac, all tools are assumed to be in `PATH` — no `assets.downloaded/` directory is used.
