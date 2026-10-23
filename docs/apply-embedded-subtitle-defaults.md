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

Repeated Script Info headings with a single property-bearing section are consolidated
before computing defaults. Generator comments and source credits are retained, so a
leading comment-only block cannot hide the real script resolution. Multiple
property-bearing Script Info sections are refused as ambiguous. Every formatted
style block contributes to default-margin decisions; repeated style blocks keep
their field lists, fonts and ignored sign/song styles.

## Limits

Only S_TEXT/ASS headers are changed. Bitmap subtitles and other track types are
preserved. Headers must fit their existing byte capacity. When needed, optional separator
spaces in the Styles/Events Format field lists are removed without changing field
names, style values or credits. Unused bytes are padded
with whitespace. The command refuses overflow, invalid metadata checksums, unknown
child lengths, oversized metadata, an existing output, or a source changed during
the copy. Segment-level CRC-32 is unsupported. These cases require inspection or
a separately verified remux workflow, never an unsafe in-place fallback. ASS text
extraction has centisecond precision, so exact packet timing must be checked before
accepting a remux result.

The output's size and metadata are checked before its temporary name is published.
The operation does not identify a subtitle's release group, repair missing fonts,
or verify source episode pairing; those remain separate cleanup gates.

## Restricted ACLs and block cloning

On Linux, libuv can attempt `fchmod` before requesting a reflink. A restricted
NFSv4 ACL can reject that permission change even when creating and writing the
work copy is allowed. The copy helper retries an incomplete `EPERM` copy with a
content-only Linux clone through Python, which the container already includes.
It inherits destination permissions, creates the temporary file exclusively,
and keeps the existing atomic publication, cancellation and progress behavior.
If Python or cloning is unavailable, the established safe streaming fallback
remains available. A filesystem without cloning can still require a full copy.

The ordering is visible in [libuv's implementation](https://github.com/libuv/libuv/blob/v1.52.1/src/unix/fs.c#L1340-L1378).
