"use client";

import { useEffect, useState } from "react";
import { FiPhone, FiMic, FiClock, FiPlay, FiChevronRight, FiRadio } from "react-icons/fi";
import { useGetCallsQuery, useGetCallQuery } from "@/store/api/allApis";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fmtDuration } from "@/lib/utils";

// ─── Status colour map ──────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  completed: "var(--color-green)",
  active: "var(--color-cyan)",
  dialing: "var(--color-amber)",
  ringing: "var(--color-amber)",
  failed: "var(--color-red)",
  "no-answer": "var(--color-text2)",
  busy: "var(--color-red)",
  cancelled: "var(--color-text3)",
  voicemail: "var(--color-text2)",
  queued: "var(--color-text3)",
};

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CallsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, refetch } = useGetCallsQuery({});
  const activeCall = useAppSelector((s) => s.activeCall);

  // Auto-refresh list when current active call ends
  useEffect(() => {
    if (activeCall.status === "ended") {
      const timer = setTimeout(refetch, 1500); // small delay for Vapi to settle
      return () => clearTimeout(timer);
    }
  }, [activeCall.status, refetch]);

  const calls = data?.calls ?? [];

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1
          className="text-[20px] font-bold"
          style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}
        >
          Call History
        </h1>
        <span className="text-[11px]" style={{ color: "var(--color-text3)" }}>
          {calls.length} call{calls.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* ── Call List ─────────────────────────────────────────────────── */}
        <div className="h-[calc(100vh-132px)] flex flex-col gap-1 overflow-scroll">
          {isLoading ? (
            <div className="text-center p-6 text-xs" style={{ color: "var(--color-text3)" }}>
              Loading…
            </div>
          ) : !calls.length ? (
            <div className="text-center p-6 text-xs" style={{ color: "var(--color-text3)" }}>
              No calls yet
            </div>
          ) : (
            calls.map((c: any) => {
              const isLive =
                activeCall.callId === c.id && activeCall.status === "active";

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border w-full text-left transition-all"
                  style={{
                    background: isLive ? "var(--color-cyan-dim)" : "var(--color-bg2)",
                    borderColor: isLive ? "rgba(0,212,255,0.25)" : "var(--color-border)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-[8px] border flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "var(--color-bg3)",
                      borderColor: "var(--color-border2)",
                      color: STATUS_COLOR[c.status] ?? "var(--color-text2)",
                    }}
                  >
                    {isLive ? <FiRadio size={13} /> : <FiPhone size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "var(--color-text)" }}
                    >
                      {c.phone_to}
                    </div>
                    <div
                      className="flex items-center gap-1.5 text-[10px] mt-0.5"
                      style={{ color: "var(--color-text3)" }}
                    >
                      <FiClock size={9} />
                      {fmtDuration(c.duration_secs)} ·{" "}
                      <span style={{ color: STATUS_COLOR[c.status] ?? "var(--color-text3)" }}>
                        {isLive ? "Live" : c.status}
                      </span>
                    </div>
                  </div>
                  {isLive && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: "var(--color-cyan)",
                        animation: "pulse 1.5s ease-in-out infinite",
                        boxShadow: "0 0 6px var(--color-cyan)",
                      }}
                    />
                  )}
                  <FiChevronRight size={12} style={{ color: "var(--color-text3)", flexShrink: 0 }} />
                </button>
              );
            })
          )}
        </div>

        {/* ── Detail Panel ──────────────────────────────────────────────── */}
        <LiveOrStaticDetail activeCall={activeCall} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

// ─── Live view (reads from Redux — no extra SSE connection) ─────────────────

function LiveOrStaticDetail({ activeCall }: { activeCall: any }) {
  const isLive = activeCall.callId && activeCall.status === "active";

  if (isLive) {
    return (
      <div
        className="flex flex-col gap-4 p-5 rounded-[12px] border"
        style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}
      >
        {/* Live header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: "var(--color-cyan)",
                animation: "pulse 1.5s ease-in-out infinite",
                boxShadow: "0 0 6px var(--color-cyan)",
              }}
            />
            <h3
              className="text-[15px] font-bold"
              style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}
            >
              Live Call
            </h3>
          </div>
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)" }}>
            {activeCall.phone}
          </span>
        </div>

        {/* Live transcript from Redux — no second SSE */}
        <div>
          <h4
            className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5"
            style={{ color: "var(--color-text2)" }}
          >
            <FiMic size={11} /> Live Transcript
          </h4>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {activeCall.transcript.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--color-text3)" }}>
                Waiting for conversation…
              </p>
            ) : (
              activeCall.transcript.map((seg: any, i: number) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 px-3 py-2 rounded-[8px] border text-xs"
                  style={{
                    background: seg.speaker === "user" ? "rgba(0,212,255,0.05)" : "rgba(255,255,255,0.02)",
                    borderColor: seg.speaker === "user" ? "rgba(0,212,255,0.1)" : "var(--color-border)",
                    opacity: seg.isPartial ? 0.65 : 1,
                  }}
                >
                  <span
                    className="text-[9px] uppercase tracking-wider font-semibold"
                    style={{ color: "var(--color-text3)" }}
                  >
                    {seg.speaker}
                    {seg.isPartial && " •"}
                  </span>
                  <span style={{ color: "var(--color-text)" }}>{seg.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-[12px] border p-10 h-full"
      style={{
        background: "var(--color-bg2)",
        borderColor: "var(--color-border)",
        color: "var(--color-text3)",
      }}
    >
      <FiPhone size={24} />
      <p className="text-xs">No active call. Use the dialer (bottom-right) to start a call.</p>
    </div>
  );
}