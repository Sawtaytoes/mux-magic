import { JSDOM } from "jsdom"
import { describe, expect, test } from "vitest"
import { postContentInnerHtmlUnusedPrefix } from "../__mocks__/uhdDiscForumPostMocks.js"
import {
  getMovieDataFromDomSnippet,
  getReasonsFromDomSnippet,
  getSectionTitleFromDomSnippet,
  getTextContentWithoutChildren,
  parseDomSnippetTextContent,
  processUhdDiscForumPost,
} from "./processUhdDiscForumPost.js"

describe(getTextContentWithoutChildren.name, () => {
  test("gets the full text content", () => {
    const element = new JSDOM("Hugo (Arrow)").window
      .document.body

    const parentElementTextContent =
      getTextContentWithoutChildren(element)

    expect(parentElementTextContent).toBe("Hugo (Arrow)")
  })

  test("only gets text content and not child element text", () => {
    const element = new JSDOM(`
        I Am Cuba (Criterion) (<a href="https://criterionforum.org/forum/viewtopic.php?p=811780#p811780" class="postlink">review</a>)
      `).window.document.body

    const parentElementTextContent =
      getTextContentWithoutChildren(element)

    expect(parentElementTextContent).toBe(
      "I Am Cuba (Criterion) ()",
    )
  })
})

describe(getReasonsFromDomSnippet.name, () => {
  describe("returns an array of strings", () => {
    test("when it has a single reason", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            <span style="color:#000000">Point Break (Icon UK &gt; Shout US)</span> <span style="color:#008000">(better encode &amp; good OG 2.0 audio)</span>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "Icon UK > Shout US",
        "better encode & good OG 2.0 audio",
      ])
    })

    test("when it has multiple reasons", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            <span style="color:#000000">Point Break (Icon UK &gt; Shout US)</span> <span style="color:#008000">(better encode &amp; good OG 2.0 audio)</span>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "Icon UK > Shout US",
        "better encode & good OG 2.0 audio",
      ])
    })

    test("when stylized title w/ children", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            <span style="color:#000000">Akira (Japan &gt; everyone else) <span style="color:#008000"></span><span style="color:#008000">(all 4ks have some DNR but the JPN has the original 1988 home video audio + subs for the film itself)</span>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "Japan > everyone else",
        "all 4ks have some DNR but the JPN has the original 1988 home video audio + subs for the film itself",
      ])
    })

    test("when html is invalid", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            </span>12 Angry Men (Kino) (<span style="color:#FF0000">reference video</span> <span style="color:#4080FF">but heavily filtered audio, fewer extras than the Criterion BD)</span>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "reference video",
        "but heavily filtered audio, fewer extras than the Criterion BD)",
      ])
    })

    test("when it has a screenshots link", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            White Christmas (Paramount) <a href="https://slow.pics/c/A4j6voNq?canvas-mode=fit-width&amp;image-fit=contain" class="postlink">screenshots</a>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "https://slow.pics/c/A4j6voNq?canvas-mode=fit-width&image-fit=contain",
      ])
    })

    test("when it has a review link", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            Killers of the Flower Moon (Eagle) (Italian import) (<strong class="text-strong"><span style="text-decoration:underline">region locked</span></strong>) <a href="https://criterionforum.org/forum/viewtopic.php?p=807147#p807147" class="postlink">review</a>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "region locked",
        "Italian import",
        "https://criterionforum.org/forum/viewtopic.php?p=807147#p807147",
      ])
    })

    test("when it has a capsule review link", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            I Walked With A Zombie &amp; The Seventh Victim (Criterion) <a href="https://criterionforum.org/forum/viewtopic.php?p=824600#p824600" class="postlink">capsule review</a>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([
        "https://criterionforum.org/forum/viewtopic.php?p=824600#p824600",
      ])
    })
  })

  describe("returns null array", () => {
    test("when no reason", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            Beverly Hills Cop (Paramount)
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([])
    })

    test("when section title", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#4080FF">Appreciable/Solid upgrades compared to the <span style="text-decoration:underline"><strong class="text-strong">most recent</strong></span> Blu-Rays:</span></span></strong></span><span style="text-decoration:underline">
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([])
    })

    test("when has non-reason link", () => {
      const reasonsFromDomSnippet =
        getReasonsFromDomSnippet(
          new JSDOM(`
            <div class="content"><a href="https://criterionforum.org/forum/viewtopic.php?f=4&amp;t=18217#p811790" class="postlink">best and worst native language only 4Ks</a>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual([])
    })
  })
})

describe(getSectionTitleFromDomSnippet.name, () => {
  describe("returns a title", () => {
    test("simple title", () => {
      const sectionTitleFromDomSnippet =
        getSectionTitleFromDomSnippet(
          new JSDOM(`
            <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#008000">Superior Imports/versions:</span></span></strong></span>
          `),
        )

      expect(sectionTitleFromDomSnippet).toBe(
        "Superior Imports/versions",
      )
    })

    test("complex title", () => {
      const sectionTitleFromDomSnippet =
        getSectionTitleFromDomSnippet(
          new JSDOM(`
            <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#4080FF">Appreciable/Solid upgrades compared to the <span style="text-decoration:underline"><strong class="text-strong">most recent</strong></span> Blu-Rays:</span></span></strong></span><span style="text-decoration:underline">
          `),
        )

      expect(sectionTitleFromDomSnippet).toBe(
        "Appreciable/Solid upgrades compared to the most recent Blu-Rays",
      )
    })
  })

  describe("returns null string", () => {
    test("when reason", () => {
      const reasonsFromDomSnippet =
        getSectionTitleFromDomSnippet(
          new JSDOM(`
            <span style="color:#000000">Arizona Dream (Studio Canal) (German import)
          `),
        )

      expect(reasonsFromDomSnippet).toBe("")
    })

    test("when reason w/ link", () => {
      const reasonsFromDomSnippet =
        getSectionTitleFromDomSnippet(
          new JSDOM(`
            Trick or Treat (Arrow) <a href="https://criterionforum.org/forum/viewtopic.php?p=824600#p824600" class="postlink">capsule review</a>
          `),
        )

      expect(reasonsFromDomSnippet).toBe("")
    })
  })
})

describe(getMovieDataFromDomSnippet.name, () => {
  describe("returns `movieName` and `publisher`", () => {
    test("when title", () => {
      const reasonsFromDomSnippet =
        getMovieDataFromDomSnippet(
          new JSDOM(`
            Hugo (Arrow)
          `),
        )

      expect(reasonsFromDomSnippet).toEqual({
        movieName: "Hugo",
        publisher: "Arrow",
      })
    })

    test("when title w/ link", () => {
      const reasonsFromDomSnippet =
        getMovieDataFromDomSnippet(
          new JSDOM(`
            I Am Cuba (Criterion) (<a href="https://criterionforum.org/forum/viewtopic.php?p=811780#p811780" class="postlink">review</a>)
          `),
        )

      expect(reasonsFromDomSnippet).toEqual({
        movieName: "I Am Cuba",
        publisher: "Criterion",
      })
    })

    test("when stylized title w/ reason", () => {
      const reasonsFromDomSnippet =
        getMovieDataFromDomSnippet(
          new JSDOM(`
            <span style="color:#000000">Lock Up (Eagle Pictures Italy &gt; Studio Canal Europe)</span> <span style="color:#008000">(better compression than SC)</span>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual({
        movieName: "Lock Up",
        publisher: "Eagle Pictures Italy",
      })
    })
  })

  describe("returns null string for `movieName` and `publisher`", () => {
    test("when section title", () => {
      const reasonsFromDomSnippet =
        getMovieDataFromDomSnippet(
          new JSDOM(`
            <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#008000">Superior Imports/versions:</span></span></strong></span>
          `),
        )

      expect(reasonsFromDomSnippet).toEqual({
        movieName: "",
        publisher: "",
      })
    })
  })
})

describe(parseDomSnippetTextContent.name, () => {
  test("parses section title", () => {
    const parsedElementTextContent =
      parseDomSnippetTextContent(
        new JSDOM(`
          <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#FF0000">Reference 4K titles and/or spectacular upgrades from the most recent BD:</span></span></strong></span>
        `),
      )

    expect(parsedElementTextContent).toEqual({
      movieName: "",
      publisher: "",
      reasons: [],
      sectionTitle:
        "Reference 4K titles and/or spectacular upgrades from the most recent BD",
    })
  })

  test("parses movie", () => {
    const parsedElementTextContent =
      parseDomSnippetTextContent(
        new JSDOM(`
          2001 (WB)
        `),
      )

    expect(parsedElementTextContent).toEqual({
      movieName: "2001",
      publisher: "WB",
      reasons: [],
      sectionTitle: "",
    })
  })

  test("parses movie w/ reason", () => {
    const parsedElementTextContent =
      parseDomSnippetTextContent(
        new JSDOM(`
          A Better Tomorrow (Disk Kino/WCL) (Chinese import) <a href="https://criterionforum.org/forum/viewtopic.php?p=826746&amp;sid=d89684257a652e2f6fd25d49f223a934#p826746" class="postlink">review</a>
        `),
      )

    expect(parsedElementTextContent).toEqual({
      movieName: "A Better Tomorrow",
      publisher: "Disk Kino/WCL",
      reasons: [
        "Chinese import",
        "https://criterionforum.org/forum/viewtopic.php?p=826746&sid=d89684257a652e2f6fd25d49f223a934#p826746",
      ],
      sectionTitle: "",
    })
  })
})

describe(processUhdDiscForumPost.name, () => {
  test("returns an array of objects", () => {
    const uhdDiscForumPostGroups = processUhdDiscForumPost(`
        <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#FF0000">Reference 4K titles and/or spectacular upgrades from the most recent BD:</span></span></strong></span><br>
        2001 (WB)<br>
        8 1/2 (Criterion)<br>
        Yojimbo &amp; Sanjuro (Criterion)<br>
        X (Capelight) <span style="color:#FF0000">(German import)</span><br>
        Yojimbo &amp; Sanjuro (Criterion)<br>
        Young Guns (Lionsgate)<br>
        <br>

        <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#4080FF">Appreciable/Solid upgrades compared to the <span style="text-decoration:underline"><strong class="text-strong">most recent</strong></span> Blu-Rays:</span></span></strong></span><span style="text-decoration:underline"><br>
        Wild Things (Arrow) <span style="color:#4080FF">(if compared to Arrow's 2022 BD)</span><br>
        Willow (Disney)<br>
        Willy Wonka and the Chocolate Factory (WB) <br>
        Wings of Desire (Criterion) (if compared to all BDs)<br>
        Withnail and I (Arrow)<br>
        Witness (Arrow)<br>
        U-571 (Studio Canal) <br>
        Yojimbo &amp; Sanjuro (BFI)<br>
        You're Next (Second Sight + Lionsgate)<br>
        ZAZ Collection (Airplane!, The Naked Gun, Top Secret) (Paramount)<br>

        <span style="font-size:150%;line-height:116%"><strong class="text-strong"><span style="text-decoration:underline"><span style="color:#008000">Superior Imports/versions:</span></span></strong></span><br>

        Hard Target (Universal UK  &gt; Kino US)</span> <span style="color:#008000">(better transfer &amp; compression)</span><span style="color:#000000"><br>
        Henry (Arrow UK &gt; Turbine Germany) </span> <span style="color:#008000">(Arrow's grade is faithful to the theatrical release; Turbine's is too vibrant due to a color gamut error)</span><br>
        <span style="color:#000000">In The Heat Of The Night (Wicked Vision Germany &gt; Kino US)</span> <span style="color:#008000">(adds HDR and DV)</span><br>
        <span style="color:#000000">Inglourious Bastards (Arrow UK &gt; Universal)</span> <span style="color:#008000">(better encode &amp; new extras &amp; book)</span><br>
      `)

    expect(uhdDiscForumPostGroups).toEqual([
      {
        items: [
          {
            movieName: "2001",
            publisher: "WB",
            reasons: [],
          },
          {
            movieName: "8 1/2",
            publisher: "Criterion",
            reasons: [],
          },
          {
            movieName: "Yojimbo & Sanjuro",
            publisher: "Criterion",
            reasons: [],
          },
          {
            movieName: "X",
            publisher: "Capelight",
            reasons: ["German import"],
          },
          {
            movieName: "Yojimbo & Sanjuro",
            publisher: "Criterion",
            reasons: [],
          },
          {
            movieName: "Young Guns",
            publisher: "Lionsgate",
            reasons: [],
          },
        ],
        title:
          "Reference 4K titles and/or spectacular upgrades from the most recent BD",
      },
      {
        items: [
          {
            movieName: "Wild Things",
            publisher: "Arrow",
            reasons: ["if compared to Arrow's 2022 BD"],
          },
          {
            movieName: "Willow",
            publisher: "Disney",
            reasons: [],
          },
          {
            movieName:
              "Willy Wonka and the Chocolate Factory",
            publisher: "WB",
            reasons: [],
          },
          {
            movieName: "Wings of Desire",
            publisher: "Criterion",
            reasons: ["if compared to all BDs"],
          },
          {
            movieName: "Withnail and I",
            publisher: "Arrow",
            reasons: [],
          },
          {
            movieName: "Witness",
            publisher: "Arrow",
            reasons: [],
          },
          {
            movieName: "U-571",
            publisher: "Studio Canal",
            reasons: [],
          },
          {
            movieName: "Yojimbo & Sanjuro",
            publisher: "BFI",
            reasons: [],
          },
          {
            movieName: "You're Next",
            publisher: "Second Sight + Lionsgate",
            reasons: [],
          },
          {
            movieName:
              "ZAZ Collection (Airplane!, The Naked Gun, Top Secret)",
            publisher: "Paramount",
            reasons: [],
          },
        ],
        title:
          "Appreciable/Solid upgrades compared to the most recent Blu-Rays",
      },
      {
        items: [
          {
            movieName: "Hard Target",
            publisher: "Universal UK ",
            reasons: ["better transfer & compression"],
          },
          {
            movieName: "Henry",
            publisher: "Arrow UK",
            reasons: [
              "Arrow's grade is faithful to the theatrical release; Turbine's is too vibrant due to a color gamut error",
            ],
          },
          {
            movieName: "In The Heat Of The Night",
            publisher: "Wicked Vision Germany",
            reasons: [
              "Wicked Vision Germany > Kino US",
              "adds HDR and DV",
            ],
          },
          {
            movieName: "Inglourious Bastards",
            publisher: "Arrow UK",
            reasons: [
              "Arrow UK > Universal",
              "better encode & new extras & book",
            ],
          },
        ],
        title: "Superior Imports/versions",
      },
    ])
  })

  test("returns nothing when incorrect HTML", () => {
    postContentInnerHtmlUnusedPrefix
    const uhdDiscForumPostGroups = processUhdDiscForumPost(
      postContentInnerHtmlUnusedPrefix,
    )

    expect(uhdDiscForumPostGroups).toEqual([])
  })
})
