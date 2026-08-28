# 2026-08-27 — Assert every `/opt/makemkv` binary you actually run; the transplant is not fully self-contained

- **Status:** Accepted
- **Date decided:** 2026-08-27
- **Area:** infra
- **Source:** PR [#258](https://github.com/Sawtaytoes/mux-magic/pull/258) — found ingesting `[BACKUP] Punisher_EC - DVD.iso`

## Decision

`/opt/makemkv` is **mostly**, not entirely, self-contained. `makemkv`, `makemkvcon` and
`sdftool` resolve through the bundled glibc under `/opt/makemkv/lib`. **`mmccextr` does
not** — it is linked against Alpine's musl (`NEEDED libc.musl-x86_64.so.1`, interpreter
`/lib/ld-musl-x86_64.so.1`), so on the `node:26-trixie-slim` base it cannot exec at all.

The Dockerfile therefore ships musl's loader beside it, and **asserts each MakeMKV binary
we invoke at build time**:

```dockerfile
COPY --from=makemkv /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
RUN ln -sf /lib/ld-musl-x86_64.so.1 /lib/libc.musl-x86_64.so.1
RUN mmccextr | grep -q 'CCExtractor'
```

musl's loader **is** its libc, so one file plus the SONAME symlink is the whole fix.

**If you add a call to another `/opt/makemkv` binary, add a build-time assertion for it in
the same commit.** "It sits in `/opt/makemkv/bin` and `makemkvcon` works" is not evidence
that it runs.

## What we rejected — DO NOT revert to this

**Do not trust the blanket "`/opt/makemkv` is SELF-CONTAINED" comment as covering every
binary in it.** That comment is still in the Dockerfile, it is still true of `makemkvcon`,
and it is what made this bug invisible for two months. It describes the binary the
assertion covers, not the directory.

**Do not "fix" it by setting `app_ccextractor = ""` in `settings.conf`.** That was the
obvious workaround and it **does not work** — measured on this disc. The CC track still
appears in the info pass and the rip still fails identically. It also silently discards a
subtitle track we want.

**Do not fix it by installing a distro `ccextractor`.** `mmccextr` is MakeMKV's own build
with MakeMKV's own calling convention; Debian's `ccextractor` is not a drop-in.

**Do not conclude a DVD is faulty when a title will not save.** See below — the failure
looks nothing like a caption problem.

## Why it must not be re-litigated

The failure mode is the expensive part, and none of it points at closed captions:

```
Failed to execute external program 'ccextractor' from location '/opt/makemkv/bin/mmccextr'
LIBMKV_TRACE: Exception: Error while reading input
Failed to save title 0 to file .../EXTRACTED-TITLES/title_t00.mkv
0 titles saved, 1 failed
Copy complete. 0 titles saved, 1 failed.
```

Three traps in that sequence:

1. **It fails the WHOLE title, not just the caption track.** A 2:18:39 feature produced
   zero bytes because one subtitle stream could not be converted.
2. **`makemkvcon` still exits 0.** Only `runMakeMkvConExtract`'s saved-title-count check
   turns it into an error — the same guard the [embedded-makemkvcon
   decision](2026-08-12-makemkvcon-is-embedded-in-the-image.md) exists alongside. An exit
   code would have reported success on an empty folder.
3. **`ldd` lies here in the direction that hides it.** The Dockerfile already warns that
   `ldd` on `makemkvcon` prints nonsense. It prints nonsense on `mmccextr` too — but there
   the nonsense is real. Use `readelf -d` and read `NEEDED`; that is unambiguous.

**Blu-rays never reach this path.** They author subtitles as PGS, which MakeMKV copies
directly. Only DVDs carry line-21 closed captions, so 76 discs' worth of BDMV ingests
found nothing and the very first DVD failed on its very first title. Any defect gated on
DVD-only structure will behave this way — assume a Blu-ray-only test surface has not
exercised it.
