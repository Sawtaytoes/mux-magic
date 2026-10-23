# Apply default ASS styles to MKVs without remuxing

`applyEmbeddedSubtitleDefaults` applies the same rules as
`modifySubtitleMetadata` with `hasDefaultRules: true`. Each ASS script uses its own
resolution, so a mixed-resolution batch does not inherit its first script's margins.

The command writes copies into `SUBTITLE-DEFAULTS/` and never changes its inputs.
It edits only ASS CodecPrivate headers and their metadata CRC-32 checksums. Track
names, IDs, flags, attachments, chapters, subtitle packets and timestamps retain
their original bytes. Kernel block cloning is used when the filesystem supports it.

## Use

Stage the selected MKVs with `copyFiles` first. Then call:

```json
{
  "steps": [{
    "id": "defaults",
    "command": "applyEmbeddedSubtitleDefaults",
    "params": {"sourcePath": "/media/Downloads/work/Example Series"}
  }]
}
```

The equivalent CLI command is:

```sh
pnpm media applyEmbeddedSubtitleDefaults "/path/to/staged/Example Series"
```

The builder lists **Apply Subtitle Defaults to MKV** under Subtitle Operations.
Use `isRecursive` and `recursiveDepth` for nested staging folders. Generated
`SUBTITLE-DEFAULTS` folders are excluded from recursive input selection.

Verify the staged outputs before using `moveFiles` to install them. Result records
include the modified metadata range and `hasRewrittenMediaPackets: false`.

## Limits

Only S_TEXT/ASS headers are changed. Bitmap subtitles and other track types are
preserved. Headers must fit their existing byte capacity; unused bytes are padded
with whitespace. The command refuses overflow, invalid metadata checksums, unknown
child lengths, oversized metadata, an existing output, or a source changed during
the copy. Segment-level CRC-32 is unsupported. These cases require inspection or
a separately verified remux workflow, never an unsafe in-place fallback. ASS text
extraction has centisecond precision, so exact packet timing must be checked before
accepting a remux result.

The output's size and metadata are checked before its temporary name is published.
The operation does not identify a subtitle's release group, repair missing fonts,
or verify source episode pairing; those remain separate cleanup gates.
