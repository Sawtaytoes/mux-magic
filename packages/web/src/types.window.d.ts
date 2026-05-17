declare global {
  interface Window {
    // Populated by packages/server/scripts/build-command-descriptions.ts at build time.
    getCommandFieldDescription?: (args: {
      commandName: string
      fieldName: string
    }) => string
    // Injected into index.html by the Hono web server at request time (see
    // packages/web/src/server.ts) when REMOTE_SERVER_URL is set. When this
    // is not present (e.g. `vite dev`), apiBase.ts defaults to
    // http://localhost:3000 — see packages/web/src/apiBase.ts.
    __API_BASE__?: string
  }
}

export {}
