import { join } from "node:path"

interface StartStorybookOptions {
  port: number
  webPackageDir: string
}

export interface StorybookHandle {
  url: string
}

// Starts Storybook's dev server in-process via the programmatic API
// exposed by `storybook/internal/core-server`. Replaces the prior
// `spawn("yarn", ["storybook", "dev", ...])` implementation, which broke
// after Storybook 10.x tightened its argv parser (the script alias
// `storybook dev -p 6006 …` already supplied a `dev` subcommand, and
// appending `dev` again triggered "too many arguments for 'dev'").
//
// Architectural shape: Storybook listens on its own loopback port; the
// front-door's Hono root proxies /storybook/* to that port (see
// buildServer.ts). The proxy survives because preserving the existing
// header-strip / WebSocket-upgrade behavior matters more than collapsing
// the loopback hop.
//
// `storybook/internal/core-server` is dev-only and not in the prod
// bundle's external set — it's pulled in via dynamic import so the
// module-load doesn't reach Storybook unless we're actually starting it.
export const startStorybookDev = async (
  options: StartStorybookOptions,
): Promise<StorybookHandle> => {
  // Storybook reads STORYBOOK_BASE_PATH at preset-load time to prefix
  // its asset URLs with /storybook/, matching the path the front-door
  // mounts it under. Setting the env var on process.env is OK in this
  // single-process boot — no other code reads it.
  process.env.STORYBOOK_BASE_PATH = "/storybook/"

  const { buildDevStandalone } = await import(
    "storybook/internal/core-server"
  )

  const result = await buildDevStandalone({
    ci: true,
    configDir: join(options.webPackageDir, ".storybook"),
    disableTelemetry: true,
    host: "127.0.0.1",
    open: false,
    port: options.port,
    quiet: false,
  })

  return { url: result.address }
}
