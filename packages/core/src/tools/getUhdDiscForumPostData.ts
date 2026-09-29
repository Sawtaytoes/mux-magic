import { logAndSwallowPipelineError } from "@mux-magic/tools"
import { from, type Observable } from "rxjs"
import { processUhdDiscForumPost } from "../app-commands/processUhdDiscForumPost.cherrio.js"
import { gotoPage, launchBrowser } from "./launchBrowser.js"
import { buildSharedCachedComputation } from "./sharedProviderFetchers.js"

export type UhdDiscForumPostItem = {
  movieName: string
  publisher?: string
  reasons?: string[]
}

export type UhdDiscForumPostSection = {
  sectionTitle: string
}

export type UhdDiscForumPostGroup = {
  items: UhdDiscForumPostItem[]
  title: string
}

export const getParentText = (element: HTMLElement) => {
  const clonedElement = element.cloneNode(
    true,
  ) as HTMLElement

  Array.from(clonedElement.children).forEach(
    (childElement) => {
      clonedElement.removeChild(childElement)
    },
  )

  return clonedElement.textContent
}

export const uhdDiscForumPostId = "739745"

// The forum post is scraped with headless Chromium. The raw post HTML is
// what is stored — not the parsed groups — so a change to the parser
// applies to a cached post as well as a fresh one. Network-first under
// `criterionForum`, the stored post when the forum cannot be reached.
const cacheCriterionForumScrape =
  buildSharedCachedComputation({
    provider: "criterionForum",
  })

const readForumPostHtml = (
  browser: Awaited<ReturnType<typeof launchBrowser>>,
) =>
  browser
    .newPage()
    .then((page) =>
      gotoPage(
        page,
        `https://www.criterionforum.org/forum/viewtopic.php?p=${uhdDiscForumPostId}#p${uhdDiscForumPostId}`,
      ).then(() =>
        page.locator(
          `#post_content${uhdDiscForumPostId} > .content`,
        ),
      ),
    )
    .then((forumPostContent) =>
      forumPostContent
        .count()
        .then((count) =>
          count === 0
            ? Promise.reject(
                new Error("No forum post available."),
              )
            : forumPostContent.evaluate(
                (element) => element.innerHTML,
              ),
        ),
    )

const scrapeUhdDiscForumPostHtml = () =>
  launchBrowser().then((browser) =>
    readForumPostHtml(browser).finally(() =>
      browser.close(),
    ),
  )

export const getUhdDiscForumPostData = (): Observable<
  UhdDiscForumPostGroup[]
> =>
  from(
    cacheCriterionForumScrape({
      produceValue: scrapeUhdDiscForumPostHtml,
      requestKey: `post|${uhdDiscForumPostId}`,
    }).then(processUhdDiscForumPost),
  ).pipe(
    logAndSwallowPipelineError(getUhdDiscForumPostData),
  )
