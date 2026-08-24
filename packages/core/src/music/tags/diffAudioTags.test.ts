import { expect, test } from "vitest"
import {
  AUDIO_TAG_FIELDS,
  type AudioTagField,
} from "./audioTagFields.js"
import {
  type AudioTagChangeType,
  diffAudioTags,
} from "./diffAudioTags.js"

const getDifference = ({
  currentTags,
  field,
  proposedTags,
}: {
  currentTags: Parameters<
    typeof diffAudioTags
  >[0]["currentTags"]
  field: AudioTagField
  proposedTags: Parameters<
    typeof diffAudioTags
  >[0]["proposedTags"]
}) =>
  diffAudioTags({ currentTags, proposedTags }).find(
    (difference) => difference.field === field,
  )

test("returns one difference for every canonical tag field", () => {
  const differences = diffAudioTags({
    currentTags: {},
    proposedTags: {},
  })

  expect(
    differences.map((difference) => difference.field),
  ).toEqual(AUDIO_TAG_FIELDS.slice())
})

test("reports added when the current value is missing and a value is proposed", () => {
  expect(
    getDifference({
      currentTags: {},
      field: "title",
      proposedTags: { title: "New Title" },
    }),
  ).toEqual({
    changeType: "added" satisfies AudioTagChangeType,
    currentValue: undefined,
    field: "title",
    proposedValue: "New Title",
  })
})

test("reports changed when both values are present and differ", () => {
  expect(
    getDifference({
      currentTags: { album: "Old Album" },
      field: "album",
      proposedTags: { album: "New Album" },
    }),
  ).toEqual({
    changeType: "changed" satisfies AudioTagChangeType,
    currentValue: "Old Album",
    field: "album",
    proposedValue: "New Album",
  })
})

test("reports removed when an empty string is proposed over a present value", () => {
  expect(
    getDifference({
      currentTags: { comment: "Old comment" },
      field: "comment",
      proposedTags: { comment: "" },
    }),
  ).toEqual({
    changeType: "removed" satisfies AudioTagChangeType,
    currentValue: "Old comment",
    field: "comment",
    proposedValue: "",
  })
})

test("reports removed when an empty array is proposed over present genres", () => {
  expect(
    getDifference({
      currentTags: { genres: ["Electronic"] },
      field: "genres",
      proposedTags: { genres: [] },
    })?.changeType,
  ).toBe("removed")
})

test("reports unchanged when both values are equal", () => {
  expect(
    getDifference({
      currentTags: { artist: "Same Artist" },
      field: "artist",
      proposedTags: { artist: "Same Artist" },
    })?.changeType,
  ).toBe("unchanged")
})

test("reports unchanged when nothing is proposed for a field", () => {
  expect(
    getDifference({
      currentTags: { artist: "Kept Artist" },
      field: "artist",
      proposedTags: { title: "New Title" },
    }),
  ).toEqual({
    changeType: "unchanged" satisfies AudioTagChangeType,
    currentValue: "Kept Artist",
    field: "artist",
    proposedValue: undefined,
  })
})

test("reports unchanged when neither value is present", () => {
  expect(
    getDifference({
      currentTags: {},
      field: "composer",
      proposedTags: { composer: "" },
    })?.changeType,
  ).toBe("unchanged")
})

test("compares numeric fields numerically so a zero-padded string matches a number", () => {
  expect(
    getDifference({
      currentTags: {
        trackNumber: "01" as unknown as number,
      },
      field: "trackNumber",
      proposedTags: { trackNumber: 1 },
    })?.changeType,
  ).toBe("unchanged")
})

test("reports changed when a numeric field holds a different number", () => {
  expect(
    getDifference({
      currentTags: { trackNumber: 2 },
      field: "trackNumber",
      proposedTags: { trackNumber: 3 },
    })?.changeType,
  ).toBe("changed")
})

test("compares genres as an ordered array", () => {
  expect(
    getDifference({
      currentTags: { genres: ["Electronic", "Ambient"] },
      field: "genres",
      proposedTags: { genres: ["Electronic", "Ambient"] },
    })?.changeType,
  ).toBe("unchanged")
})

test("reports changed when the genres are reordered", () => {
  expect(
    getDifference({
      currentTags: { genres: ["Electronic", "Ambient"] },
      field: "genres",
      proposedTags: { genres: ["Ambient", "Electronic"] },
    })?.changeType,
  ).toBe("changed")
})

test("reports changed when a genre is appended", () => {
  expect(
    getDifference({
      currentTags: { genres: ["Electronic"] },
      field: "genres",
      proposedTags: { genres: ["Electronic", "Ambient"] },
    })?.changeType,
  ).toBe("changed")
})

test("reports changed when a boolean field flips", () => {
  expect(
    getDifference({
      currentTags: { isCompilation: true },
      field: "isCompilation",
      proposedTags: { isCompilation: false },
    })?.changeType,
  ).toBe("changed")
})
