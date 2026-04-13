import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface TranscriptSegment {
  speaker:   "agent" | "user";
  text:      string;
  timestamp: number;
}

interface CallsState {
  activeCallId:    string | null;
  liveTranscript:  Record<string, TranscriptSegment[]>;
}

const initialState: CallsState = { activeCallId: null, liveTranscript: {} };

const callsSlice = createSlice({
  name: "calls",
  initialState,
  reducers: {
    setActiveCall(state, action: PayloadAction<string | null>) {
      state.activeCallId = action.payload;
    },
    appendTranscript(state, action: PayloadAction<{ callId: string; segment: TranscriptSegment }>) {
      const { callId, segment } = action.payload;
      if (!state.liveTranscript[callId]) state.liveTranscript[callId] = [];
      state.liveTranscript[callId].push(segment);
    },
    clearTranscript(state, action: PayloadAction<string>) {
      delete state.liveTranscript[action.payload];
    },
  },
});

export const { setActiveCall, appendTranscript, clearTranscript } = callsSlice.actions;
export default callsSlice.reducer;
