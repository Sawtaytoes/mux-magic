/**
 * How long one webhook delivery may take before it is aborted. A webhook
 * receiver such as Home Assistant answers in well under a second; this
 * bound only stops a receiver that accepts the connection and never
 * answers from holding the POST open for Node's default socket timeouts.
 */
export const webhookTimeoutMilliseconds = 10_000

export type WebhookDeliveryResult =
  /** The receiver answered with a 2xx status. */
  | { outcome: "delivered"; status: number }
  /** The receiver answered with any other status. */
  | { outcome: "rejected"; status: number }
  /** No answer: a network error, a timeout, or a body that would not serialize. */
  | { error: unknown; outcome: "failed" }

/**
 * POST `body` as JSON to `url`, bounded by a timeout.
 *
 * The returned promise never rejects, so a caller can fire and forget it
 * without an unhandled rejection. `fetch` is called synchronously, before
 * this function returns. Each caller decides how to log the result.
 */
export const postJsonWebhook = ({
  body,
  timeoutMilliseconds = webhookTimeoutMilliseconds,
  url,
}: {
  body: unknown
  timeoutMilliseconds?: number
  url: string
}): Promise<WebhookDeliveryResult> =>
  new Promise<Response>((resolve) => {
    resolve(
      fetch(url, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(timeoutMilliseconds),
      }),
    )
  })
    .then(
      (response): WebhookDeliveryResult =>
        response.ok
          ? {
              outcome: "delivered",
              status: response.status,
            }
          : {
              outcome: "rejected",
              status: response.status,
            },
    )
    .catch(
      (error: unknown): WebhookDeliveryResult => ({
        error,
        outcome: "failed",
      }),
    )
