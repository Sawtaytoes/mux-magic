# 2026-07-01 — Production runs the esbuild bundle under `node`, never `tsx`

- **Status:** Accepted
- **Date decided:** 2026-07-01
- **Area:** infra
- **Source:** chat session (spun out of the Inkcast sibling-repo build, where an agent regressed this)

## Decision

The production server runs the **esbuild bundle** (`packages/server/dist/index.js`)
under plain **`node`** (`yarn prod:server` = `node --enable-source-maps
packages/server/dist/index.js`, after `yarn build:server-bundle`). `tsx` is a
**dev-only** loader (`yarn dev`, watch mode). Never wire a production entrypoint —
a Dockerfile `CMD`, a `prod:*` script, a systemd unit — to `tsx`.

## What we rejected — DO NOT revert to this

Do **not** run the server in production via `tsx src/index.ts` (or `node --import
tsx …`). It was tempting because it skips the build step, but `tsx` keeps a
transpiler/loader resident in the process and uses substantially more RAM than a
pre-bundled JS file run by plain `node` — which matters for a small always-on
container. The build-scripts already encode this (`build:server-bundle` +
`prod:server` run the bundle), but it was never written down as a decision, so a
fresh agent scaffolding a new service reached for `tsx` in the Dockerfile and had
to be corrected.

## Why it must not be re-litigated

The esbuild-bundle → `node` path is the established, proven prod shape for the
server; `worker-port-protocol.md` and `code-rules.md` both assume it. Re-adding
`tsx` to a prod entrypoint reintroduces the RAM cost and diverges the deploy story
across the repo family. This record exists so the rule is discoverable in the
decision log, not just implied by the build scripts.
