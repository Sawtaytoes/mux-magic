# npm Publishing

`@mux-magic/tools` is the only package published to npm (the public consumer
surface for `<media-sync-renamed>` and other downstream tools).

## How releases work

Publishing is driven by [.github/workflows/npm-package-deploy.yml](../../.github/workflows/npm-package-deploy.yml),
which runs after CI succeeds on `master`. It publishes **only when the version
was bumped** — concretely, when no `tools-v<version>` git tag exists yet for the
version in `packages/tools/package.json`. On a successful publish it creates and
pushes that tag, so later runs know the version is already released.

There is **no auto-bump**. `master` is protected by a ruleset requiring pull
requests, so CI never edits `package.json` or pushes a commit — it only pushes
the lightweight `tools-v<version>` tag (tags aren't covered by the branch rule).
Bumping the version is therefore a **manual step you do in your PR**.

Publishing authenticates via npm **OIDC trusted publishing** (`--provenance` +
`id-token: write`). There is no npm token secret to manage.

## Releasing a new version

When your change touches `packages/tools/` and you want it published:

1. Bump `version` in `packages/tools/package.json` (semver) in the same PR.
2. Merge to `master`.

On merge, CI runs, then NPM Package Deploy sees there is no `tools-v<newversion>`
tag, publishes `@mux-magic/tools@<newversion>`, and creates the tag.

If you change `packages/tools/` but **don't** bump the version, nothing is
published — the existing `tools-v<version>` tag makes the deploy job skip
cleanly. Bump the version whenever you want the changes shipped to npm.

## Verifying

- `yarn info @mux-magic/tools` shows the latest version after publish completes.
- A new `tools-v<version>` tag appears (`git ls-remote --tags origin 'tools-v*'`).
