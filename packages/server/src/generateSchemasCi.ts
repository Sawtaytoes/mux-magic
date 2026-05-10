import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

import { PORT } from './tools/port.js'

const openApiUrl = `http://localhost:${PORT}/openapi.json`

const waitForServer = (
  timeout: number,
) => {
  const deadline = Date.now() + timeout

  const poll = (): Promise<void> => (
    fetch(openApiUrl)
    .then(() => undefined)
    .catch(() => {
      if (Date.now() >= deadline) {
        throw new Error(`Server not ready after ${timeout}ms`)
      }

      return (
        new Promise<void>((
          resolve,
        ) => {
          setTimeout(resolve, 500)
        })
        .then(poll)
      )
    })
  )

  return poll()
}

const generateSchemasCi = async () => {
  const serverProcess = spawn(
    'tsx',
    [
      '--env-file',
      './.env',
      'packages/server/src/server.ts',
    ],
    { stdio: 'inherit' },
  )

  try {
    await waitForServer(30_000)

    const ast = await openapiTS(new URL(openApiUrl))

    await mkdir(
      './packages/web/src/api',
      { recursive: true },
    )

    await writeFile(
      './packages/web/src/api/schema.generated.ts',
      astToString(ast),
    )

    console
    .log(
      'Updated web API schema.',
    )
  }
  finally {
    serverProcess.kill()
  }
}

generateSchemasCi()
.catch((
  error,
) => {
  console
  .error(error)

  process
  .exit(1)
})
