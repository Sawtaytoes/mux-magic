import createClient from "openapi-fetch"
import type { paths } from "../schema.generated/tvdbApiSchema.js"

export const tvdbApiSchemaUrl =
  "https://thetvdb.github.io/v4-api/swagger.yml"
export const tvdbApiUrl = "https://api4.thetvdb.com/v4"

export const getTvdbApiUrl = (apiPath: string) =>
  tvdbApiUrl.concat(apiPath)

export const loginToTvdb = () =>
  createClient<paths>({
    baseUrl: tvdbApiUrl,
  }).POST("/login", {
    body: {
      apikey: process.env.TVDB_API_KEY ?? "",
      pin: "",
    },
  })
// fetch(
//   (
//     getTvdbApiUrl(
//       "/login"
//     )
//   ),
//   {
//     body: (
//       JSON
//       .stringify({
//         "apikey": (
//           process
//           .env
//           .TVDB_API_KEY
//         ),
//         "pin": "",
//       })
//     ),
//   }
// )

export const getTvdbFetchClient = () =>
  loginToTvdb().then(({ data }) =>
    createClient<paths>({
      baseUrl: tvdbApiUrl,
      headers: {
        // "Accept": "application/json",
        // "Access-Control-Allow-Credentials": "true",
        // "Access-Control-Allow-Origin": "*",
        Authorization: data?.data?.token || "",
      },
    }),
  )
