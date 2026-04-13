"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { FiMic, FiMicOff, FiPhoneOff, FiActivity, FiLoader, FiAlertCircle, FiVolume2, FiVolumeX, FiUser, FiZap, FiRefreshCw, FiMessageSquare, FiSettings } from "react-icons/fi";
import { RiRobot2Line } from "react-icons/ri";
import { BsSoundwave } from "react-icons/bs";
import Link from "next/link";
import { fmtTime } from "@/lib/utils";
import type { CallStatus } from "@/types";

interface LiveLine { id: string; role: "user" | "assistant"; text: string; isFinal: boolean; }
interface Event    { id: string; icon: React.ReactNode; name: string; time: string; }

const ASSISTANT_ID  = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID  ?? "";
const VAPI_PUB_KEY  = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY    ?? "";

export default function TestPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const vapiRef     = useRef<Vapi | null>(null);
  const scrollRef   = useRef<HTMLDivElement | null>(null);

  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnding,   setIsEnding]   = useState(false);
  const [lines,  setLines]  = useState<LiveLine[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    requestAnimationFrame(() => { if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) el.scrollTop = el.scrollHeight; });
  }, [lines]);

  const pushEvent = useCallback((name: string, icon: React.ReactNode) =>
    setEvents((p) => [{ id: Math.random().toString(36).slice(2), icon, name, time: fmtTime(new Date()) }, ...p].slice(0, 50)), []);

  useEffect(() => {
    if (!VAPI_PUB_KEY) return;
    const vapi = new Vapi(VAPI_PUB_KEY);
    vapiRef.current = vapi;

    vapi.on("call-start", () => { setCallStatus("active"); setIsEnding(false); setLines([]); pushEvent("WebRTC connected", <FiVolume2/>); });
    vapi.on("call-end",   () => { setCallStatus("ended");  setIsSpeaking(false); setIsEnding(false); pushEvent("Session ended", <FiPhoneOff/>); });
    vapi.on("speech-start", () => { setIsSpeaking(true);  pushEvent("Agent speaking", <FiVolume2/>); });
    vapi.on("speech-end",   () => { setIsSpeaking(false); pushEvent("Agent paused",   <FiVolumeX/>); });
    vapi.on("error", () => { setCallStatus("idle"); setIsEnding(false); pushEvent("Error", <FiAlertCircle/>); });
    vapi.on("message", (m: any) => {
      if (m.type === "volume-level") return;
      if (m.type === "transcript") {
        const { role, transcript: text, transcriptType } = m;
        const isFinal = transcriptType === "final";
        setLines((prev) => {
          const idx = [...prev].map((l, i) => ({ l, i })).reverse().find(({ l }) => l.role === role && !l.isFinal);
          if (idx) { const u = [...prev]; u[idx.i] = { ...u[idx.i], text, isFinal }; return u; }
          return [...prev, { id: Math.random().toString(36).slice(2), role, text, isFinal }];
        });
        return;
      }
      if (m.type === "function-call") pushEvent(`Tool: ${m.functionCall?.name}`, <FiZap/>);
    });
    return () => { vapi.stop(); };
  }, [pushEvent]);

  const startCall = useCallback(async () => {
    if (!vapiRef.current || !ASSISTANT_ID) { pushEvent("No assistant ID configured", <FiAlertCircle/>); return; }
    setCallStatus("connecting"); setLines([]); setEvents([]);
    pushEvent("Connecting…", <FiLoader/>);
    try { await (vapiRef.current as any).start(ASSISTANT_ID); }
    catch { setCallStatus("idle"); pushEvent("Connection failed", <FiAlertCircle/>); }
  }, [pushEvent]);

  const endCall = useCallback(() => {
    setIsEnding(true); pushEvent("Disconnecting…", <FiPhoneOff/>);
    vapiRef.current?.stop();
  }, [pushEvent]);

  if (authStatus === "loading" || !session) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)", color: "var(--color-text2)", fontSize: 12 }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent spin mr-3" style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }}/> Loading…
    </div>
  );

  const isLive = callStatus === "active" || callStatus === "connecting" || isEnding;
  const statusLabel = isEnding ? "DISCONNECTING" : callStatus === "connecting" ? "CONNECTING" : callStatus === "active" && isSpeaking ? "AGENT SPEAKING" : callStatus === "active" ? "LISTENING" : callStatus === "ended" ? "SESSION ENDED" : "READY TO TEST";
  const statusColor = (isEnding || callStatus === "connecting") ? "var(--color-amber)" : callStatus === "active" ? "var(--color-cyan)" : "var(--color-text3)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(0,212,255,0.06) 0%, transparent 70%), var(--color-bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-7 py-3.5 border-b" style={{ background: "rgba(13,17,23,0.85)", backdropFilter: "blur(12px)", borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center border" style={{ background: "var(--color-cyan-dim)", borderColor: "rgba(0,212,255,0.2)", color: "var(--color-cyan)" }}><RiRobot2Line size={18}/></div>
          <div><div className="font-bold text-sm" style={{ fontFamily: "var(--font-disp)", color: "#e8f0f8" }}>VoiceAgent</div><div className="text-[10px]" style={{ color: "var(--color-text2)" }}>Agent Test Console</div></div>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest" style={{ background: "var(--color-amber-dim)", color: "var(--color-amber)", borderColor: "rgba(245,166,35,0.3)" }}><FiMessageSquare size={9}/> Test Mode</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-[10px]" style={{ borderColor: "var(--color-border2)", color: statusColor }}>
          <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: statusColor }}/>{statusLabel}
        </div>
        <div className="flex gap-2 ml-auto">
          {[{href:"/dashboard",icon:<FiPhoneOff size={11}/>,label:"Dashboard"},{href:"/settings",icon:<FiSettings size={11}/>,label:"Settings"}].map(({href,icon,label}) => (
            <Link key={href} href={href} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[11px] transition-all" style={{ borderColor: "var(--color-border)", color: "var(--color-text2)", textDecoration: "none" }}>{icon}{label}</Link>
          ))}
        </div>
      </header>

      {/* Banner */}
      <div className="flex items-center gap-3.5 mx-auto w-full max-w-[1100px] px-5 mt-4">
        <div className="w-[34px] h-[34px] rounded-[8px] flex items-center justify-center border flex-shrink-0" style={{ background: "var(--color-amber-dim)", borderColor: "rgba(245,166,35,0.2)", color: "var(--color-amber)" }}><RiRobot2Line size={14}/></div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-text2)" }}>
          <strong style={{ color: "var(--color-text)" }}>WebRTC Test Mode</strong> — Connects directly via browser. No phone call is made. Use this to test voice, prompts, and behavior.
        </p>
      </div>

      {/* Main */}
      <main className="flex-1 grid mx-auto w-full max-w-[1100px] px-5 py-7 gap-6" style={{ gridTemplateColumns: "1fr 300px", alignItems: "start" }}>
        <section className="flex flex-col items-center gap-5">
          {/* Mic hero */}
          <div className="relative flex items-center justify-center w-[160px] h-[160px] flex-shrink-0">
            {isLive && [1,2,3].map((i) => (
              <div key={i} className="absolute rounded-full border" style={{ width: `${70+i*30}%`, height: `${70+i*30}%`, borderColor: "var(--color-cyan)", animation: `ring-expand 2.4s ease-out ${(i-1)*0.8}s infinite` }}/>
            ))}
            <button
              onClick={isLive ? endCall : startCall}
              disabled={callStatus === "connecting" || isEnding}
              className="relative z-10 w-[90px] h-[90px] rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: isEnding ? "var(--color-amber)" : isLive ? "var(--color-cyan)" : "var(--color-border2)",
                background:  isEnding ? "var(--color-amber-dim)" : isLive ? "var(--color-cyan-dim)" : "var(--color-bg3)",
                color:       isEnding ? "var(--color-amber)" : isLive ? "var(--color-cyan)" : "var(--color-text2)",
                boxShadow:   isLive ? `0 0 40px ${isEnding ? "rgba(245,166,35,0.3)" : "var(--color-cyan-glow)"}` : "0 4px 24px rgba(0,0,0,0.4)",
              }}>
              {isEnding || callStatus === "connecting" ? <FiLoader size={30} className="spin"/> : isLive ? <FiMicOff size={30}/> : <FiMic size={30}/>}
            </button>
          </div>

          {/* Wave */}
          <div className="flex items-center gap-0.5 h-8">
            {Array.from({length:18}).map((_,i) => (
              <div key={i} className="w-0.5 rounded-sm transition-colors" style={{
                height: callStatus === "active" ? undefined : "6px",
                background: callStatus === "active" ? "var(--color-cyan)" : "var(--color-border2)",
                animation: callStatus === "active" ? `wave-bar 0.9s ease-in-out ${i*0.06}s infinite alternate` : "none",
              }}/>
            ))}
          </div>

          <p className="text-xs text-center" style={{ color: "var(--color-text2)" }}>
            {callStatus === "idle" ? "Tap the mic to start a test session" : callStatus === "connecting" ? "Establishing WebRTC connection…" : callStatus === "active" ? (isSpeaking ? "Agent is responding…" : "Speak now — agent is listening") : "Test session complete."}
          </p>

          {callStatus === "ended" && (
            <button onClick={() => { setCallStatus("idle"); setLines([]); setEvents([]); }} className="flex items-center gap-2 px-6 py-2.5 rounded-full border text-xs font-semibold transition-all"
              style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text)", cursor: "pointer" }}>
              <FiRefreshCw size={12}/> Start New Session
            </button>
          )}

          {/* Transcript */}
          {(callStatus === "active" || callStatus === "ended") && lines.length > 0 && (
            <div className="w-full rounded-[16px] border overflow-hidden" style={{ background: "rgba(13,17,23,0.65)", borderColor: "rgba(0,212,255,0.2)", backdropFilter: "blur(10px)" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--color-border)", color: "var(--color-text2)" }}>
                <BsSoundwave size={13}/> <span style={{ color: "var(--color-text)" }}>Live Transcript</span>
                {callStatus === "active" && <span className="w-1.5 h-1.5 rounded-full ml-auto pulse-dot" style={{ background: "var(--color-green)" }}/>}
              </div>
              <div ref={scrollRef} className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ maxHeight: "min(320px,40vh)" }}>
                {lines.map((l) => (
                  <div key={l.id} className="flex flex-col gap-1 max-w-[88%] px-3 py-2 rounded-[10px] border text-xs fade-in-up"
                    style={{
                      alignSelf:   l.role === "user" ? "flex-end" : "flex-start",
                      background:  l.role === "user" ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)",
                      borderColor: l.role === "user" ? "rgba(0,212,255,0.18)" : "var(--color-border)",
                      opacity:     l.isFinal ? 1 : 0.6,
                    }}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1" style={{ color: "var(--color-text2)" }}>
                      {l.role === "assistant" ? <><RiRobot2Line size={9}/> Agent</> : <><FiUser size={9}/> You</>}
                    </span>
                    <span style={{ color: "var(--color-text)" }}>{l.text}{!l.isFinal && <span className="inline-block ml-0.5" style={{ color: "var(--color-cyan)", animation: "blink 0.75s step-end infinite" }}>▍</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {(callStatus === "active" || callStatus === "ended") && (
            <div className="w-full rounded-[16px] border overflow-hidden" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--color-border)", color: "var(--color-text2)" }}>
                <FiActivity size={12}/> <span style={{ color: "var(--color-text)" }}>Session Summary</span>
              </div>
              <div className="flex">
                {[["Messages", lines.filter(l=>l.isFinal).length],["Status", callStatus]].map(([label,val]) => (
                  <div key={label as string} className="flex-1 flex flex-col items-center gap-1 py-4 border-r last:border-0" style={{ borderColor: "var(--color-border)" }}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text3)" }}>{label}</span>
                    <span className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 sticky top-20">
          <div className="rounded-[16px] border overflow-hidden" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--color-border)", color: "var(--color-text2)" }}>
              <RiRobot2Line size={12}/> <span style={{ color: "var(--color-text)" }}>Config</span>
            </div>
            <div className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
              {[["Assistant ID", ASSISTANT_ID ? `${ASSISTANT_ID.split("-")[0]}…` : "Not set"],["Status", callStatus === "active" ? "Live" : "Idle"]].map(([k,v]) => (
                <div key={k as string} className="flex justify-between px-4 py-2.5 text-[11px]">
                  <span style={{ color: "var(--color-text2)" }}>{k}</span>
                  <span className="font-medium" style={{ color: k === "Status" && callStatus === "active" ? "var(--color-green)" : "var(--color-text)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[16px] border overflow-hidden flex-1" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--color-border)", color: "var(--color-text2)" }}>
              <FiActivity size={12}/> <span style={{ color: "var(--color-text)" }}>Event Log</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
              {!events.length ? <div className="p-4 text-center text-[11px]" style={{ color: "var(--color-text3)" }}>Awaiting events…</div> : events.map((e) => (
                <div key={e.id} className="flex items-start gap-2.5 px-4 py-2.5 border-b last:border-0" style={{ borderColor: "var(--color-border)" }}>
                  <span className="w-6 h-6 rounded-[7px] border flex items-center justify-center text-xs flex-shrink-0" style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text2)" }}>{e.icon}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px]" style={{ color: "var(--color-text)" }}>{e.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--color-text3)" }}>{e.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <footer className="text-center py-4 text-[10px] border-t" style={{ borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
        VoiceAgent Test Console ·{" "}
        <Link href="https://m-arslan-portfolio.vercel.app/" target="_blank" style={{ color: "var(--color-text2)" }}>Muhammad Arslan</Link>
      </footer>
    </div>
  );
}
