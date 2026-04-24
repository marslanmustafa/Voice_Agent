import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  statusUpdated,
  callEnded,
  appendTranscript,
  setError,
  setSpeaking,
  CallStatus,
} from "@/store/slices/activeCallSlice";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// How long to wait before reconnecting after an unexpected disconnect
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECTS = 5;

export function useCallStream(callId: string | null): void {
  const dispatch = useAppDispatch();
  const esRef = useRef<EventSource | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!callId) return;

    function connect() {
      // Clean up any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      // No token needed — auth-free SSE stream
      const url = `${API_BASE}/calls/${callId}/stream`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        reconnectCount.current = 0; // reset on successful connect
        console.log("[useCallStream] SSE connection established for call:", callId);
      };

      es.onmessage = (event) => {
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return; // malformed frame
        }

        const type = payload.type as string;
        console.log(`[useCallStream] Received: ${type}`, payload);

        switch (type) {
          // ── Connection confirmed ───────────────────────────────────
          case "connected":
            break;

          // ── Live transcript segment ────────────────────────────────
          case "transcript": {
            const text = (payload.text as string) ?? "";
            if (!text) break;
            dispatch(
              appendTranscript({
                speaker: payload.speaker === "user" ? "user" : "agent",
                text,
                timestamp: (payload.timestamp as number | null) ?? null,
                secs: (payload.secs as number | null) ?? null,
                isPartial: (payload.is_partial as boolean) ?? false,
              })
            );
            break;
          }

          // ── Status changed ────────────────────────────────────────
          // Both "status" and "status-update" are handled for compatibility
          case "status":
          case "status-update": {
            const status = payload.status as CallStatus;
            if (status) dispatch(statusUpdated({ status }));
            break;
          }

          // ── Call ended (terminal) ─────────────────────────────────
          case "call-ended":
          case "end-of-call": {
            dispatch(setSpeaking({ role: null }));
            dispatch(
              callEnded({
                reason: payload.reason as string | undefined,
                recordingUrl: payload.recording_url as string | null | undefined,
                summary: payload.summary as string | null | undefined,
              })
            );
            // No reconnect — call is done
            es.close();
            esRef.current = null;
            break;
          }

          // ── Stream closed (bridge disconnected) ───────────────────
          case "stream-closed": {
            es.close();
            esRef.current = null;
            break;
          }

          // ── Speech update — live talking indicator ─────────────────
          case "speech-update": {
            const role = payload.role as string;
            const status = payload.status as string;
            if (status === "started") {
              dispatch(setSpeaking({ role: role === "user" ? "user" : "agent" }));
            } else {
              dispatch(setSpeaking({ role: null }));
            }
            break;
          }

          // ── User interrupted assistant ─────────────────────────────
          case "user-interrupted": {
            dispatch(setSpeaking({ role: null }));
            break;
          }

          // ── Ignore other non-critical events ──────────────────────
          default:
            break;
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (reconnectCount.current < MAX_RECONNECTS) {
          reconnectCount.current += 1;
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          dispatch(setError("Lost connection to call stream"));
        }
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [callId, dispatch]);
}