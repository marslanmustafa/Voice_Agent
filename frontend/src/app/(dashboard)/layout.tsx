"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { FiHome, FiUsers, FiRadio, FiPhone, FiSettings, FiLogOut, FiArrowRight } from "react-icons/fi";
import { RiRobot2Line } from "react-icons/ri";

const NAV = [
  { href: "/dashboard", icon: FiHome,     label: "Overview"     },
  { href: "/contacts",  icon: FiUsers,    label: "Contacts"     },
  { href: "/campaigns", icon: FiRadio,    label: "Campaigns"    },
  { href: "/calls",     icon: FiPhone,    label: "Call History" },
  { href: "/dialer",    icon: FiPhone,    label: "Dialer"       },
  { href: "/settings",  icon: FiSettings, label: "Settings"     },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--color-bg)", color: "var(--color-text2)", fontSize: 12 }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent spin" style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }} />
      <span>Loading…</span>
    </div>
  );

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center gap-4 px-6 py-3 border-b"
        style={{ background: "rgba(13,17,23,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center border"
            style={{ background: "var(--color-cyan-dim)", borderColor: "rgba(0,212,255,0.2)", color: "var(--color-cyan)" }}>
            <RiRobot2Line size={18} />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ fontFamily: "var(--font-disp)", color: "#e8f0f8" }}>VoiceAgent</div>
            <div className="text-[10px]" style={{ color: "var(--color-text2)" }}>AI Calling Platform</div>
          </div>
        </div>

        <Link href="/campaigns"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-xs font-bold transition-all hover:-translate-y-px ml-2"
          style={{ background: "var(--color-cyan)", color: "#000" }}>
          <FiRadio size={11} /> New Campaign <FiArrowRight size={10} />
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px]" style={{ color: "var(--color-text2)" }}>
            {session.user?.email}
          </span>
          <button onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-[11px] transition-all"
            style={{ border: "1px solid var(--color-border)", background: "none", color: "var(--color-text2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-red)"; e.currentTarget.style.color = "var(--color-red)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-text2)"; }}>
            <FiLogOut size={11} /> Sign Out
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[210px] flex-shrink-0 flex flex-col border-r sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto"
          style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
          <div className="px-4 pt-3.5 pb-2 text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--color-text3)" }}>
            Navigation
          </div>
          <nav className="flex flex-col gap-0.5 px-2 flex-1">
            {NAV.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-xs transition-all relative"
                  style={{
                    background: active ? "var(--color-cyan-dim)" : "transparent",
                    color:      active ? "var(--color-cyan)"    : "var(--color-text2)",
                    border:     active ? "1px solid rgba(0,212,255,0.15)" : "1px solid transparent",
                  }}>
                  <Icon size={14} />
                  <span className="flex-1">{label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-cyan)" }} />}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 mt-auto border-t" style={{ borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--color-text3)" }}>
              <RiRobot2Line size={13} /> VoiceAgent v2.0
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8 min-h-[calc(100vh-57px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
