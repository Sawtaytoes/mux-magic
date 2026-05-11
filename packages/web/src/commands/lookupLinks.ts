// Lookup service configurations for NumberWithLookupField. Ported from legacy lookup-links.js.

export type LookupLinkConfig = {
  label: string
  homeUrl: string
  buildUrl: (
    id: unknown,
    params?: Record<string, unknown>,
  ) => string
}

export const LOOKUP_LINKS: Record<
  string,
  LookupLinkConfig
> = {
  mal: {
    label: "open on MyAnimeList",
    homeUrl: "https://myanimelist.net/",
    buildUrl: (id) => `https://myanimelist.net/anime/${id}`,
  },
  anidb: {
    label: "open on AniDB",
    homeUrl: "https://anidb.net/",
    buildUrl: (id) => `https://anidb.net/anime/${id}`,
  },
  tvdb: {
    label: "open on TVDB",
    homeUrl: "https://thetvdb.com/",
    buildUrl: (id) =>
      `https://thetvdb.com/?tab=series&id=${id}`,
  },
  dvdcompare: {
    label: "open release on DVDCompare",
    homeUrl: "https://www.dvdcompare.net/",
    buildUrl: (id, params) =>
      `https://www.dvdcompare.net/comparisons/film.php?fid=${id}#${params?.dvdCompareReleaseHash ?? 1}`,
  },
}
