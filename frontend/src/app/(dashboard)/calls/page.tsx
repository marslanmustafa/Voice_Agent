"use client";

import { useState, useEffect } from "react";
import { FiPhone, FiMic, FiClock, FiPlay, FiChevronRight, FiRadio } from "react-icons/fi";
import { useGetCallsQuery, useGetCallQuery } from "@/store/api/allApis";
import { useLiveTranscript } from "@/hooks";
import { fmtDuration } from "@/lib/utils";

import { CallDetail } from "@/components/CallDetail";

const STATUS_COLOR: Record<string, string> = {
  completed: "var(--color-green)", failed: "var(--color-red)",
  active: "var(--color-cyan)", ringing: "var(--color-amber)",
  voicemail: "var(--color-text2)", queued: "var(--color-text3)",
};

export default function CallsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const { data, isLoading } = useGetCallsQuery({ status: statusFilter || undefined });
  
  useLiveTranscript(selectedId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Call History</h1>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* List */}
        <div className="flex flex-col gap-1">
          {isLoading ? (
            <div className="text-center p-6 text-xs" style={{ color: "var(--color-text3)" }}>Loading…</div>
          ) : !data?.calls.length ? (
            <div className="text-center p-6 text-xs" style={{ color: "var(--color-text3)" }}>No calls yet</div>
          ) : data.calls.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border w-full text-left transition-all"
              style={{
                background:   selectedId === c.id ? "var(--color-cyan-dim)" : "var(--color-bg2)",
                borderColor:  selectedId === c.id ? "rgba(0,212,255,0.25)" : "var(--color-border)",
                cursor: "pointer",
              }}>
              <div className="w-8 h-8 rounded-[8px] border flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: STATUS_COLOR[c.status] ?? "var(--color-text2)" }}>
                {c.status === "active" ? <FiRadio size={13}/> : <FiPhone size={13}/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{c.phone_to}</div>
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: "var(--color-text3)" }}>
                  <FiClock size={9}/> {fmtDuration(c.duration_secs)} ·{" "}
                  <span style={{ color: STATUS_COLOR[c.status] ?? "var(--color-text3)" }}>{c.status}</span>
                </div>
              </div>
              <FiChevronRight size={12} style={{ color: "var(--color-text3)", flexShrink: 0 }}/>
            </button>
          ))}
        </div>

        {/* Detail */}
        {selectedId
          ? <CallDetail callId={selectedId}/>
          : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border p-10"
              style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
              <FiPhone size={24}/><p className="text-xs">Select a call to view details and transcript</p>
            </div>
          )}
      </div>
    </div>
  );
}
