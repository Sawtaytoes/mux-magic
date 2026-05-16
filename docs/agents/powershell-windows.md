# PowerShell on Windows — UTF-8 Traps

Two distinct traps, both rooted in PowerShell 5.1 defaulting to the system code page (Windows-1252) instead of UTF-8.

## File IO — `Get-Content` / `Set-Content`

Never bulk-edit source files with `Get-Content -Raw` + `Set-Content -Encoding utf8`. `Get-Content` defaults to the system code page, NOT UTF-8 — it misreads multi-byte UTF-8 sequences (e.g. `─` = `E2 94 80`) as three individual Windows-1252 bytes (`â`, `"`, `€`), and `Set-Content -Encoding utf8` then re-encodes that mojibake as actual UTF-8, producing the doubly-broken `â"€` you'll see in box-drawing comments and emoji.

Fixing this corruption is a manual chore that takes hours.

For any bulk-edit script, use:

```powershell
[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
```

These operate on raw bytes outside PowerShell's encoding pipeline and produce UTF-8 without a BOM. Better still: prefer the dedicated Edit tool over any bulk-replace script when the file count is small enough.

## Console IO — native command output / pasted input

The same code-page default corrupts *console* output. Native commands (Python, Node, ffmpeg, git) that emit UTF-8 — e.g. `Pokémon`, `─`, emoji — render as `?` or mojibake because PowerShell hands the bytes to a console that thinks it's in Windows-1252. Pasted UTF-8 input has the same problem in reverse.

Fix it once in `$PROFILE` so every session is UTF-8 end-to-end:

```powershell
# Source - https://stackoverflow.com/a/49481797
# Posted by mklement0, modified by community. See post 'Timeline' for change history
# Retrieved 2026-05-16, License - CC BY-SA 4.0
$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding =
                    New-Object System.Text.UTF8Encoding
```

Setting all three properties covers stdout to native EXEs (`$OutputEncoding`), keyboard input (`InputEncoding`), and console rendering (`OutputEncoding`). Missing any one leaves a partial mojibake hole.

This does NOT fix the *file* IO trap above — `Get-Content` / `Set-Content` use their own per-call `-Encoding` parameter and ignore these console settings.
