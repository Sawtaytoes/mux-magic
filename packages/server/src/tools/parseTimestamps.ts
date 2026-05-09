/** Example Timestamp: "_00_01_31_799" */
export const parseMediaFileChapterTimestamp = (
  chapterTimestamp: string,
) => {
  const [
    hours,
    minutes,
    seconds,
    milliseconds,
  ] = (
    chapterTimestamp
    .split("_")
    .slice(1)
    .map((
      timeValue,
    ) => (
      Number(
        timeValue
        || ""
      )
    ))
  )

  return (
    hours * 60 * 60 * 1000
    + minutes * 60 * 1000
    + seconds * 1000
    + milliseconds
  )
}

export const convertToMilliseconds = (
  subSeconds: number,
): number => (
  (
    subSeconds
    < 1000
  )
  ? subSeconds
  : (
    convertToMilliseconds(
      subSeconds
      / 1000
    )
  )
)

/** Example Timestamps: "00:22:52.037000000" and "00:00:19.93" */
export const convertTimecodeToMilliseconds = (
  timecode: string,
) => {
  const [
    timecodeWithoutMilliseconds,
    subSeconds,
  ] = (
    timecode
    .split(".")
  )

  const [
    hours,
    minutes,
    seconds,
  ] = (
    timecodeWithoutMilliseconds
    .split(":")
    .map((
      timeValue,
    ) => (
      Number(
        timeValue
        || ""
      )
    ))
  )

  const milliseconds = (
    convertToMilliseconds(
      Number(
        subSeconds
      )
    )
  )

  return (
    hours * 60 * 60 * 1000
    + minutes * 60 * 1000
    + seconds * 1000
    + milliseconds
  )
}
