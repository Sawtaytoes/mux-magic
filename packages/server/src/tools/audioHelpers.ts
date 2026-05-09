export const formatCodecName = (
  codecName: string
) => {
  if (
    /with Dolby Atmos$/
    .test(
      codecName
    )
  ) {
    return (
      codecName
      .replace(
        /Dolby (.+) with Dolby Atmos/,
        'Dolby Atmos $1',
      )
    )
  }

  if (
    codecName
    .includes(
      "DTS-HD MA + IMAX Enhanced"
    )
  ) {
    return "IMAX Enhanced DTS-X"
  }

  if (
    (
      codecName
      .includes(
        "DTS-HD MA + DTS:X"
      )
    )
    || (
      codecName
      .includes(
        "DTS:X"
      )
    )
  ) {
    return "DTS-X"
  }

  if (
    codecName
    .includes(
      "DTS-HD Master Audio"
    )
  ) {
    return "DTS-HD MA"
  }

  if (
    (
      codecName
      .includes(
        "DTS-HD High Resolution Audio"
      )
    )
    || (
      codecName
      .includes(
        "DTS-HD High-Res Audio"
      )
    )
  ) {
    return "DTS-HD HRA"
  }

  if (
    (
      codecName
      .includes(
        "DTS-ES"
      )
    )
    || (
      codecName
      .includes(
        "96/24"
      )
    )
  ) {
    return "DTS"
  }

  return codecName
}

export const replaceAudioFormat = ({
  channelCount,
  codecName,
  filename,
  codecNameSuffixes = [""],
}: {
  channelCount: string,
  codecName: string,
  filename: string,
  codecNameSuffixes?: string[],
}) => (
  filename
  .replace(
    /(.+) & .+}/,
    '$1'
    .concat(
      " & ",
      (
        formatCodecName(
          codecName
        )
        .concat(
          " ",
          (
            codecNameSuffixes
            .join(
              " "
            )
          ),
        )
        .trim()
      ),
      (
        channelCount
        ? (
          " "
          .concat(
            channelCount
          )
        )
        : ""
      ),
      '}',
    )
  )
)

export const replaceAudioFormatByChannelCount = ({
  channelLayout,
  channels,
  filename,
  formatAdditionalFeatures,
  formatCommercial,
  formatSettingsMode,
  sampingRate,
}: {
  channelLayout: string,
  channels: string,
  filename: string,
  formatAdditionalFeatures?: string,
  formatCommercial: string,
  formatSettingsMode?: string,
  sampingRate: string,
}) => {
  const codec96Suffix = (
    // (
    //   formatAdditionalFeatures
    //   ?.includes("96")
    // )
    // || (
    //   sampingRate
    //   === "96000"
    // )
    // ? "96kHz"
    // : ""
    ""
  )

  if (
    formatCommercial
    ?.includes("Atmos")
  ) {
    return (
      replaceAudioFormat({
        channelCount: "",
        codecName: (
          formatCommercial
          .replace(
            /Dolby (.+) with Dolby Atmos/,
            "Dolby Atmos $1"
          )
        ),
        filename,
      })
    )
  }

  if (
    formatSettingsMode
    === "Dolby Surround"
  ) {
    return (
      replaceAudioFormat({
        channelCount: "4.0",
        codecName: (
          formatCommercial
          .concat(
            " Surround"
          )
        ),
        filename,
      })
    )
  }

  if (
    formatSettingsMode
    === "Dolby Surround EX"
  ) {
    return (
      replaceAudioFormat({
        channelCount: "6.1",
        codecName: (
          formatCommercial
          .concat(" Surround EX")
        ),
        filename,
      })
    )
  }

  if (
    (
      formatCommercial
      .startsWith(
        "DTS"
      )
    )
    && (
      formatAdditionalFeatures
      ?.includes("ES")
    )
    && (
      (
        Number(
          channels
        )
      )
      <= 7
    )
  ) {
    const codecNameSuffixes = (
      [
        "ES",
      ]
      .concat(
        formatAdditionalFeatures
        .includes(
          "XCh"
        )
        ? "Discrete"
        : "Matrix"
      )
    )

    return (
      replaceAudioFormat({
        channelCount: "6.1",
        codecName: (
          formatCommercial
        ),
        codecNameSuffixes: (
          codecNameSuffixes
          .concat(
            codec96Suffix
          )
        ),
        filename,
      })
    )
  }

  if (
    formatAdditionalFeatures
    === "XLL X"
  ) {
    return (
      replaceAudioFormat({
        channelCount: "",
        codecName: "DTS-X",
        codecNameSuffixes: [
          codec96Suffix
        ],
        filename,
      })
    )
  }

  if (
    formatAdditionalFeatures
    === "XLL X IMAX"
  ) {
    return (
      replaceAudioFormat({
        channelCount: "",
        codecName: "IMAX Enhanced DTS-X",
        codecNameSuffixes: [
          codec96Suffix
        ],
        filename,
      })
    )
  }

  if (
    channelLayout
  ) {
    return (
      replaceAudioFormat({
        channelCount: (
          String(
            channelLayout
            .split(" ")
            .filter((
              channelName,
            ) => (
              channelName
              !== "LFE"
            ))
            .length
          )
          .concat(
            ".",
            (
              (
                channelLayout
                ?.includes("LFE")
              )
              ? "1"
              : "0"
            ),
          )
        ),
        codecName: (
          formatCommercial
        ),
        codecNameSuffixes: [
          codec96Suffix
        ],
        filename,
      })
    )
  }

  if (
    channels
  ) {
    return (
      replaceAudioFormat({
        channelCount: (
          (
            (
              Number(
                channels
              )
            )
            >= 6
          )
          ? (
            String(
              Number(
                channels
              )
              - 1
            )
            .concat(
              ".1"
            )
          )
          : (
            String(
              Number(
                channels
              )
            )
            .concat(
              ".0"
            )
          )
        ),
        codecName: (
          formatCommercial
        ),
        codecNameSuffixes: [
          codec96Suffix
        ],
        filename,
      })
    )
  }

  return (
    replaceAudioFormat({
      channelCount: "2.0",
      codecName: (
        formatCommercial
      ),
      codecNameSuffixes: [
        codec96Suffix
      ],
      filename,
    })
  )
}
