import type {
  MakemkvEvent,
  MalformedEvent,
} from "./makemkvEvents.js"
import { scanLine } from "./scanFields.js"

/**
 * Turn one line of `makemkvcon -r` output into a typed event.
 *
 * Ported from rip-deck `packages/daemon/src/makemkv/parseLine.ts`
 * (2026-08-12), rewritten from its `switch` + early-return shape into a
 * prefix→parser lookup to satisfy this repo's code rules.
 *
 * Design rules, each of which exists because getting it wrong is a known
 * failure mode:
 *
 *  - NEVER index a field without checking the length first. A truncated
 *    line would otherwise produce `undefined` where a string is typed,
 *    and the failure surfaces far away from the cause.
 *  - An unparseable line becomes a MALFORMED event, never an exception.
 *    One weird line must not kill a 3-hour analysis.
 *  - Field counts come from real output, not the docs. TINFO and SINFO
 *    carry index prefixes the docs omit, and DRV has seven fields where
 *    the docs imply six.
 */

const createMalformedEvent = ({
  prefix,
  raw,
  reason,
}: {
  prefix: string
  raw: string
  reason: string
}): MalformedEvent => ({
  prefix,
  raw,
  reason,
  type: "MALFORMED",
})

/** Parse a field as an integer, or null if absent/not numeric. */
const readIntegerField = ({
  fields,
  index,
}: {
  fields: string[]
  index: number
}) =>
  index < fields.length &&
  Number.isFinite(Number.parseInt(fields[index].trim(), 10))
    ? Number.parseInt(fields[index].trim(), 10)
    : null

/** Read a field as a string, or "" if absent. */
const readStringField = ({
  fields,
  index,
}: {
  fields: string[]
  index: number
}) => (index < fields.length ? fields[index] : "")

const getHasNumericFields = ({
  fields,
  indices,
}: {
  fields: string[]
  indices: number[]
}) =>
  indices.every(
    (index) => readIntegerField({ fields, index }) !== null,
  )

type ParserArguments = {
  fields: string[]
  line: string
}

const parseWithShape = ({
  build,
  fields,
  line,
  minimumFieldCount,
  numericIndices,
  prefix,
}: {
  build: (fields: string[]) => MakemkvEvent
  fields: string[]
  line: string
  minimumFieldCount: number
  numericIndices: number[]
  prefix: string
}) =>
  fields.length >= minimumFieldCount &&
  getHasNumericFields({ fields, indices: numericIndices })
    ? build(fields)
    : createMalformedEvent({
        prefix,
        raw: line,
        reason:
          fields.length < minimumFieldCount
            ? `${prefix} needs ${minimumFieldCount} fields, got ${fields.length}`
            : `${prefix} ids not numeric`,
      })

const lineParsersByPrefix: Record<
  string,
  (parserArguments: ParserArguments) => MakemkvEvent
> = {
  // index,visible,enabled,flags,name,discName,devicePath
  DRV: ({ fields, line }) =>
    parseWithShape({
      build: (driveFields) => ({
        devicePath: readStringField({
          fields: driveFields,
          index: 6,
        }),
        discName: readStringField({
          fields: driveFields,
          index: 5,
        }),
        driveName: readStringField({
          fields: driveFields,
          index: 4,
        }),
        enabled:
          readIntegerField({
            fields: driveFields,
            index: 2,
          }) ?? 0,
        flags:
          readIntegerField({
            fields: driveFields,
            index: 3,
          }) ?? 0,
        index:
          readIntegerField({
            fields: driveFields,
            index: 0,
          }) ?? 0,
        type: "DRV",
        visible:
          readIntegerField({
            fields: driveFields,
            index: 1,
          }) ?? 0,
      }),
      fields,
      line,
      minimumFieldCount: 7,
      numericIndices: [0],
      prefix: "DRV",
    }),

  // code,flags,count,message,format,param0..paramN
  MSG: ({ fields, line }) =>
    parseWithShape({
      build: (messageFields) => ({
        code:
          readIntegerField({
            fields: messageFields,
            index: 0,
          }) ?? 0,
        count:
          readIntegerField({
            fields: messageFields,
            index: 2,
          }) ?? 0,
        flags:
          readIntegerField({
            fields: messageFields,
            index: 1,
          }) ?? 0,
        format: readStringField({
          fields: messageFields,
          index: 4,
        }),
        message: readStringField({
          fields: messageFields,
          index: 3,
        }),
        // Trust the actual field count over the declared one:
        // `count` has been seen disagreeing with reality.
        params: messageFields.slice(5),
        type: "MSG",
      }),
      fields,
      line,
      minimumFieldCount: 5,
      numericIndices: [0],
      prefix: "MSG",
    }),

  TCOUNT: ({ fields, line }) =>
    parseWithShape({
      build: (countFields) => ({
        count:
          readIntegerField({
            fields: countFields,
            index: 0,
          }) ?? 0,
        type: "TCOUNT",
      }),
      fields,
      line,
      minimumFieldCount: 1,
      numericIndices: [0],
      prefix: "TCOUNT",
    }),

  // id,code,value
  CINFO: ({ fields, line }) =>
    parseWithShape({
      build: (discFields) => ({
        attributeId:
          readIntegerField({
            fields: discFields,
            index: 0,
          }) ?? 0,
        code:
          readIntegerField({
            fields: discFields,
            index: 1,
          }) ?? 0,
        type: "CINFO",
        value: readStringField({
          fields: discFields,
          index: 2,
        }),
      }),
      fields,
      line,
      minimumFieldCount: 3,
      numericIndices: [0, 1],
      prefix: "CINFO",
    }),

  // title,id,code,value — the leading title index is the field the docs
  // omit. Without it every attribute lands on the wrong title, which is
  // the classic MakeMKV "global index" parsing bug.
  TINFO: ({ fields, line }) =>
    parseWithShape({
      build: (titleFields) => ({
        attributeId:
          readIntegerField({
            fields: titleFields,
            index: 1,
          }) ?? 0,
        code:
          readIntegerField({
            fields: titleFields,
            index: 2,
          }) ?? 0,
        titleIndex:
          readIntegerField({
            fields: titleFields,
            index: 0,
          }) ?? 0,
        type: "TINFO",
        value: readStringField({
          fields: titleFields,
          index: 3,
        }),
      }),
      fields,
      line,
      minimumFieldCount: 4,
      numericIndices: [0, 1, 2],
      prefix: "TINFO",
    }),

  // title,stream,id,code,value
  SINFO: ({ fields, line }) =>
    parseWithShape({
      build: (streamFields) => ({
        attributeId:
          readIntegerField({
            fields: streamFields,
            index: 2,
          }) ?? 0,
        code:
          readIntegerField({
            fields: streamFields,
            index: 3,
          }) ?? 0,
        streamIndex:
          readIntegerField({
            fields: streamFields,
            index: 1,
          }) ?? 0,
        titleIndex:
          readIntegerField({
            fields: streamFields,
            index: 0,
          }) ?? 0,
        type: "SINFO",
        value: readStringField({
          fields: streamFields,
          index: 4,
        }),
      }),
      fields,
      line,
      minimumFieldCount: 5,
      numericIndices: [0, 1, 2, 3],
      prefix: "SINFO",
    }),

  // code,id,name
  PRGC: ({ fields, line }) =>
    parseWithShape({
      build: (progressFields) => ({
        code:
          readIntegerField({
            fields: progressFields,
            index: 0,
          }) ?? 0,
        name: readStringField({
          fields: progressFields,
          index: 2,
        }),
        operationId:
          readIntegerField({
            fields: progressFields,
            index: 1,
          }) ?? 0,
        type: "PRGC",
      }),
      fields,
      line,
      minimumFieldCount: 3,
      numericIndices: [0, 1],
      prefix: "PRGC",
    }),

  PRGT: ({ fields, line }) =>
    parseWithShape({
      build: (progressFields) => ({
        code:
          readIntegerField({
            fields: progressFields,
            index: 0,
          }) ?? 0,
        name: readStringField({
          fields: progressFields,
          index: 2,
        }),
        operationId:
          readIntegerField({
            fields: progressFields,
            index: 1,
          }) ?? 0,
        type: "PRGT",
      }),
      fields,
      line,
      minimumFieldCount: 3,
      numericIndices: [0, 1],
      prefix: "PRGT",
    }),

  // current,total,max
  PRGV: ({ fields, line }) =>
    parseWithShape({
      build: (progressFields) => ({
        current:
          readIntegerField({
            fields: progressFields,
            index: 0,
          }) ?? 0,
        max:
          readIntegerField({
            fields: progressFields,
            index: 2,
          }) ?? 0,
        total:
          readIntegerField({
            fields: progressFields,
            index: 1,
          }) ?? 0,
        type: "PRGV",
      }),
      fields,
      line,
      minimumFieldCount: 3,
      numericIndices: [0, 1, 2],
      prefix: "PRGV",
    }),
}

export const parseMakemkvLine = (
  line: string,
): MakemkvEvent =>
  ((scanned) =>
    scanned !== null &&
    lineParsersByPrefix[scanned.prefix] !== undefined
      ? lineParsersByPrefix[scanned.prefix]({
          fields: scanned.fields,
          line,
        })
      : { raw: line, type: "UNKNOWN" })(scanLine(line))
