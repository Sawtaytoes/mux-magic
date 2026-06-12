import { z } from "@hono/zod-openapi"

import {
  BCP47_VARIANTS,
  type Bcp47VariantTag,
} from "@mux-magic/core/src/tools/bcp47Variants.js"
import type { Iso6392LanguageCode } from "@mux-magic/core/src/tools/iso6392LanguageCodes.js"
import { iso6392LanguageCodes } from "@mux-magic/core/src/tools/iso6392LanguageCodes.js"

export type LanguageSelection = {
  code: Iso6392LanguageCode
  ietf?: Bcp47VariantTag
}

type RawLanguageInput =
  | string
  | { code: string; ietf?: string }

export const normalizeLanguageSelection = (
  raw: RawLanguageInput,
): LanguageSelection =>
  typeof raw === "string"
    ? { code: raw as Iso6392LanguageCode }
    : {
        code: raw.code as Iso6392LanguageCode,
        ...(raw.ietf
          ? { ietf: raw.ietf as Bcp47VariantTag }
          : {}),
      }

const bcp47TagTuple = BCP47_VARIANTS.map(
  (variant) => variant.tag,
) as unknown as [Bcp47VariantTag, ...Bcp47VariantTag[]]

export const languageSelectionSchema = z
  .union([
    z.enum(iso6392LanguageCodes),
    z.object({
      code: z.enum(iso6392LanguageCodes),
      ietf: z.enum(bcp47TagTuple).optional(),
    }),
  ])
  .transform(normalizeLanguageSelection)
