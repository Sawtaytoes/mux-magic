export const BCP47_VARIANTS = [
  { base: "chi", tag: "zh-Hans", name: "Simplified" },
  { base: "chi", tag: "zh-Hant", name: "Traditional" },
  {
    base: "chi",
    tag: "zh-Hans-CN",
    name: "Simplified — China",
  },
  {
    base: "chi",
    tag: "zh-Hans-SG",
    name: "Simplified — Singapore",
  },
  {
    base: "chi",
    tag: "zh-Hant-HK",
    name: "Traditional — Hong Kong",
  },
  {
    base: "chi",
    tag: "zh-Hant-TW",
    name: "Traditional — Taiwan",
  },
  {
    base: "chi",
    tag: "zh-Hant-MO",
    name: "Traditional — Macau",
  },
  { base: "por", tag: "pt-BR", name: "Brazil" },
  { base: "por", tag: "pt-PT", name: "Portugal" },
  { base: "eng", tag: "en-US", name: "United States" },
  { base: "eng", tag: "en-GB", name: "United Kingdom" },
  { base: "eng", tag: "en-AU", name: "Australia" },
  { base: "eng", tag: "en-CA", name: "Canada" },
  { base: "spa", tag: "es-ES", name: "Spain" },
  { base: "spa", tag: "es-MX", name: "Mexico" },
  {
    base: "spa",
    tag: "es-419",
    name: "Latin America",
  },
  { base: "fre", tag: "fr-FR", name: "France" },
  { base: "fre", tag: "fr-CA", name: "Canada" },
  { base: "ger", tag: "de-DE", name: "Germany" },
  { base: "ger", tag: "de-AT", name: "Austria" },
  {
    base: "ger",
    tag: "de-CH",
    name: "Switzerland",
  },
  {
    base: "srp",
    tag: "sr-Cyrl",
    name: "Cyrillic script",
  },
  {
    base: "srp",
    tag: "sr-Latn",
    name: "Latin script",
  },
] as const

export type Bcp47VariantTag =
  (typeof BCP47_VARIANTS)[number]["tag"]
