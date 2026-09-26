// The Storybook mock API, as data. Two readers share it so a story renders
// the same fixture wherever it is served:
//
//   - `mock-server-plugin.ts` answers it from the Vite dev server
//     (`yarn storybook`, and the Vitest Storybook project).
//   - `staticMockFetch.ts` answers it inside the page for a BUILT Storybook
//     (`storybook-static`), which has no server behind it. That build is what
//     the VRT job screenshots and what the composed Storybook site serves;
//     without this every story that fetches showed a "not found" error.
//
// To add a new mock route, add an entry to `mockRoutes` below. Paths are
// rooted at `/` — the SPA's `/api` prefix is stripped before matching. Routes
// are matched top-to-bottom; the first match wins.

export type MockReply =
  | { kind: "json"; body: unknown }
  // A server-sent-event stream that stays open and silent. The Jotai store
  // in each story is pre-seeded, so no events need to arrive. Only the dev
  // server can hold one open; a built Storybook lets it fail.
  | { kind: "eventStream" }

export type MockRoute = {
  method: "GET" | "POST"
  path: string
  reply: (request: {
    body: string
    params: Record<string, string>
  }) => MockReply
}

// ── Mock routes ────────────────────────────────────────────────────────────
// Add new entries here whenever a story makes a fetch or EventSource request.

export const mockRoutes: MockRoute[] = [
  {
    method: "GET",
    path: "/version",
    reply: () => ({
      kind: "json",
      body: { isContainerized: false },
    }),
  },
  {
    method: "GET",
    path: "/files/delete-mode",
    reply: () => ({
      kind: "json",
      body: { mode: "trash" },
    }),
  },
  {
    method: "GET",
    path: "/files/list",
    reply: () => ({
      kind: "json",
      body: {
        separator: "/",
        entries: [
          {
            name: "Sample Folder",
            isDirectory: true,
            isFile: false,
            size: 0,
            mtime: null,
            duration: null,
          },
          {
            name: "sample.mp4",
            isDirectory: false,
            isFile: true,
            size: 524_288_000,
            mtime: "2025-01-15T10:30:00Z",
            duration: "1:23:45",
          },
          {
            name: "document.txt",
            isDirectory: false,
            isFile: true,
            size: 2048,
            mtime: "2025-01-10T14:20:00Z",
            duration: null,
          },
        ],
      },
    }),
  },
  {
    method: "GET",
    path: "/jobs/stream",
    reply: () => ({ kind: "eventStream" }),
  },
  // Feeds the JobStatusFilter chips. `exited` is deliberately huge:
  // the pile it represents is why the filter exists, and a story
  // showing "exited 4" would not look like the problem it solves.
  {
    method: "GET",
    path: "/jobs/status-counts",
    reply: () => ({
      kind: "json",
      body: {
        cancelled: 2,
        completed: 41,
        exited: 3412,
        failed: 3,
        paused: 1,
        pending: 0,
        running: 2,
        skipped: 118,
      },
    }),
  },
  {
    method: "GET",
    path: "/jobs/:jobId/logs",
    reply: () => ({ kind: "eventStream" }),
  },
  // ── Lookup search endpoints (used by LookupModal stories) ───────────────────
  {
    method: "POST",
    path: "/queries/searchDvdCompare",
    reply: () => ({
      kind: "json",
      body: {
        results: [
          {
            baseTitle: "Neon Genesis Evangelion",
            year: "1995",
            variants: [
              { id: "fid-1", variant: "Blu-ray 4K" },
              { id: "fid-2", variant: "Blu-ray" },
              { id: "fid-3", variant: "DVD" },
            ],
          },
          {
            baseTitle:
              "Evangelion: 1.11 You Are (Not) Alone",
            year: "2007",
            variants: [{ id: "fid-4", variant: "Blu-ray" }],
          },
        ],
      },
    }),
  },
  {
    method: "POST",
    path: "/queries/listDvdCompareReleases",
    reply: () => ({
      kind: "json",
      body: {
        releases: [
          {
            id: "rel-1",
            label: "Discotek Media (US) 2023",
            region: "A",
            format: "Blu-ray 4K",
          },
          {
            id: "rel-2",
            label: "Funimation (US) 2019",
            region: "A",
            format: "Blu-ray",
          },
        ],
        debug: null,
      },
    }),
  },
  {
    method: "POST",
    path: "/queries/searchMal",
    reply: () => ({
      kind: "json",
      body: {
        results: [
          { malId: 30, name: "Neon Genesis Evangelion" },
          { malId: 32, name: "End of Evangelion" },
        ],
      },
    }),
  },
  {
    method: "POST",
    path: "/queries/searchAnidb",
    reply: () => ({
      kind: "json",
      body: {
        results: [
          { aid: 38, name: "Shinseiki Evangelion" },
        ],
      },
    }),
  },
  {
    method: "POST",
    path: "/queries/searchTvdb",
    reply: () => ({
      kind: "json",
      body: {
        results: [
          {
            tvdbId: 73752,
            name: "Neon Genesis Evangelion",
          },
        ],
      },
    }),
  },
  {
    method: "POST",
    path: "/queries/searchMovieDb",
    reply: () => ({
      kind: "json",
      body: {
        results: [
          {
            movieDbId: 18491,
            title:
              "Neon Genesis Evangelion: The End of Evangelion",
            year: "1997",
          },
        ],
      },
    }),
  },
  // ── File system endpoints ────────────────────────────────────────────────────
  {
    method: "GET",
    path: "/files/default-path",
    reply: () => ({
      kind: "json",
      body: { path: "/media" },
    }),
  },
  {
    method: "POST",
    path: "/queries/listDirectoryEntries",
    reply: ({ body }) => {
      const requestedPath = (
        JSON.parse(body) as { path?: string }
      ).path
      if (
        typeof requestedPath === "string" &&
        requestedPath.startsWith("/nonexistent")
      ) {
        return {
          kind: "json",
          body: {
            error: `Directory not found: ${requestedPath}`,
          },
        }
      }
      return {
        kind: "json",
        body: {
          separator: "/",
          entries: [
            { name: "Documents", isDirectory: true },
            { name: "Downloads", isDirectory: true },
            { name: "Music", isDirectory: true },
            { name: "Pictures", isDirectory: true },
            { name: "Videos", isDirectory: true },
          ],
        },
      }
    },
  },
]

// Matches a path pattern like "/jobs/:jobId/logs" against a pathname,
// returning captured params or null on no-match.
const matchPath = ({
  pathname,
  pattern,
}: {
  pathname: string
  pattern: string
}): Record<string, string> | null => {
  const patternSegments = pattern.split("/")
  const pathSegments = pathname.split("/")

  if (patternSegments.length !== pathSegments.length) {
    return null
  }

  const isMatch = patternSegments.every(
    (patternSegment, index) =>
      patternSegment.startsWith(":") ||
      patternSegment === pathSegments[index],
  )

  if (!isMatch) {
    return null
  }

  return Object.fromEntries(
    patternSegments
      .map((patternSegment, index) => [
        patternSegment,
        pathSegments[index],
      ])
      .filter(([patternSegment]) =>
        patternSegment.startsWith(":"),
      )
      .map(([patternSegment, value]) => [
        patternSegment.slice(1),
        value,
      ]),
  )
}

// Strips the SPA's `/api` prefix (Worker 29 made `apiBase` `/api`) and any
// query string, so the route table can stay rooted at `/`.
export const toMockPathname = (url: string): string =>
  url.split("?")[0].replace(/^\/api(?=\/|$)/, "") || "/"

export const findMockRoute = ({
  method,
  pathname,
}: {
  method: string
  pathname: string
}): {
  params: Record<string, string>
  route: MockRoute
} | null =>
  mockRoutes
    .filter(
      (route) => route.method === method.toUpperCase(),
    )
    .map((route) => ({
      params: matchPath({ pathname, pattern: route.path }),
      route,
    }))
    .find(
      (
        candidate,
      ): candidate is {
        params: Record<string, string>
        route: MockRoute
      } => candidate.params !== null,
    ) ?? null
