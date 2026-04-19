/**
 * activeCallSlice.ts
 *
 * Global state for the currently active call.
 * Lives outside the calls list so the floating dialer survives
 * page navigation without losing call state or transcript.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type CallStatus =
  | "idle"
  | "dialing"
  | "ringing"
  | "active"
  | "ended"
  | "failed"
  | "no-answer"
  | "busy"
  | "cancelled";

export interface TranscriptSegment {
  speaker: "user" | "agent";
  text: string;
  timestamp: number | string | null;
  isPartial?: boolean;
}

export interface ActiveCallState {
  callId: string | null;
  phone: string;
  status: CallStatus;
  startedAt: number | null;       // unix ms — used to drive the call timer
  listenUrl: string | null;
  controlUrl: string | null;
  transcript: TranscriptSegment[];
  recordingUrl: string | null;
  summary: string | null;
  isMuted: boolean;
  isOnHold: boolean;
  error: string | null;
}

const initialState: ActiveCallState = {
  callId: null,
  phone: "",
  status: "idle",
  startedAt: null,
  listenUrl: null,
  controlUrl: null,
  transcript: [],
  recordingUrl: null,
  summary: null,
  isMuted: false,
  isOnHold: false,
  error: null,
};

const activeCallSlice = createSlice({
  name: "activeCall",
  initialState,
  reducers: {
    // ── Lifecycle ──────────────────────────────────────────────────────────

    /** Called right after POST /calls/dial succeeds */
    callInitiated(
      state,
      action: PayloadAction<{
        callId: string;
        phone: string;
        listenUrl: string | null;
        controlUrl: string | null;
      }>
    ) {
      state.callId = action.payload.callId;
      state.phone = action.payload.phone;
      state.status = "dialing";
      state.startedAt = null;
      state.listenUrl = action.payload.listenUrl;
      state.controlUrl = action.payload.controlUrl;
      state.transcript = [];
      state.recordingUrl = null;
      state.summary = null;
      state.isMuted = false;
      state.isOnHold = false;
      state.error = null;
    },

    /** Call status changed — drives dialing → ringing → active → ended */
    statusUpdated(state, action: PayloadAction<{ status: CallStatus }>) {
      state.status = action.payload.status;

      // Capture the moment call becomes active for the timer
      if (action.payload.status === "active" && !state.startedAt) {
        state.startedAt = Date.now();
      }
    },

    /** Terminal — call ended (any reason) */
    callEnded(
      state,
      action: PayloadAction<{
        reason?: string;
        recordingUrl?: string | null;
        summary?: string | null;
      }>
    ) {
      state.status = "ended";
      if (action.payload.recordingUrl) state.recordingUrl = action.payload.recordingUrl;
      if (action.payload.summary) state.summary = action.payload.summary;
    },

    /** Load a historical call into the dialer for review */
    loadHistoricCall(
      state,
      action: PayloadAction<{
        callId: string;
        phone: string;
        status: CallStatus;
        transcript: TranscriptSegment[];
        summary?: string | null;
        recordingUrl?: string | null;
      }>
    ) {
      state.callId = action.payload.callId;
      state.phone = action.payload.phone;
      state.status = action.payload.status;
      state.transcript = action.payload.transcript;
      state.summary = action.payload.summary || null;
      state.recordingUrl = action.payload.recordingUrl || null;
      state.startedAt = null;
      state.listenUrl = null;
      state.controlUrl = null;
      state.isMuted = false;
      state.isOnHold = false;
      state.error = null;
    },

    /** Hard reset back to idle (after user dismisses the ended call panel) */
    resetCall() {
      return initialState;
    },

    // ── Transcript ─────────────────────────────────────────────────────────

    appendTranscript(state, action: PayloadAction<TranscriptSegment>) {
      const seg = action.payload;
      console.log("[activeCallSlice] appendTranscript:", seg);
      console.log("[activeCallSlice] Current state transcript length:", state.transcript.length);

      if (seg.isPartial) {
        // Replace the last partial from the same speaker, or append
        const lastIdx = state.transcript.length - 1;
        if (
          lastIdx >= 0 &&
          state.transcript[lastIdx].isPartial &&
          state.transcript[lastIdx].speaker === seg.speaker
        ) {
          state.transcript[lastIdx] = seg;
        } else {
          state.transcript.push(seg);
        }
      } else {
        // Finalize: replace last partial if it exists, otherwise append
        const lastIdx = state.transcript.length - 1;
        if (
          lastIdx >= 0 &&
          state.transcript[lastIdx].isPartial &&
          state.transcript[lastIdx].speaker === seg.speaker
        ) {
          state.transcript[lastIdx] = { ...seg, isPartial: false };
        } else {
          state.transcript.push({ ...seg, isPartial: false });
        }
      }
      console.log("[activeCallSlice] New state transcript length:", state.transcript.length);
    },

    // ── Controls ───────────────────────────────────────────────────────────

    setMuted(state, action: PayloadAction<boolean>) {
      state.isMuted = action.payload;
    },

    setOnHold(state, action: PayloadAction<boolean>) {
      state.isOnHold = action.payload;
    },

    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.status = "failed";
    },
  },
});

export const {
  callInitiated,
  statusUpdated,
  callEnded,
  loadHistoricCall,
  resetCall,
  appendTranscript,
  setMuted,
  setOnHold,
  setError,
} = activeCallSlice.actions;

export default activeCallSlice.reducer;