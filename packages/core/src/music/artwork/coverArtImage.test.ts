import { expect, test } from "vitest"

import {
  buildCoverArtImage,
  getCoverArtExtension,
  getCoverArtMimeType,
} from "./coverArtImage.js"

const buildBytes = (leadingBytes: number[]) =>
  Uint8Array.from(leadingBytes.concat([0, 1, 2, 3]))

test("reads the mime type out of the bytes, not a declared header", () => {
  expect(
    getCoverArtMimeType(buildBytes([0xff, 0xd8, 0xff])),
  ).toBe("image/jpeg")

  expect(
    getCoverArtMimeType(
      buildBytes([0x89, 0x50, 0x4e, 0x47]),
    ),
  ).toBe("image/png")

  expect(
    getCoverArtMimeType(
      buildBytes([0x47, 0x49, 0x46, 0x38]),
    ),
  ).toBe("image/gif")
})

test("recognises webp, whose signature is split across two offsets", () => {
  expect(
    getCoverArtMimeType(
      Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ]),
    ),
  ).toBe("image/webp")
})

test("a RIFF container that is not webp is not an image", () => {
  expect(
    getCoverArtMimeType(
      Uint8Array.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x41, 0x56, 0x45,
      ]),
    ),
  ).toBeNull()
})

test("rejects bytes that are not an image at all", () => {
  expect(
    getCoverArtMimeType(
      Uint8Array.from([0x3c, 0x21, 0x44, 0x4f]),
    ),
  ).toBeNull()

  expect(
    buildCoverArtImage(
      Uint8Array.from([0x3c, 0x21, 0x44, 0x4f]),
    ),
  ).toBeNull()
})

test("builds an image whose mime type came from the bytes", () => {
  expect(
    buildCoverArtImage(buildBytes([0xff, 0xd8, 0xff])),
  ).toEqual({
    bytes: buildBytes([0xff, 0xd8, 0xff]),
    mimeType: "image/jpeg",
  })
})

test("maps a mime type to the filename extension Picard would use", () => {
  expect(getCoverArtExtension("image/jpeg")).toBe(".jpg")
  expect(getCoverArtExtension("IMAGE/PNG")).toBe(".png")
  expect(getCoverArtExtension("image/heic")).toBeNull()
})
