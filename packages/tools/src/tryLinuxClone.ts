import { execFile as execFileCallback } from "node:child_process"
import { promisify } from "node:util"

// libuv chmods before its clone ioctl. On restricted NFSv4 ACLs that
// fails before any data is cloned. The image already includes Python;
// this content-only Linux path creates with inherited permissions and
// never chmods or changes the source. Other systems use the usual copy.
const cloneProgram = `import fcntl, os, sys
source = os.open(sys.argv[1], os.O_RDONLY)
destination = None
is_complete = False
try:
    destination = os.open(sys.argv[2], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o666)
    fcntl.ioctl(destination, 0x40049409, source)
    os.fsync(destination)
    is_complete = True
finally:
    os.close(source)
    if destination is not None:
        os.close(destination)
        if not is_complete:
            os.unlink(sys.argv[2])
`

const execFile = promisify(execFileCallback)

export const tryLinuxClone = ({
  source,
  destination,
  platform = process.platform,
}: {
  source: string
  destination: string
  platform?: NodeJS.Platform
}) =>
  platform === "linux"
    ? execFile(
        "python3",
        ["-c", cloneProgram, source, destination],
        { timeout: 60_000, maxBuffer: 16_384 },
      ).then(
        () => true,
        () => false,
      )
    : Promise.resolve(false)
