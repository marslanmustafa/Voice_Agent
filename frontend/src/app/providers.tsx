"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import { FloatingDialer } from "@/components/FloatingDialer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <FloatingDialer />
      {children}
    </Provider>
  );
}
