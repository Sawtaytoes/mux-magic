# 2026-09-16 — A recursive copy goes through `aclSafeCopyFile`, never `fs.cp`

- **Status:** Accepted
- **Date decided:** 2026-09-16
- **Area:** core / tools
- **Source:** Flintstones ingest, 2026-09-16 (T3 Code chat `70f62c90-1a07-49de-afac-a60958f7c709`)

## Decision

Every copy this codebase performs — one file or a whole tree — goes through
`aclSafeCopyFile`. `copyFiles` with `includeFolders: true` walks the tree with
`aclSafeCopyFolder` and delegates each regular file. No code path calls
`fs.cp(source, destination, { recursive: true })`.

## What we rejected — DO NOT revert to this

`fs.cp(..., { recursive: true })` as the folder-copy implementation. It reads as the
obvious one-liner and it is what the folder branch of `copyFiles` used from the day it
was written.

It does not work on the pool this tool exists to manage. `Bunnies/Family` is
`acltype=nfsv4` with `aclmode=restricted`. `fs.cp` copies each file with libuv's
`fs.copyFile`, whose post-copy `fchmod` returns **EPERM** under restricted aclmode even
when the mode is unchanged. `fs.cp` exposes no hook to absorb that, so the whole
recursive copy fails after writing nothing.

`aclSafeCopyFile` was written specifically to absorb that EPERM — it accepts
"EPERM after a complete write" as success once the source and temp sizes match. The
flat file branch of `copyFiles` already used it. The folder branch bypassed it, which
is how a long-solved problem came back looking new.

Also do not "fix" this by telling the caller to flatten the tree into several
`copyFiles` calls with no `includeFolders`. That is the workaround the Flintstones
ingest used, and it left the defect in place.

## Why it must not be re-litigated

The EPERM was diagnosed, fixed and documented once already. It cost a second
diagnosis, seven hand-written `copyFiles` calls, and the owner's correction —
*"This should've been solved already. We have code in there to ensure the `chmod` gets
caught and the code keeps working after that occurs."*

A second consequence of the old path: `fs.cp` defaults to `force: true`, so the folder
branch silently ignored `allowOverwrite` and always clobbered. `aclSafeCopyFolder`
honours the flag, so both branches now refuse to overwrite by default and both accept
the same opt-in.
