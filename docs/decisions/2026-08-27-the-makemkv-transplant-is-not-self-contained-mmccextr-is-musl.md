# 2026-08-27 — Assert every `/opt/makemkv` binary you actually run; the transplant is not fully self-contained

- **Status:** Accepted
- **Date decided:** 2026-08-27
- **Area:** infra
- **Source:** PR [#258](https://github.com/Sawtaytoes/mux-magic/pull/258) — found ingesting `[BACKUP] Punisher_EC - DVD.iso`

## Decision

`/opt/makemkv` is **mostly**, not entirely, self-contained. `makemkv`, `makemkvcon` and
`sdftool` resolve through the bundled glibc under `/opt/makemkv/lib`. The two **helper
binaries makemkvcon spawns do not** — both are linked against Alpine's musl, with
interpreter `/lib/ld-musl-x86_64.so.1`, so on the `node:26-trixie-slim` base neither can
exec at all:

| Binary | `NEEDED` | What it does | How its absence shows up |
| --- | --- | --- | --- |
| `mmccextr` | `libc.musl` | Converts DVD line-21 closed captions | **Fails the whole title.** `0 titles saved, 1 failed`, exit 0 |
| `mmgplsrv` | `libc.musl`, `libstdc++.so.6`, `libgcc_s.so.1` | GPL decode helper | `MSG:4041` and carries on — here. `MSG:5069 "Backup failed"` in rip-deck |

The Dockerfile ships musl's loader plus the two libraries `mmgplsrv` needs, and **asserts
each MakeMKV binary we invoke at build time**:

```dockerfile
COPY --from=makemkv /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
COPY --from=makemkv /usr/lib/libstdc++.so.6.0.32 /opt/makemkv-musl/lib/
COPY --from=makemkv /usr/lib/libgcc_s.so.1      /opt/makemkv-musl/lib/
RUN ln -sf /lib/ld-musl-x86_64.so.1 /lib/libc.musl-x86_64.so.1 \
  && ln -sf libstdc++.so.6.0.32 /opt/makemkv-musl/lib/libstdc++.so.6 \
  && echo /opt/makemkv-musl/lib > /etc/ld-musl-x86_64.path

RUN mmccextr | grep -q 'CCExtractor'
RUN ! /opt/makemkv/bin/mmgplsrv --help 2>&1 | grep -qE 'not found|Error loading shared library'
```

musl's loader **is** its libc, so the SONAME symlink covers `libc.musl`. The other two go
in their **own prefix**, reached through `/etc/ld-musl-x86_64.path` — a file only a musl
loader ever reads — so nothing Debian links against is touched.

**If you add a call to another `/opt/makemkv` binary, add a build-time assertion for it in
the same commit.** "It sits in `/opt/makemkv/bin` and `makemkvcon` works" is not evidence
that it runs. The `makemkvcon -r info disc:9999` smoke test **cannot** substitute: it
spawns neither helper.

## This was already solved in `rip-deck`, and the knowledge did not cross

The three-file form above is **lifted from `rip-deck`**, which runs the identical
transplant onto the identical base and fixed this at its bookworm→trixie move. Both
Dockerfiles carry the same "`/opt/makemkv` is SELF-CONTAINED" paragraph, copied across —
but rip-deck's *correction* to it was not, so mux-magic re-derived half of it two months
later at the cost of a failed feature rip.

Two rules follow:

- **When you change the MakeMKV stage here, read rip-deck's first.** It is the other half
  of this transplant's history.
- **rip-deck does NOT carry this defect.** It is fixed there and has been. Anything
  claiming otherwise — including the original scope note on
  [#258](https://github.com/Sawtaytoes/mux-magic/pull/258) — is wrong.

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

**Do not simplify the three files back down to just the loader.** That was the first
attempt here, on this same day. It fixes `mmccextr`, which needs only `libc.musl`, and
leaves `mmgplsrv` broken — measured in the running container after that build deployed.

**Do not put Alpine's `libstdc++.so.6` in `/usr/lib`.** It would shadow Debian's for every
glibc binary in the image, starting with `node`. The separate prefix is the point of the
separate prefix.

**Do not grow this into general musl compatibility.** It is two binaries, three files and
a search path nothing else consults.

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
