import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface TranscriptSegment {
  speaker:   "agent" | "user";
  text:      string;
  timestamp: number;
}

export type CallStatus =
  | "queued" | "ringing" | "in-progress" | "forwarding"
  | "ended" | "no-answer" | "busy" | "failed" | "canceled"
  | "connected" | "voicemail" | "completed";

interface CallsState {
  activeCallId:    string | null;
  liveTranscript:  Record<string, TranscriptSegment[]>;
  callStatuses:    Record<string, CallStatus>;
  callSummaries:   Record<string, string | null>;
  callRecordings:  Record<string, string | null>;
}

const initialState: CallsState = {
  activeCallId:    null,
  liveTranscript:  {},
  callStatuses:    {},
  callSummaries:   {},
  callRecordings:  {},
};

const callsSlice = createSlice({
  name: "calls",
  initialState,
  reducers: {
    setActiveCall(state, action: PayloadAction<string | null>) {
      state.activeCallId = action.payload;
    },

    setCallStatus(state, action: PayloadAction<{ callId: string; status: CallStatus }>) {
      state.callStatuses[action.payload.callId] = action.payload.status;
    },

    appendTranscriptSegment(
      state,
      action: PayloadAction<{ callId: string; segment: TranscriptSegment }>,
    ) {
      const { callId, segment } = action.payload;
      if (!state.liveTranscript[callId]) {
        state.liveTranscript[callId] = [];
      }
      state.liveTranscript[callId].push(segment);
    },

    setCallEnded(
      state,
      action: PayloadAction<{
        callId: string;
        summary?: string;
        recordingUrl?: string;
      }>,
    ) {
      const { callId, summary, recordingUrl } = action.payload;
      state.callStatuses[callId] = "ended";
      if (summary) state.callSummaries[callId] = summary;
      if (recordingUrl) state.callRecordings[callId] = recordingUrl;
    },

    clearTranscript(state, action: PayloadAction<string>) {
      delete state.liveTranscript[action.payload];
    },
  },
});

export const {
  setActiveCall,
  setCallStatus,
  appendTranscriptSegment,
  setCallEnded,
  clearTranscript,
} = callsSlice.actions;
export default callsSlice.reducer;
