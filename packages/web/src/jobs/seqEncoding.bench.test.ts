// Informational sizing bench (NOT a regression test — assertions are
// floors only, not strict equality). Prints a readable table of payload
// sizes for the same logical sequence under six encodings:
//
//   YAML raw                       | toYamlStr(...) source bytes
//   JSON raw (minified)            | JSON.stringify(buildSequenceObject(...))
//   YAML + base64                  | current ?seq= size
//   JSON + base64url               | new ?seqJson= size
//   YAML + gzip + base64url        | future option
//   JSON + gzip + base64url        | future option
//
// "Size" is character length post-encodeURIComponent for rows that need
// it (YAML raw and JSON raw), and raw character length for the already-
// URL-safe rows. The artifact informs the future "should we eventually
// compress, and which source format?" decision behind a separate worker.
//
// File is committed as `*.bench.test.ts` so the existing vitest include
// glob (`src/**/*.test.{ts,tsx}`) picks it up — no config change needed.

import { dump } from "js-yaml"
import { describe, expect, test } from "vitest"
import { toBase64Url } from "./base64url"
import { encodeSeqJsonParam } from "./encodeSeqJsonParam"
import { encodeSeqParam } from "./encodeSeqParam"

type Fixture = {
  name: string
  payload: {
    variables?: Record<string, unknown>
    steps: unknown[]
  }
}

const makeStep = (
  index: number,
  command: string,
  paramName: string,
) => ({
  id: `step_${index.toString(36).padStart(4, "0")}`,
  command,
  params: { [paramName]: `@basePath` },
})

const FIXTURES: Fixture[] = [
  {
    name: "empty",
    payload: { steps: [] },
  },
  {
    name: "1-step flattenOutput",
    payload: {
      variables: {
        basePath: {
          label: "basePath",
          value: "/media",
          type: "path",
        },
      },
      steps: [
        {
          id: "step1",
          command: "flattenOutput",
          params: { sourcePath: "@basePath" },
        },
      ],
    },
  },
  {
    name: "10-step typical (commands + group + 2 path vars)",
    payload: {
      variables: {
        basePath: {
          label: "basePath",
          value: "/media/movies",
          type: "path",
        },
        outPath: {
          label: "outPath",
          value: "/exports/out",
          type: "path",
        },
      },
      steps: [
        ...Array.from({ length: 4 }, (_, index) =>
          makeStep(index, "flattenOutput", "sourcePath"),
        ),
        {
          kind: "group",
          id: "g1",
          label: "parallel batch",
          isParallel: true,
          steps: [
            makeStep(100, "setDisplayWidth", "sourcePath"),
            makeStep(101, "setDisplayWidth", "sourcePath"),
            makeStep(102, "setDisplayWidth", "sourcePath"),
          ],
        },
        ...Array.from({ length: 3 }, (_, index) =>
          makeStep(
            200 + index,
            "renameFiles",
            "sourcePath",
          ),
        ),
      ],
    },
  },
  {
    name: "50-step large",
    payload: {
      variables: {
        basePath: {
          label: "basePath",
          value: "/m",
          type: "path",
        },
      },
      steps: Array.from({ length: 50 }, (_, index) =>
        makeStep(index, "flattenOutput", "sourcePath"),
      ),
    },
  },
  {
    name: "100-step stress",
    payload: {
      variables: {
        basePath: {
          label: "basePath",
          value: "/m",
          type: "path",
        },
      },
      steps: Array.from({ length: 100 }, (_, index) =>
        makeStep(index, "flattenOutput", "sourcePath"),
      ),
    },
  },
]

const utf8Encoder = new TextEncoder()

// Compresses a string via the browser-native CompressionStream("gzip"),
// returning the raw gzip bytes.
const gzipBytes = async (
  text: string,
): Promise<Uint8Array> => {
  const compressedStream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("gzip"))
  const buffer = await new Response(
    compressedStream,
  ).arrayBuffer()
  return new Uint8Array(buffer)
}

const formatRow = (
  label: string,
  size: number,
  baseline: number,
): string => {
  const ratio =
    baseline === 0
      ? "—"
      : `${((size / baseline) * 100).toFixed(0)}%`
  return `  ${label.padEnd(28)} ${size
    .toString()
    .padStart(6)} chars  (${ratio} of YAML raw)`
}

describe("seqEncoding size bench (informational)", () => {
  test("reports payload size for each fixture under each encoding", async () => {
    const lines: string[] = [
      "",
      "============================================================",
      " seqEncoding size bench — Builder URL payload comparison",
      "============================================================",
    ]

    const sectionLines = await Promise.all(
      FIXTURES.map(async ({ name, payload }) => {
        const yamlRaw = dump(payload, {
          lineWidth: -1,
          flowLevel: 3,
          indent: 2,
        })
        const jsonRaw = JSON.stringify(payload)

        const yamlBase64 = encodeSeqParam(yamlRaw)
        const jsonBase64url = encodeSeqJsonParam(jsonRaw)

        const yamlGzipped = toBase64Url(
          await gzipBytes(yamlRaw),
        )
        const jsonGzipped = toBase64Url(
          await gzipBytes(jsonRaw),
        )

        const baseline = yamlRaw.length

        return [
          "",
          `Fixture: ${name}`,
          formatRow("YAML raw", yamlRaw.length, baseline),
          formatRow(
            "JSON raw (minified)",
            jsonRaw.length,
            baseline,
          ),
          formatRow(
            "YAML + base64 (?seq=)",
            yamlBase64.length,
            baseline,
          ),
          formatRow(
            "JSON + base64url (?seqJson=)",
            jsonBase64url.length,
            baseline,
          ),
          formatRow(
            "YAML + gzip + base64url",
            yamlGzipped.length,
            baseline,
          ),
          formatRow(
            "JSON + gzip + base64url",
            jsonGzipped.length,
            baseline,
          ),
        ]
      }),
    )

    const allLines = lines.concat(...sectionLines, [
      "",
      "============================================================",
    ])
    console.log(allLines.join("\n"))

    // Floor assertion: JSON+base64url should not be larger than the legacy
    // YAML+base64 for any fixture above the empty case. Generous margin
    // (10%) — the bench is informational, this just guards against a
    // catastrophic regression in the encoder output.
    FIXTURES.slice(1).forEach(({ name, payload }) => {
      const yamlBase64 = encodeSeqParam(
        dump(payload, {
          lineWidth: -1,
          flowLevel: 3,
          indent: 2,
        }),
      )
      const jsonBase64url = encodeSeqJsonParam(
        JSON.stringify(payload),
      )
      expect(
        jsonBase64url.length,
        `${name}: ?seqJson= (${jsonBase64url.length}) should not exceed ?seq= (${yamlBase64.length}) by more than 10%`,
      ).toBeLessThanOrEqual(
        Math.ceil(yamlBase64.length * 1.1),
      )
    })

    // Sanity: gzip should shrink the larger fixtures meaningfully (no
    // strict number — just verify CompressionStream produced something
    // smaller than the uncompressed JSON, which is the whole point of
    // the bench).
    const stress = FIXTURES[FIXTURES.length - 1]
    const stressJsonRaw = JSON.stringify(stress.payload)
    const stressJsonGzip = await gzipBytes(stressJsonRaw)
    expect(
      stressJsonGzip.length,
      "gzip on the 100-step fixture should compress JSON",
    ).toBeLessThan(utf8Encoder.encode(stressJsonRaw).length)
  })
})
