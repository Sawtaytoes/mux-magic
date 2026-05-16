# npm Publishing

`@mux-magic/tools` is the only package published to npm (the public consumer surface for `<media-sync-renamed>` and other downstream tools).

## One-time setup (user does this manually)

1. Generate an npm automation token from npmjs.com with publish access to the `@mux-magic` scope.
2. Add it to GitHub Actions repo secrets as `NPM_TOKEN`.

## Publishing a new version

1. Bump version in `packages/shared/package.json`.
2. Tag: `git tag shared-v<X.Y.Z>` (note: `shared-` prefix is package-agnostic).
3. `git push --tags` — the `publish-shared.yml` workflow runs and publishes.

## Verifying

- `yarn info @mux-magic/tools` shows the latest version after publish completes.
- `.github/workflows/publish-shared.yml` is the source of truth for the publish steps.
