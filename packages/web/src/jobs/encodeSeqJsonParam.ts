// Encoder for the Builder's `?seqJson=` URL parameter.
//
// Produces base64url(UTF-8(json)) — no padding, no '+' or '/'. Pairs with
// decodeSeqJsonParam on the reader side. The live writer in BuilderPage and
// buildBuilderUrl (JobCard "re-edit") both call this; the legacy `?seq=`
// param has its own encoder in encodeSeqParam.ts.

import { toBase64Url } from "./base64url"

const utf8Encoder = new TextEncoder()

export const encodeSeqJsonParam = (json: string): string =>
  toBase64Url(utf8Encoder.encode(json))
