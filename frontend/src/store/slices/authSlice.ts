import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@/types";

interface AuthState {
  user:        User | null;
  accessToken: string | null;
  isLoading:   boolean;
}

const initialState: AuthState = {
  user:        null,
  accessToken: null,
  isLoading:   true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.user        = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isLoading   = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    logout(state) {
      state.user        = null;
      state.accessToken = null;
      state.isLoading   = false;
    },
  },
});

export const { setCredentials, setLoading, logout } = authSlice.actions;
export default authSlice.reducer;
