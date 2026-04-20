"use client";

import { useEffect, useState } from "react";
import {
  FiPhone,
  FiMic,
  FiClock,
  FiChevronRight,
  FiRadio,
} from "react-icons/fi";

import {
  useGetCallsQuery,
} from "@/store/api/allApis";

import { useAppSelector } from "@/store/hooks";
import { fmtDuration } from "@/lib/utils";
import { CallDetail } from "@/components/CallDetail";

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

export default function CallsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useGetCallsQuery({});
  const activeCall = useAppSelector((s) => s.activeCall);

  useEffect(() => {
    if (activeCall.status === "ended") {
      const t = setTimeout(refetch, 1200);
      return () => clearTimeout(t);
    }
  }, [activeCall.status, refetch]);

  const calls = data?.calls ?? [];

  const isLive = activeCall.callId && activeCall.status === "active";

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-[18px] font-bold"
          style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}
        >
          Call History
        </h1>

        <span className="text-[11px]" style={{ color: "var(--color-text3)" }}>
          {calls.length} total calls
        </span>
      </div>

      {/* Layout */}
      <div className="flex gap-4 h-[calc(100vh-120px)]">

        {/* LEFT: LIST */}
        <div className="w-[340px] flex flex-col gap-2 overflow-y-auto pr-1">

          {isLoading ? (
            <div className="text-xs text-center py-10 text-[var(--color-text3)]">
              Loading calls…
            </div>
          ) : calls.length === 0 ? (
            <div className="text-xs text-center py-10 text-[var(--color-text3)]">
              No call history yet
            </div>
          ) : (
            calls.map((c: any) => {
              const isSelected = selectedId === c.id;
              const liveNow = activeCall.callId === c.id && isLive;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="group flex items-center gap-3 p-3 rounded-xl border transition-all hover:-translate-y-0.5"
                  style={{
                    background: isSelected || liveNow
                      ? "rgba(0,212,255,0.08)"
                      : "var(--color-bg2)",
                    borderColor: isSelected || liveNow
                      ? "rgba(0,212,255,0.25)"
                      : "var(--color-border)",
                  }}
                >

                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0"
                    style={{
                      background: "var(--color-bg3)",
                      borderColor: "var(--color-border2)",
                      color: STATUS_COLOR[c.status] ?? "var(--color-text2)",
                    }}
                  >
                    {liveNow ? <FiRadio size={14} /> : <FiPhone size={14} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                      {c.phone_to}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] mt-1" style={{ color: "var(--color-text3)" }}>
                      <FiClock size={10} />
                      {fmtDuration(c.duration_secs)}
                      <span
                        style={{
                          color: STATUS_COLOR[c.status] ?? "var(--color-text3)",
                        }}
                      >
                        • {liveNow ? "Live" : c.status}
                      </span>
                    </div>
                  </div>

                  {/* Live pulse */}
                  {liveNow && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}

                  <FiChevronRight size={12} className="opacity-40 group-hover:opacity-100 transition" />
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT: DETAIL */}
        <div className="flex-1 overflow-y-auto">

          {isLive ? (
            <div className="p-5 rounded-xl border bg-[var(--color-bg2)] border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-disp)" }}>
                    Live Call
                  </h2>
                </div>

                <span className="text-xs px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400">
                  {activeCall.phone}
                </span>
              </div>

              {/* Transcript */}
              <div className="flex flex-col gap-2">
                <h3 className="text-[10px] uppercase tracking-wider text-[var(--color-text2)] flex items-center gap-1">
                  <FiMic size={11} /> Transcript
                </h3>

                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                  {activeCall.transcript.length === 0 ? (
                    <p className="text-xs text-center py-10 text-[var(--color-text3)]">
                      Waiting for speech…
                    </p>
                  ) : (
                    activeCall.transcript.map((t: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border text-xs"
                        style={{
                          background:
                            t.speaker === "user"
                              ? "rgba(0,212,255,0.06)"
                              : "rgba(255,255,255,0.02)",
                          borderColor:
                            t.speaker === "user"
                              ? "rgba(0,212,255,0.15)"
                              : "var(--color-border)",
                          opacity: t.isPartial ? 0.6 : 1,
                        }}
                      >
                        <div className="text-[10px] mb-1 text-[var(--color-text3)] uppercase">
                          {t.speaker}
                        </div>
                        <div style={{ color: "var(--color-text)" }}>{t.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : selectedId ? (
            <CallDetail callId={selectedId} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center border border-dashed rounded-xl bg-[var(--color-bg2)] border-[var(--color-border)] p-10">
              <FiPhone size={26} className="opacity-40 mb-3" />
              <div className="text-sm font-semibold mb-1" style={{ color: "var(--color-text2)" }}>
                Select a call
              </div>
              <p className="text-xs max-w-[220px]" style={{ color: "var(--color-text3)" }}>
                View transcripts, recordings, and live call data here.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}