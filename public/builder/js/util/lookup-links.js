export const LOOKUP_LINKS = {
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
