"use client";

import { FiMic } from "react-icons/fi";
import { useGetCallQuery } from "@/store/api/allApis";
import { fmtDuration } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  completed: "var(--color-green)",
  failed: "var(--color-red)",
  active: "var(--color-cyan)",
  ringing: "var(--color-amber)",
  voicemail: "var(--color-text2)",
  queued: "var(--color-text3)",
};

export function CallDetail({ callId }: { callId: string }) {
  const { data: call } = useGetCallQuery(callId);

  if (!call) return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-4" style={{ borderColor: "var(--color-cyan) var(--color-border) var(--color-border) var(--color-border)" }} />
      <span className="text-xs" style={{ color: "var(--color-text3)" }}>Loading deep insights…</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6 rounded-[16px] border shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300" 
      style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
      
      {/* Header & Recording */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-[18px] font-bold mb-1" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Call Overview</h3>
          <p className="text-[11px]" style={{ color: "var(--color-text3)" }}>Ref ID: {call.vapi_call_id || call.id}</p>
        </div>
        
        {call.recording_url && (
          <div className="flex flex-col items-end gap-2">
            <audio src={call.recording_url} controls className="h-8 w-48 opacity-90 scale-90 origin-right" />
            <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="text-[10px] hover:underline" style={{ color: "var(--color-cyan)" }}>
              Download Recording
            </a>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Status" value={call.status} color={STATUS_COLOR[call.status]} />
        <StatCard label="Duration" value={fmtDuration(call.duration_secs || 0)} />
        <StatCard label="Total Cost" value={`$${(call.cost || 0).toFixed(4)}`} />
        <StatCard label="End Reason" value={call.ended_reason || "Normal"} valueClass="truncate" />
      </div>

      {/* Insights Section */}
      {call.summary && (
        <div className="p-4 rounded-[12px] border" style={{ background: "rgba(0,212,255,0.03)", borderColor: "rgba(0,212,255,0.15)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-cyan)" }} />
            <h4 className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--color-cyan)" }}>AI Call Summary</h4>
          </div>
          <p className="text-xs leading-relaxed italic" style={{ color: "var(--color-text)" }}>"{call.summary}"</p>
        </div>
      )}

      {/* Structured Transcript */}
      <div className="flex flex-col gap-4">
        <h4 className="text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-2" style={{ color: "var(--color-text2)" }}>
           <FiMic size={12}/> Transcript Conversation
        </h4>
        
        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {(!call.transcript || call.transcript.length === 0) ? (
            <div className="text-center py-12 border rounded-[12px] border-dashed" style={{ borderColor: "var(--color-border)" }}>
              <p className="text-xs" style={{ color: "var(--color-text3)" }}>No transcript data available for this call.</p>
            </div>
          ) : (
            call.transcript.map((seg, i) => (
              <div key={i} className={`flex flex-col max-w-[85%] ${seg.speaker === "user" ? "self-end items-end" : "self-start items-start"}`}>
                <span className="text-[9px] mb-1 font-medium px-1" style={{ color: "var(--color-text3)" }}>
                  {seg.speaker === "user" ? "Customer" : "Assistant"}
                </span>
                <div className="px-3.5 py-2.5 rounded-[14px] text-xs leading-relaxed shadow-sm"
                  style={{
                    background: seg.speaker === "user" ? "var(--color-cyan)" : "var(--color-bg3)",
                    color:      seg.speaker === "user" ? "#000" : "var(--color-text)",
                    border:     seg.speaker === "user" ? "none" : "1px solid var(--color-border)",
                    borderRadius: seg.speaker === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  }}>
                  {seg.text}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, valueClass = "" }: { label: string; value: string; color?: string; valueClass?: string }) {
  return (
    <div className="p-3 rounded-[12px] border flex flex-col gap-1" style={{ background: "var(--color-bg3)", borderColor: "var(--color-border)" }}>
      <span className="text-[10px] uppercase font-bold tracking-tight" style={{ color: "var(--color-text3)" }}>{label}</span>
      <span className={`text-[13px] font-bold ${valueClass}`} style={{ color: color || "var(--color-text)" }}>{value}</span>
    </div>
  );
}
