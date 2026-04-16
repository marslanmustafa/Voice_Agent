"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FiArrowLeft, FiPhone, FiMic, FiClock, FiPlay, FiStopCircle, FiCheck, FiRadio,
  FiChevronRight, FiUser, FiTrash2,
} from "react-icons/fi";
import { useGetCampaignQuery, useStartCampaignMutation, useControlCampaignMutation, useGetCallsQuery, useGetCallQuery, useEndCallMutation } from "@/store/api/allApis";
import { fmtDuration } from "@/lib/utils";

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:     { color: "var(--color-text3)",  label: "Draft"     },
  created:   { color: "var(--color-amber)",  label: "Created"   },
  queued:    { color: "var(--color-amber)",  label: "Queued"    },
  running:   { color: "var(--color-green)",  label: "Running"   },
  completed: { color: "var(--color-cyan)",   label: "Completed" },
  done:      { color: "var(--color-cyan)",   label: "Completed" },
  cancelled: { color: "var(--color-red)",    label: "Cancelled" },
  unknown:   { color: "var(--color-text2)",  label: "Unknown"   },
};

const CALL_STATUS_COLOR: Record<string, string> = {
  completed: "var(--color-green)", failed: "var(--color-red)",
  active: "var(--color-cyan)", ringing: "var(--color-amber)",
  voicemail: "var(--color-text2)", queued: "var(--color-text3)",
};

const S = {
  btnPrimary: { background: "var(--color-cyan)", color: "#000", border: "1px solid var(--color-cyan)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  btnGhost: { background: "none", color: "var(--color-text2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  btnDanger: { background: "var(--color-bg3)", color: "var(--color-red)", border: "1px solid var(--color-border2)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  card: { background: "var(--color-bg2)", border: "1px solid var(--color-border)", borderRadius: 14 },
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "9px 12px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%" },
} as const;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading: campLoading } = useGetCampaignQuery(id);
  const { data: callsData, isLoading: callsLoading, refetch } = useGetCallsQuery({ campaign_id: id });
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [startCampaign] = useStartCampaignMutation();
  const [controlCampaign] = useControlCampaignMutation();

  if (campLoading) return <LoadingState />;
  if (!campaign) return <NotFoundState />;

  const meta = STATUS_META[campaign.status] ?? STATUS_META.draft;
  const pct = campaign.call_count > 0
    ? Math.round((campaign.completed_count / campaign.call_count) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-xs transition-all"
          style={{ color: "var(--color-text2)", textDecoration: "none", width: "fit-content" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-cyan)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text2)"}>
          <FiArrowLeft size={12}/> Back to Campaigns
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[12px] border flex items-center justify-center"
              style={{ background: `${meta.color}20`, borderColor: `${meta.color}40`, color: meta.color }}>
              <FiRadio size={18}/>
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <h1 className="text-[20px] font-extrabold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>{campaign.name}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: meta.color, background: `${meta.color}15`, borderColor: `${meta.color}40` }}>{meta.label}</span>
              </div>
              {campaign.topic && <p className="text-[11px]" style={{ color: "var(--color-text2)" }}>{campaign.topic}</p>}
            </div>
          </div>

          {/* Campaign controls */}
          <div className="flex gap-2 items-center">
            {campaign.status !== "running" && campaign.status !== "completed" && (
              <button style={S.btnPrimary} onClick={async () => { await startCampaign({ campaignId: id }); refetch(); }}>
                <FiPlay size={12}/> Launch Campaign
              </button>
            )}
            {campaign.status === "running" && (
              <button style={S.btnDanger} onClick={async () => { if (!confirm("Cancel this campaign?")) return; await controlCampaign({ campaignId: id, action: "stop" }); }}>
                <FiStopCircle size={12}/> Cancel Campaign
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {[
            ["Contacts", campaign.contact_count, "var(--color-cyan)"],
            ["Total Calls", "N/A", "var(--color-text2)"],
            ["Completed", "N/A", "var(--color-green)"],
            ["Completion", "N/A", meta.color],
          ].map(([label, value, color]) => (
            <div key={label as string} className="flex flex-col gap-1 p-3.5 rounded-[10px] border" style={S.card}>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>{label}</span>
              <span className="text-[18px] font-bold" style={{ color: color as string, fontFamily: "var(--font-disp)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calls section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>
          Calls ({callsData?.calls?.length ?? 0})
        </h2>

        <div className="grid gap-4" style={{ gridTemplateColumns: "360px 1fr" }}>
          {/* Calls list */}
          <div className="flex flex-col gap-1">
            {callsLoading ? (
              <div className="text-center p-6 text-xs" style={{ color: "var(--color-text3)" }}>Loading…</div>
            ) : !callsData?.calls?.length ? (
              <div className="flex flex-col items-center gap-3 p-8 rounded-[12px] border text-center"
                style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
                <FiPhone size={20}/>
                <p className="text-xs" style={{ color: "var(--color-text2)" }}>No calls yet</p>
                {campaign.status === "draft" && (
                  <p className="text-[10px]" style={{ color: "var(--color-text3)" }}>Launch the campaign to start calling contacts</p>
                )}
              </div>
            ) : callsData.calls.map((call) => (
              <button key={call.id} onClick={() => setSelectedCallId(call.id)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[10px] border w-full text-left transition-all"
                style={{
                  background:   selectedCallId === call.id ? "var(--color-cyan-dim)" : "var(--color-bg2)",
                  borderColor:  selectedCallId === call.id ? "rgba(0,212,255,0.25)" : "var(--color-border)",
                  cursor: "pointer",
                }}>
                <div className="w-8 h-8 rounded-[8px] border flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: CALL_STATUS_COLOR[call.status] ?? "var(--color-text2)" }}>
                  {call.status === "active" ? <FiRadio size={13}/> : <FiPhone size={13}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium truncate" style={{ color: "var(--color-text)" }}>{call.phone_to}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0"
                      style={{ background: `${CALL_STATUS_COLOR[call.status] ?? "var(--color-text3)"}20`, color: CALL_STATUS_COLOR[call.status] ?? "var(--color-text3)" }}>
                      {call.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: "var(--color-text3)" }}>
                    <FiClock size={9}/> {fmtDuration(call.duration_secs)}
                    {call.ended_at && <span>· {new Date(call.ended_at).toLocaleTimeString()}</span>}
                  </div>
                </div>
                {call.status === "active" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                    style={{ background: "rgba(0,212,255,0.15)", color: "var(--color-cyan)" }}>
                    LIVE
                  </span>
                )}
                <FiChevronRight size={12} style={{ color: "var(--color-text3)", flexShrink: 0 }}/>
              </button>
            ))}
          </div>

          {/* Call detail */}
          {selectedCallId
            ? <CallDetailPanel callId={selectedCallId} onEnd={() => refetch()}/>
            : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border p-10"
                style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
                <FiPhone size={24}/><p className="text-xs">Select a call to view details and transcript</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function CallDetailPanel({ callId, onEnd }: { callId: string; onEnd: () => void }) {
  const { data: call, isLoading } = useGetCallQuery(callId);
  const [endCall] = useEndCallMutation();

  if (isLoading) return <div className="text-center p-8 text-xs" style={{ color: "var(--color-text3)" }}>Loading…</div>;
  if (!call) return <div className="text-center p-8 text-xs" style={{ color: "var(--color-text3)" }}>Call not found</div>;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-[12px] border" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
      <div className="flex justify-between items-center">
        <h3 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Call Details</h3>
        <div className="flex gap-2">
          {call.recording_url && (
            <a href={call.recording_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-xs transition-all"
              style={{ color: "var(--color-cyan)", borderColor: "rgba(0,212,255,0.2)", background: "var(--color-cyan-dim)", textDecoration: "none" }}>
              <FiPlay size={11}/> Recording
            </a>
          )}
          {call.status === "active" && (
            <button onClick={async () => { if (!confirm("End this call?")) return; await endCall(callId); onEnd(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border text-xs font-bold transition-all"
              style={{ background: "var(--color-bg3)", color: "var(--color-red)", borderColor: "var(--color-border2)", cursor: "pointer" }}>
              <FiStopCircle size={11}/> End Call
            </button>
          )}
        </div>
      </div>

      <div className="rounded-[8px] border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
        {[
          ["Status", <span key="s" style={{ color: CALL_STATUS_COLOR[call.status] ?? "var(--color-text)" }}>{call.status}</span>],
          ["Duration", fmtDuration(call.duration_secs)],
          ["Phone To", call.phone_to],
          ["Phone From", call.phone_from],
          ["Started", call.started_at ? new Date(call.started_at).toLocaleString() : "—"],
          ["Ended", call.ended_at ? new Date(call.ended_at).toLocaleString() : "—"],
        ].map(([k, v]) => (
          <div key={k as string} className="flex items-center px-3.5 py-2.5 border-b last:border-0 text-xs" style={{ borderColor: "var(--color-border)" }}>
            <span className="w-24 flex-shrink-0" style={{ color: "var(--color-text2)" }}>{k}</span>
            <span className="font-medium" style={{ color: "var(--color-text)" }}>{v}</span>
          </div>
        ))}
      </div>

      {call.summary && (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--color-text2)" }}>Summary</h4>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text)" }}>{call.summary}</p>
        </div>
      )}

      {call.transcript?.length > 0 ? (
        <div>
          <h4 className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--color-text2)" }}>
            <FiMic size={11}/> Transcript
          </h4>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
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
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-xs" style={{ color: "var(--color-text3)" }}>
          <FiMic size={16}/>
          <span>No transcript available</span>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-3 p-20">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent spin"
        style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }}/>
      <span className="text-xs" style={{ color: "var(--color-text3)" }}>Loading campaign…</span>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-20">
      <FiRadio size={28} style={{ color: "var(--color-text3)" }}/>
      <div className="text-center">
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text2)" }}>Campaign not found</p>
        <Link href="/campaigns" className="text-xs" style={{ color: "var(--color-cyan)", textDecoration: "none" }}>← Back to Campaigns</Link>
      </div>
    </div>
  );
}
