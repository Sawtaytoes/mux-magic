import {
  findMockRoute,
  toMockPathname,
} from "./mockRoutes.ts"

// A BUILT Storybook (`storybook build` → `storybook-static`) is plain files:
// the dev server's mock middleware does not exist there, so every `/api`
// request a story makes came back as the static host's "not found" page and
// the story rendered a JSON parse error instead of its fixture. The VRT job
// screenshots that build, and the composed Storybook site serves it.
//
// This answers the same `mockRoutes` table from inside the page. Only for a
// same-origin request that matches a route — anything else goes to the real
// `fetch` untouched. An event stream is left to fail, as it always has in a
// built Storybook: a story's store is pre-seeded, so none is needed.
export const installStaticMockFetch = (): void => {
  const passThroughFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)

    const match =
      url.origin === globalThis.location.origin
        ? findMockRoute({
            method: request.method,
            pathname: toMockPathname(url.pathname),
          })
        : null

    if (match === null) {
      return passThroughFetch(input, init)
    }

    const reply = match.route.reply({
      body: await request.text(),
      params: match.params,
    })

    if (reply.kind === "eventStream") {
      return passThroughFetch(input, init)
    }

    return new Response(JSON.stringify(reply.body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  }
}
