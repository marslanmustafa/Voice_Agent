"use client";

import { useState } from "react";
import { FiPhone, FiMic, FiClock, FiPlay, FiChevronRight, FiRadio } from "react-icons/fi";
import { useGetCallsQuery, useGetCallQuery } from "@/store/api/allApis";
import { useLiveTranscript } from "@/hooks";
import { fmtDuration } from "@/lib/utils";

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

function CallDetail({ callId }: { callId: string }) {
  const { data: call } = useGetCallQuery(callId);
  if (!call) return <div className="text-center p-8 text-xs" style={{ color: "var(--color-text3)" }}>Loading…</div>;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-[12px] border" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
      <div className="flex justify-between items-center">
        <h3 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Call Details</h3>
        {call.recording_url && (
          <a href={call.recording_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-xs transition-all"
            style={{ color: "var(--color-cyan)", borderColor: "rgba(0,212,255,0.2)", background: "var(--color-cyan-dim)", textDecoration: "none" }}>
            <FiPlay size={11}/> Recording
          </a>
        )}
      </div>

      <div className="rounded-[8px] border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
        {[["Status",call.status],["Duration",fmtDuration(call.duration_secs)],["Phone To",call.phone_to],["Phone From",call.phone_from]].map(([k,v]) => (
          <div key={k} className="flex items-center px-3.5 py-2.5 border-b last:border-0 text-xs" style={{ borderColor: "var(--color-border)" }}>
            <span className="w-24 flex-shrink-0" style={{ color: "var(--color-text2)" }}>{k}</span>
            <span className="font-medium" style={{ color: k === "Status" ? (STATUS_COLOR[call.status] ?? "var(--color-text)") : "var(--color-text)" }}>{v}</span>
          </div>
        ))}
      </div>

      {call.summary && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--color-text2)" }}>Summary</h4>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text)" }}>{call.summary}</p>
        </div>
      )}

      {call.transcript?.length > 0 && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--color-text2)" }}><FiMic size={11}/> Transcript</h4>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {call.transcript.map((seg, i) => (
              <div key={i} className="flex flex-col gap-1 px-3 py-2 rounded-[8px] border text-xs"
                style={{
                  background:   seg.speaker === "user" ? "rgba(0,212,255,0.05)" : "rgba(255,255,255,0.02)",
                  borderColor:  seg.speaker === "user" ? "rgba(0,212,255,0.1)"  : "var(--color-border)",
                }}>
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-text3)" }}>{seg.speaker}</span>
                <span style={{ color: "var(--color-text)" }}>{seg.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
