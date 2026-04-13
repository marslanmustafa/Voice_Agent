"use client";
import Link from "next/link";
import { RiRobot2Line } from "react-icons/ri";
import { FiArrowLeft } from "react-icons/fi";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ background: "var(--color-bg)" }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 30% at 50% -5%, rgba(0,212,255,0.08) 0%, transparent 60%)" }} />

      {/* Header */}
      <header className="relative z-10 flex items-center px-7 py-4 border-b"
        style={{ borderColor: "var(--color-border)", background: "rgba(13,17,23,0.7)", backdropFilter: "blur(10px)" }}>
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
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-5">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-between px-7 py-4 border-t text-[10px]"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
        <Link href="/" className="flex items-center gap-1 transition-colors hover:text-[var(--color-text2)]">
          <FiArrowLeft size={11} /> Back to home
        </Link>
        <span>VoiceAgent AI Calling Platform</span>
      </footer>
    </div>
  );
}
