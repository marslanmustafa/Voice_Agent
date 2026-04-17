"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { SessionProvider, useSession } from "next-auth/react";
import { store } from "@/store";
import { setCredentials, setLoading } from "@/store/slices/authSlice";
import { FloatingDialer } from "@/components/FloatingDialer";

function TokenSync() {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "loading") return;
    if (session && (session as any).accessToken) {
      store.dispatch(setCredentials({
        user: session.user as any,
        accessToken: (session as any).accessToken,
      }));
    } else {
      store.dispatch(setLoading(false));
    }
  }, [session, status]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        <TokenSync />
        <FloatingDialer />
        {children}
      </Provider>
    </SessionProvider>
  );
}
