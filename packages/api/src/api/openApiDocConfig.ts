// Worker 29 collapsed the two-process layout into a single front-door
// at packages/server/, which mounts this api sub-app under /api/*. The
// canonical API surface is therefore `${origin}/api`. PUBLIC_URL is the
// optional override for deployments where the externally-visible
// hostname differs from the container's view of itself.
export const openApiDocs = {
  openapi: "3.1.0",
  info: {
    title: "Media Tools API",
    version: "1.0.0",
    description:
      "API for media file processing and analysis",
  },
  servers: [
    process.env.PUBLIC_URL
      ? {
          url: `${process.env.PUBLIC_URL.replace(/\/+$/, "")}/api`,
          description: "Public API server",
        }
      : {
          url: "/api",
          description: "Same-origin API server",
        },
  ],
}
