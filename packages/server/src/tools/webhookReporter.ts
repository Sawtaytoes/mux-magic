const postWebhook = async (
  url: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })

    if (!response.ok) {
      console.warn(
        `[webhookReporter] POST ${url} returned ${response.status} — ignoring`,
      )
    }
  } catch (error) {
    console.warn(
      `[webhookReporter] POST ${url} failed: ${String(error)} — ignoring`,
    )
  }
}

export const reportJobStarted = async ({
  commandName,
  jobId,
  source,
}: {
  commandName: string
  jobId: string
  source: "sequence" | "step"
}): Promise<void> => {
  const url = process.env.WEBHOOK_JOB_STARTED_URL
  if (!url) return

  await postWebhook(url, {
    jobId,
    source,
    type: commandName,
  })
}

export const reportJobCompleted = async ({
  commandName,
  completedAt,
  jobId,
  resultCount,
  startedAt,
}: {
  commandName: string
  completedAt: Date
  jobId: string
  resultCount: number
  startedAt: Date | null
}): Promise<void> => {
  const url = process.env.WEBHOOK_JOB_COMPLETED_URL
  if (!url) return

  const durationMs =
    startedAt !== null
      ? completedAt.getTime() - startedAt.getTime()
      : null

  await postWebhook(url, {
    jobId,
    summary: { durationMs, resultCount },
    type: commandName,
  })
}

export const reportJobFailed = async ({
  commandName,
  error,
  jobId,
}: {
  commandName: string
  error: string
  jobId: string
}): Promise<void> => {
  const url = process.env.WEBHOOK_JOB_FAILED_URL
  if (!url) return

  await postWebhook(url, {
    error: { message: error },
    jobId,
    type: commandName,
  })
}
