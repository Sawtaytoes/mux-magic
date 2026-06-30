# 2026-06-12 — Container detection uses a positive signal, not `/.dockerenv`

- **Status:** Accepted
- **Date decided:** 2026-06-12
- **Area:** server/api / infra
- **Source:** worker 53, commits `40a5a1b9`, `546f91db`

## Decision

`detectIsContainerized` (which feeds `/version`'s `isContainerized`) checks, in order: a build-time env var `IS_CONTAINERIZED` (stamped only in the Dockerfile), then a `/proc/1/cgroup` substring match for `docker` / `containerd` / `kubepods`. Everything else is `false`. Thread defaults read `os.availableParallelism()`.

## What we rejected — DO NOT revert to this

- Do not revert to `existsSync('/.dockerenv')`. It false-positives on a dev host that has a leftover `/.dockerenv` file, which is the bug this replaced.
- Do not "simplify" thread defaults back to `os.cpus().length` — it ignores cgroup CPU quotas and over-reports cores inside a container.

## Why it must not be re-litigated

Both reverts look like harmless simplifications and both reintroduce a known wrong answer (false container detection; wrong core count under limits).
