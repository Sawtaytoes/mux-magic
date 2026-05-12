import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { concatMap, from, map, of } from "rxjs"

import { addFolderNameBeforeFilename } from "../tools/addFolderNameBeforeFilename.js"
import { runFfmpeg } from "./runFfmpeg.js"

export const inverseTelecinedPath = "INVERSE-TELECINED"

export const videoFilterPulldown = {
  // "2:3": "dejudder,fps=30000/1001,pullup", // This is what worked in the past, but it doesn't work always.
  "2:3": "pullup,dejudder,fps=24000/1001",
  // "2:3": "dejudder,fps=30000/1001,fieldmatch,bwdif=mode=0:parity=-1:deint=0,decimate",
  // "2:3": "pullup",
  // "2:3": "fieldmatch,bwdif=mode=0:parity=-1:deint=0,decimate", // This is from Topaz
  // "2:3": "fieldmatch,bwdif=mode=0:parity=-1:deint=0,decimate,scale=w=854:h=480,setsar=1", // This is from Topaz
  // "2:3": "dejudder,fps=30000/1001,fieldmatch=combmatch=full,yadif=deint=interlaced,decimate",
  // "2:3": "fps=30000/1001,fieldmatch,yadif=deint=interlaced,decimate",
  // "2:3": "fps=30000/1001,fieldmatch,yadif=deint=interlaced,decimate",
  // "2:3": "dejudder,fps=30000/1001,fieldmatch=combmatch=full,yadif=deint=interlaced,decimate",
  // "2:3": "dejudder,fps=30000/1001,fieldmatch=mode=pcn_ub:order=bff,yadif=deint=interlaced,decimate",
  // "2:3": "dejudder,fps=30000/1001,fieldmatch=mode=pcn_ub:order=tff,yadif=deint=interlaced,decimate",
  // "2:3": "fps=30000/1001,fieldmatch=mode=pcn_ub:order=tff,yadif=deint=interlaced,decimate",
  // "2:3": "fps=30000/1001,fieldmatch=mode=pc,yadif=deint=interlaced,decimate",
  // "2:3": "fieldmatch:combmatch=full,yadif=deint=interlaced,decimate",
  // "2:3": "fieldmatch=mode=pc:combmatch=none,decimate",
  // "2:3": "fieldmatch,fieldmatch,decimate",
  // "2:3": "fieldmatch,decimate",
  // "2:3": "pullup",

  // "2:2": "fps=30000/1001,fieldmatch,yadif=deint=interlaced",
} as const

export type Pulldown = keyof typeof videoFilterPulldown

export const videoEncoderType = {
  cpu: "libx265",
  "gpu-nvidia": "hevc_nvenc",
} as const

export type VideoEncoder = keyof typeof videoEncoderType

export const inverseTelecineVideo = ({
  filePath,
  pulldown,
  videoEncoder,
}: {
  filePath: string
  pulldown: Pulldown
  videoEncoder: VideoEncoder
}) =>
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: inverseTelecinedPath,
    }),
  ).pipe(
    concatMap((outputFilePath) =>
      from(
        mkdir(dirname(outputFilePath), { recursive: true }),
      ).pipe(map(() => outputFilePath)),
    ),
    concatMap((outputFilePath) =>
      runFfmpeg({
        args: [
          "-c",
          "copy",

          "-map",
          "0",

          "-c:v",
          videoEncoderType[videoEncoder],

          // This filter is what does the inverse telecine based on your pulldown.
          "-vf",
          videoFilterPulldown[pulldown],

          // Change the rate to 24fps.
          "-r",
          "24000/1001",

          // Assuming that all inverse telecine content is 8-bit color.
          "-pix_fmt",
          "yuv420p",

          // Potentially needed for some content, but I haven't found a use for it yet.
          // "-colorspace",
          // "bt601",

          "-profile:v",
          "main",

          "-level:v",
          "5.1",

          "-crf",
          "18",

          "-preset",
          "slow",

          "-tag:v",
          "hvc1",

          `-y`,
        ],
        inputFilePaths: [filePath],
        outputFilePath,
      }).pipe(map(() => outputFilePath)),
    ),
  )
