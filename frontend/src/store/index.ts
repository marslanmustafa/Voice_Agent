import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "./api/baseApi";
import authReducer from "./slices/authSlice";
import callsReducer from "./slices/callsSlice";
import uiReducer from "./slices/uiSlice";
import activeCallSlice from "./slices/activeCallSlice";

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth:  authReducer,
    calls: callsReducer,
    ui:    uiReducer,
    activeCall: activeCallSlice,
  },
  middleware: (gDM) => gDM().concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState  = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
