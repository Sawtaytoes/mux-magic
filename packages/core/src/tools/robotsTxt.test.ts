import { expect, test } from "vitest"

import {
  getIsPathAllowedByRobots,
  parseRobotsTxtForAnyAgent,
} from "./robotsTxt.js"

// The rules that matter here, in the shape Bandcamp's own robots.txt uses
// (recorded 2026-10-23 from https://bandcamp.com/robots.txt).
const BANDCAMP_STYLE_ROBOTS = [
  "Sitemap: https://example.bandcamp.com/sitemap.xml",
  "User-agent: *",
  "Disallow: /tools",
  "Disallow: /api/",
  "Disallow: /search",
  "",
  "Allow: /api/currency_data/",
  "",
  "Disallow: /*_cb$",
  "",
  "User-agent: SomeCrawler",
  "Disallow: /",
  "User-agent: ImageCrawler",
  "Crawl-delay: 5",
].join("\n")

const getIsAllowed = (path: string) =>
  getIsPathAllowedByRobots({
    path,
    rules: parseRobotsTxtForAnyAgent(BANDCAMP_STYLE_ROBOTS),
  })

test("reads only the rules of the any-agent group", () => {
  expect(
    parseRobotsTxtForAnyAgent(BANDCAMP_STYLE_ROBOTS),
  ).toEqual([
    { isAllowed: false, pattern: "/tools" },
    { isAllowed: false, pattern: "/api/" },
    { isAllowed: false, pattern: "/search" },
    { isAllowed: true, pattern: "/api/currency_data/" },
    { isAllowed: false, pattern: "/*_cb$" },
  ])
})

test("refuses a path a Disallow prefix covers", () => {
  expect(getIsAllowed("/search?q=anything")).toBe(false)
  expect(getIsAllowed("/api/fancollection/1/x")).toBe(false)
})

test("allows a path no rule covers, even when another agent is barred from the site", () => {
  expect(getIsAllowed("/music")).toBe(true)
  expect(getIsAllowed("/album/some-album")).toBe(true)
  expect(getIsAllowed("/")).toBe(true)
})

test("lets the longest matching rule win", () => {
  expect(getIsAllowed("/api/currency_data/usd")).toBe(true)
})

test("reads a wildcard and an end anchor", () => {
  expect(getIsAllowed("/album/thing_cb")).toBe(false)
  expect(getIsAllowed("/album/thing_cb/more")).toBe(true)
})

test("lets an Allow win a tie of equal length", () => {
  expect(
    getIsPathAllowedByRobots({
      path: "/page",
      rules: parseRobotsTxtForAnyAgent(
        "User-agent: *\nDisallow: /page\nAllow: /page",
      ),
    }),
  ).toBe(true)
})

test("shares one group between consecutive User-agent lines", () => {
  expect(
    getIsPathAllowedByRobots({
      path: "/music",
      rules: parseRobotsTxtForAnyAgent(
        "User-agent: SomeCrawler\nUser-agent: *\nDisallow: /music",
      ),
    }),
  ).toBe(false)
})

test("treats an empty Disallow as no restriction", () => {
  expect(
    parseRobotsTxtForAnyAgent("User-agent: *\nDisallow:"),
  ).toEqual([])
})

test("always allows robots.txt itself", () => {
  expect(
    getIsPathAllowedByRobots({
      path: "/robots.txt",
      rules: parseRobotsTxtForAnyAgent(
        "User-agent: *\nDisallow: /",
      ),
    }),
  ).toBe(true)
})
