import { logAndSwallowPipelineError } from "@mux-magic/tools"
import { from, type Observable } from "rxjs"
import { processUhdDiscForumPost } from "../app-commands/processUhdDiscForumPost.cherrio.js"
import { gotoPage, launchBrowser } from "./launchBrowser.js"

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

export const getUhdDiscForumPostData = (): Observable<
  UhdDiscForumPostGroup[]
> =>
  from(
    (async () => {
      const browser = await launchBrowser()
      try {
        const page = await browser.newPage()
        await gotoPage(
          page,
          `https://www.criterionforum.org/forum/viewtopic.php?p=${uhdDiscForumPostId}#p${uhdDiscForumPostId}`,
        )

        const forumPostContent = page.locator(
          `#post_content${uhdDiscForumPostId} > .content`,
        )
        if ((await forumPostContent.count()) === 0) {
          throw new Error("No forum post available.")
        }

        const html = await forumPostContent.evaluate(
          (element) => element.innerHTML,
        )
        return processUhdDiscForumPost(html)
      } finally {
        await browser.close()
      }
    })(),
  ).pipe(
    logAndSwallowPipelineError(getUhdDiscForumPostData),
  )
