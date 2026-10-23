import { type FileHandle, open } from "node:fs/promises"
import { crc32 } from "node:zlib"

const TRACKS_IDENTIFIER = 0x1654ae6b
const TRACK_ENTRY_IDENTIFIER = 0xae
const CODEC_PRIVATE_IDENTIFIER = 0x63a2
const CHECKSUM_IDENTIFIER = 0xbf
const MAXIMUM_TRACKS_BYTES = 64 * 1024 * 1024

type Element = {
  identifier: number
  start: number
  dataStart: number
  end: number
  isUnknownSize: boolean
}

type HeaderTransform = (header: string) => string

const fail = (message: string): never => {
  throw new Error(`Matroska subtitle headers: ${message}`)
}

const readInteger = (bytes: Buffer) =>
  Array.from(bytes).reduce(
    (value, byte) => value * 256n + BigInt(byte),
    0n,
  )

const readVariableInteger = ({
  buffer,
  offset,
  isIdentifier,
}: {
  buffer: Buffer
  offset: number
  isIdentifier: boolean
}) =>
  ((firstByte) =>
    ((width) =>
      width === undefined || offset + width > buffer.length
        ? fail("invalid or truncated EBML integer")
        : ((value) => ({
            width,
            value,
            isUnknownSize:
              !isIdentifier &&
              value === (1n << BigInt(7 * width)) - 1n,
          }))(
            readInteger(
              Buffer.concat([
                Buffer.from([
                  isIdentifier
                    ? firstByte
                    : firstByte & (0xff >> width),
                ]),
                buffer.subarray(offset + 1, offset + width),
              ]),
            ),
          ))(
      Array.from(
        { length: isIdentifier ? 4 : 8 },
        (_entry, index) => index + 1,
      ).find(
        (width) =>
          (firstByte & (0x80 >> (width - 1))) !== 0,
      ),
    ))(buffer[offset] ?? 0)

const readElement = ({
  buffer,
  offset,
}: {
  buffer: Buffer
  offset: number
}): Element =>
  ((identifier) =>
    ((size) =>
      size.isUnknownSize ||
      size.value <= BigInt(Number.MAX_SAFE_INTEGER)
        ? {
            identifier: Number(identifier.value),
            start: offset,
            dataStart:
              offset + identifier.width + size.width,
            end:
              offset +
              identifier.width +
              size.width +
              (size.isUnknownSize ? 0 : Number(size.value)),
            isUnknownSize: size.isUnknownSize,
          }
        : fail(
            "element size exceeds the safe integer range",
          ))(
      readVariableInteger({
        buffer,
        offset: offset + identifier.width,
        isIdentifier: false,
      }),
    ))(
    readVariableInteger({
      buffer,
      offset,
      isIdentifier: true,
    }),
  )

const children = ({
  buffer,
  start,
  end,
  remaining = 4096,
}: {
  buffer: Buffer
  start: number
  end: number
  remaining?: number
}): ReadonlyArray<Element> =>
  start === end
    ? []
    : remaining <= 0 || start > end
      ? fail(
          "invalid master element or excessive child count",
        )
      : ((element) =>
          element.isUnknownSize || element.end > end
            ? fail("unbounded or truncated child element")
            : [element].concat(
                children({
                  buffer,
                  start: element.end,
                  end,
                  remaining: remaining - 1,
                }),
              ))(readElement({ buffer, offset: start }))

const payload = ({
  buffer,
  element,
}: {
  buffer: Buffer
  element: Element
}) => buffer.subarray(element.dataStart, element.end)

const checksumBytes = (value: number) =>
  Buffer.from([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])

const checksumFor = ({
  buffer,
  master,
  checksum,
}: {
  buffer: Buffer
  master: Element
  checksum: Element
}) =>
  checksumBytes(
    crc32(
      Buffer.concat([
        buffer.subarray(master.dataStart, checksum.start),
        buffer.subarray(checksum.end, master.end),
      ]),
    ),
  )

const replaceRange = ({
  buffer,
  start,
  end,
  replacement,
}: {
  buffer: Buffer
  start: number
  end: number
  replacement: Buffer
}) =>
  replacement.length === end - start
    ? Buffer.concat([
        buffer.subarray(0, start),
        replacement,
        buffer.subarray(end),
      ])
    : fail("replacement would move media packet offsets")

const updateChecksum = ({
  original,
  modified,
  master,
}: {
  original: Buffer
  modified: Buffer
  master: Element
}) =>
  ((checksums) =>
    checksums.length === 0
      ? modified
      : checksums.length !== 1 ||
          checksums[0].end - checksums[0].dataStart !== 4
        ? fail("invalid CRC-32 element")
        : ((checksum) =>
            payload({
              buffer: original,
              element: checksum,
            }).equals(
              checksumFor({
                buffer: original,
                master,
                checksum,
              }),
            )
              ? replaceRange({
                  buffer: modified,
                  start: checksum.dataStart,
                  end: checksum.end,
                  replacement: checksumFor({
                    buffer: modified,
                    master,
                    checksum,
                  }),
                })
              : fail(
                  "source metadata CRC-32 does not match",
                ))(checksums[0]))(
    children({
      buffer: original,
      start: master.dataStart,
      end: master.end,
    }).filter(
      (element) =>
        element.identifier === CHECKSUM_IDENTIFIER,
    ),
  )

const compactFormatFields = (text: string) =>
  text
    .split("\n")
    .reduce<{
      section: string
      lines: ReadonlyArray<string>
    }>(
      (state, line) =>
        line.startsWith("[")
          ? {
              section: line,
              lines: state.lines.concat(line),
            }
          : {
              section: state.section,
              lines: state.lines.concat(
                ["[V4+ Styles]", "[Events]"].includes(
                  state.section,
                ) && line.startsWith("Format: ")
                  ? `Format: ${line
                      .slice(8)
                      .split(",")
                      .map((field) => field.trim())
                      .join(",")}`
                  : line,
              ),
            },
      { section: "", lines: [] },
    )
    .lines.join("\n")

const padHeader = ({
  text,
  capacity,
}: {
  text: string
  capacity: number
}) =>
  ((bytes) =>
    bytes.length <= capacity
      ? Buffer.concat([
          bytes,
          Buffer.alloc(capacity - bytes.length, 0x20),
        ])
      : fail(
          "modified ASS header exceeds its existing capacity; use a verified remux workflow",
        ))(
    Buffer.from(
      Buffer.byteLength(text, "utf8") <= capacity
        ? text
        : compactFormatFields(text),
      "utf8",
    ),
  )

const rewriteEntry = ({
  buffer,
  entry,
  transform,
}: {
  buffer: Buffer
  entry: Element
  transform: HeaderTransform
}) =>
  ((entries) =>
    (({
      codec,
      trackType,
      privateHeaders,
    }: {
      codec: Element | undefined
      trackType: Element | undefined
      privateHeaders: ReadonlyArray<Element>
    }) =>
      codec !== undefined &&
      trackType !== undefined &&
      readInteger(
        payload({ buffer, element: trackType }),
      ) === 17n &&
      payload({ buffer, element: codec }).toString(
        "utf8",
      ) === "S_TEXT/ASS"
        ? privateHeaders.length !== 1
          ? fail(
              "ASS track has no unique CodecPrivate header",
            )
          : ((header) =>
              updateChecksum({
                original: buffer,
                modified: replaceRange({
                  buffer,
                  start: header.dataStart,
                  end: header.end,
                  replacement: padHeader({
                    text: transform(
                      payload({
                        buffer,
                        element: header,
                      }).toString("utf8"),
                    ),
                    capacity: header.end - header.dataStart,
                  }),
                }),
                master: entry,
              }))(privateHeaders[0])
        : buffer)({
      codec: entries.find(
        (element) => element.identifier === 0x86,
      ),
      trackType: entries.find(
        (element) => element.identifier === 0x83,
      ),
      privateHeaders: entries.filter(
        (element) =>
          element.identifier === CODEC_PRIVATE_IDENTIFIER,
      ),
    }))(
    children({
      buffer,
      start: entry.dataStart,
      end: entry.end,
    }),
  )

export const rewriteMatroskaSubtitleHeaders = ({
  buffer,
  transform,
}: {
  buffer: Buffer
  transform: HeaderTransform
}) =>
  ((tracks) =>
    tracks.identifier !== TRACKS_IDENTIFIER ||
    tracks.isUnknownSize ||
    tracks.end !== buffer.length
      ? fail("expected one complete Tracks element")
      : updateChecksum({
          original: buffer,
          modified: children({
            buffer,
            start: tracks.dataStart,
            end: tracks.end,
          })
            .filter(
              (element) =>
                element.identifier ===
                TRACK_ENTRY_IDENTIFIER,
            )
            .reduce(
              (modified, entry) =>
                rewriteEntry({
                  buffer: modified,
                  entry,
                  transform,
                }),
              buffer,
            ),
          master: tracks,
        }))(readElement({ buffer, offset: 0 }))

const readFileElement = ({
  handle,
  position,
}: {
  handle: FileHandle
  position: number
}) =>
  handle
    .read(Buffer.alloc(16), 0, 16, position)
    .then(({ buffer, bytesRead }) =>
      ((element) => ({
        ...element,
        start: element.start + position,
        dataStart: element.dataStart + position,
        end: element.end + position,
      }))(
        readElement({
          buffer: buffer.subarray(0, bytesRead),
          offset: 0,
        }),
      ),
    )

const seekTracksPosition = ({
  handle,
  seekHead,
  segmentPosition,
  fileSize,
}: {
  handle: FileHandle
  seekHead: Element
  segmentPosition: number
  fileSize: number
}) =>
  seekHead.isUnknownSize ||
  seekHead.end > fileSize ||
  seekHead.end - seekHead.start > MAXIMUM_TRACKS_BYTES
    ? Promise.reject(
        new Error(
          "Matroska subtitle headers: invalid SeekHead size",
        ),
      )
    : handle
        .read(
          Buffer.alloc(seekHead.end - seekHead.start),
          0,
          seekHead.end - seekHead.start,
          seekHead.start,
        )
        .then(({ buffer, bytesRead }) =>
          bytesRead !== buffer.length
            ? fail("incomplete SeekHead read")
            : ((master) =>
                children({
                  buffer,
                  start: master.dataStart,
                  end: master.end,
                })
                  .filter(
                    (entry) => entry.identifier === 0x4dbb,
                  )
                  .flatMap((entry) =>
                    ((properties) =>
                      (({ identifier, position }) =>
                        identifier !== undefined &&
                        position !== undefined &&
                        readInteger(
                          payload({
                            buffer,
                            element: identifier,
                          }),
                        ) === BigInt(TRACKS_IDENTIFIER)
                          ? [
                              readInteger(
                                payload({
                                  buffer,
                                  element: position,
                                }),
                              ) + BigInt(segmentPosition),
                            ]
                          : [])({
                        identifier: properties.find(
                          (property) =>
                            property.identifier === 0x53ab,
                        ),
                        position: properties.find(
                          (property) =>
                            property.identifier === 0x53ac,
                        ),
                      }))(
                      children({
                        buffer,
                        start: entry.dataStart,
                        end: entry.end,
                      }),
                    ),
                  ))(readElement({ buffer, offset: 0 })),
        )
        .then((positions) =>
          positions.length === 0
            ? undefined
            : positions.length !== 1 ||
                positions[0] < BigInt(segmentPosition) ||
                positions[0] >= BigInt(fileSize)
              ? fail("invalid Tracks seek target")
              : Number(positions[0]),
        )

const findTracks = ({
  handle,
  position,
  fileSize,
  segmentPosition,
  remaining = 256,
}: {
  handle: FileHandle
  position: number
  fileSize: number
  segmentPosition: number
  remaining?: number
}): Promise<Element> =>
  remaining <= 0 || position >= fileSize
    ? Promise.reject(
        new Error(
          "Matroska subtitle headers: Tracks was not found before the scan limit",
        ),
      )
    : readFileElement({ handle, position }).then(
        (element) =>
          element.identifier === CHECKSUM_IDENTIFIER
            ? fail("Segment-level CRC-32 is not supported")
            : element.identifier === TRACKS_IDENTIFIER
              ? element
              : element.isUnknownSize ||
                  element.end > fileSize
                ? fail(
                    "cannot safely skip an unknown-size element",
                  )
                : element.identifier === 0x114d9b74
                  ? seekTracksPosition({
                      handle,
                      seekHead: element,
                      segmentPosition,
                      fileSize,
                    }).then((target) =>
                      target === undefined
                        ? findTracks({
                            handle,
                            position: element.end,
                            fileSize,
                            segmentPosition,
                            remaining: remaining - 1,
                          })
                        : readFileElement({
                            handle,
                            position: target,
                          }).then((tracks) =>
                            tracks.identifier ===
                              TRACKS_IDENTIFIER &&
                            tracks.end <= fileSize
                              ? tracks
                              : fail(
                                  "seek target is not a complete Tracks element",
                                ),
                          ),
                    )
                  : findTracks({
                      handle,
                      position: element.end,
                      fileSize,
                      segmentPosition,
                      remaining: remaining - 1,
                    }),
      )

export const readMatroskaTracks = (filePath: string) =>
  open(filePath, "r").then((handle) =>
    handle
      .stat()
      .then(({ size: fileSize }) =>
        readFileElement({ handle, position: 0 }).then(
          (header) =>
            header.identifier === 0x1a45dfa3 &&
            !header.isUnknownSize
              ? readFileElement({
                  handle,
                  position: header.end,
                }).then((segment) =>
                  segment.identifier === 0x18538067
                    ? findTracks({
                        handle,
                        position: segment.dataStart,
                        fileSize,
                        segmentPosition: segment.dataStart,
                      }).then((tracks) =>
                        tracks.isUnknownSize ||
                        tracks.end - tracks.start >
                          MAXIMUM_TRACKS_BYTES
                          ? fail(
                              "Tracks exceeds the safe metadata size limit",
                            )
                          : handle
                              .read(
                                Buffer.alloc(
                                  tracks.end - tracks.start,
                                ),
                                0,
                                tracks.end - tracks.start,
                                tracks.start,
                              )
                              .then(
                                ({ buffer, bytesRead }) =>
                                  bytesRead ===
                                  buffer.length
                                    ? {
                                        buffer,
                                        position:
                                          tracks.start,
                                      }
                                    : fail(
                                        "incomplete Tracks read",
                                      ),
                              ),
                      )
                    : fail("Segment is missing"),
                )
              : fail("EBML header is missing"),
        ),
      )
      .finally(() => handle.close()),
  )

export const writeMatroskaTracks = ({
  filePath,
  buffer,
  position,
}: {
  filePath: string
  buffer: Buffer
  position: number
}) =>
  open(filePath, "r+").then((handle) =>
    handle
      .write(buffer, 0, buffer.length, position)
      .then(({ bytesWritten }) =>
        bytesWritten === buffer.length
          ? handle.sync()
          : fail(
              "incomplete Tracks write; staged output was not installed",
            ),
      )
      .finally(() => handle.close()),
  )

export const inspectMatroskaTrackHeaders = (
  buffer: Buffer,
) =>
  ((tracks) =>
    tracks.identifier !== TRACKS_IDENTIFIER ||
    tracks.end !== buffer.length
      ? fail("expected one complete Tracks element")
      : children({
          buffer,
          start: tracks.dataStart,
          end: tracks.end,
        })
          .filter(
            (entry) =>
              entry.identifier === TRACK_ENTRY_IDENTIFIER,
          )
          .map((entry) =>
            ((properties) =>
              (({
                text,
                integer,
              }: {
                text: (
                  identifier: number,
                ) => string | undefined
                integer: (
                  identifier: number,
                ) => bigint | undefined
              }) => ({
                number: integer(0xd7)?.toString(),
                uid: integer(0x73c5)?.toString(),
                type: integer(0x83)?.toString(),
                codecId: text(0x86),
                language: text(0x22b59c),
                languageIetf: text(0x22b59d),
                name: text(0x536e),
                defaultFlag: integer(0x88)?.toString(),
                forcedFlag: integer(0x55aa)?.toString(),
                assHeader:
                  text(0x86) === "S_TEXT/ASS"
                    ? text(CODEC_PRIVATE_IDENTIFIER)
                    : undefined,
              }))({
                text: (identifier: number) =>
                  ((property) =>
                    property === undefined
                      ? undefined
                      : payload({
                          buffer,
                          element: property,
                        }).toString("utf8"))(
                    properties.find(
                      (property) =>
                        property.identifier === identifier,
                    ),
                  ),
                integer: (identifier: number) =>
                  ((property) =>
                    property === undefined
                      ? undefined
                      : readInteger(
                          payload({
                            buffer,
                            element: property,
                          }),
                        ))(
                    properties.find(
                      (property) =>
                        property.identifier === identifier,
                    ),
                  ),
              }))(
              children({
                buffer,
                start: entry.dataStart,
                end: entry.end,
              }),
            ),
          ))(readElement({ buffer, offset: 0 }))
