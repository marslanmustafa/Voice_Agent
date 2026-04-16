import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { appendTranscript } from "@/store/slices/callsSlice";

export function useLiveTranscript(callId: string | null, controlUrl?: string | null) {
  const dispatch = useAppDispatch();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!callId) return;

    // Prefer Vapi's controlUrl if provided (enables real-time transcript events),
    // otherwise fall back to the local backend WS proxy.
    const url = controlUrl ?? `${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000"}/ws/${callId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Vapi emits { type: "transcript", role: "user"|"assistant", transcript: "..." }
        if (data.type === "transcript" && data.transcript) {
          dispatch(appendTranscript({
            callId,
            segment: {
              speaker: data.role === "user" ? "user" : "agent",
              text: data.transcript,
              timestamp: data.timestamp ?? Date.now(),
            },
          }));
        }
        // Local backend proxy format: { type: "transcript", speaker, text, timestamp }
        if (data.type === "transcript" && data.text && !data.transcript) {
          dispatch(appendTranscript({
            callId,
            segment: { speaker: data.speaker, text: data.text, timestamp: data.timestamp ?? 0 },
          }));
        }
      } catch { /* ignore malformed frames */ }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [callId, controlUrl, dispatch]);
}

export function useCallTimer(isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      ref.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
      if (elapsed > 0) { const t = setTimeout(() => setElapsed(0), 500); return () => clearTimeout(t); }
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [isActive]); // eslint-disable-line

  return elapsed;
}
