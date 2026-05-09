import { useEffect, useRef } from "react";

type SseMessage = Record<string, unknown>;

type UseTolerantEventSourceOptions = {
  onMessage: (data: SseMessage) => void;
  onPossiblyDisconnected: () => void;
};

// Maximum number of reconnect attempts before calling onPossiblyDisconnected.
const MAX_RETRIES = 3;
// Delay (ms) between reconnect attempts.
const RETRY_DELAY_MS = 2000;

/**
 * Opens a persistent SSE connection to `url`. Reconnects up to MAX_RETRIES
 * times on error before calling `onPossiblyDisconnected`. The connection is
 * closed and cleaned up when the component unmounts or `url` changes.
 *
 * Pass `null` as `url` to keep the hook mounted but idle (no connection open).
 */
const useTolerantEventSource = (
  url: string | null,
  { onMessage, onPossiblyDisconnected }: UseTolerantEventSourceOptions,
) => {
  // Store callbacks in refs so callers can pass inline lambdas without
  // needing to memoize — stale closures are the silent bug here.
  const onMessageRef = useRef(onMessage);
  const onDisconnectedRef = useRef(onPossiblyDisconnected);
  onMessageRef.current = onMessage;
  onDisconnectedRef.current = onPossiblyDisconnected;

  useEffect(() => {
    if (!url) return;

    let es: EventSource | null = null;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource(url);

      es.onmessage = (event) => {
        retries = 0;
        try {
          const data = JSON.parse(event.data) as SseMessage;
          onMessageRef.current(data);
        } catch {
          // Malformed JSON — skip without crashing the stream.
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        retries += 1;
        if (retries >= MAX_RETRIES) {
          onDisconnectedRef.current();
          return;
        }
        retryTimer = setTimeout(connect, RETRY_DELAY_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      es?.close();
    };
  }, [url]);
};

export { useTolerantEventSource };
