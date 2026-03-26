import { useEffect, useRef, useCallback } from 'react';

type SSEEvent = {
  type: 'file_changed' | 'sprint_updated' | 'ticket_updated' | 'agent_status' | 'ping';
  payload?: unknown;
};

interface UseEventSourceOptions {
  url?: string;
  onEvent?: (event: SSEEvent) => void;
  enabled?: boolean;
}

export function useEventSource({
  url = '/api/events',
  onEvent,
  enabled = true,
}: UseEventSourceOptions = {}) {
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!enabled) return;

    esRef.current?.close();
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      retryDelay.current = 1000;
    };

    es.onmessage = (e: MessageEvent) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        onEventRef.current?.(event);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      const delay = Math.min(retryDelay.current, 30_000);
      retryDelay.current = Math.min(delay * 2, 30_000);
      retryRef.current = setTimeout(connect, delay);
    };
  }, [url, enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);
}
