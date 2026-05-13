import { useEffect, useRef } from "react"

type DisconnectInfo = { isFinal: boolean }

type Options<T> = {
  url: string
  isEnabled?: boolean
  graceMs?: number
  onMessage?: (data: T, event: MessageEvent) => void
  onConnected?: () => void
  onPossiblyDisconnected?: (info: DisconnectInfo) => void
}

// Wraps EventSource with tolerant-reconnect behaviour: onPossiblyDisconnected
// only fires after graceMs of continuous CONNECTING state, so brief blips are
// invisible to the UI. Callback refs prevent re-running when handler identities change.
export const useTolerantEventSource = <T>({
  url,
  isEnabled = true,
  graceMs = 5000,
  onMessage,
  onConnected,
  onPossiblyDisconnected,
}: Options<T>): void => {
  const onMessageRef = useRef(onMessage)
  const onConnectedRef = useRef(onConnected)
  const onDisconnectedRef = useRef(onPossiblyDisconnected)
  onMessageRef.current = onMessage
  onConnectedRef.current = onConnected
  onDisconnectedRef.current = onPossiblyDisconnected

  useEffect(() => {
    if (!isEnabled) return

    const es = new EventSource(url)
    let lostTimer: ReturnType<typeof setTimeout> | null =
      null

    const clearLostTimer = () => {
      if (lostTimer !== null) {
        clearTimeout(lostTimer)
        lostTimer = null
      }
    }

    es.onopen = () => {
      clearLostTimer()
      onConnectedRef.current?.()
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as T
        onMessageRef.current?.(data, event)
      } catch {
        // silently drop malformed JSON
      }
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        clearLostTimer()
        onDisconnectedRef.current?.({ isFinal: true })
        return
      }
      if (lostTimer !== null) return
      lostTimer = setTimeout(() => {
        lostTimer = null
        onDisconnectedRef.current?.({ isFinal: false })
      }, graceMs)
    }

    return () => {
      clearLostTimer()
      es.close()
    }
  }, [url, isEnabled, graceMs])
}
