"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FiArrowLeft, FiPhone, FiMic, FiClock, FiPlay, FiStopCircle, FiCheck, FiRadio,
  FiChevronRight, FiUser, FiTrash2, FiCopy, FiPhoneCall, FiPhoneForwarded, FiVoicemail, FiCheckCircle, FiXCircle, FiX
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

  const calls = callsData?.calls ?? [];
  const totalCalls = (campaign.callsCounterScheduled || 0) + (campaign.callsCounterQueued || 0) + (campaign.callsCounterInProgress || 0) + (campaign.callsCounterEnded || 0) || calls.length;
  const endedCalls = campaign.callsCounterEnded || calls.filter((c: any) => ["completed", "failed", "voicemail", "busy", "no-answer", "cancelled"].includes(c.status)).length;
  const pickedUpCalls = calls.filter((c: any) => c.status === "completed" || c.status === "active").length;
  const voicemailCalls = campaign.callsCounterEndedVoicemail || calls.filter((c: any) => c.status === "voicemail").length;

  return (
    <div className="flex flex-col gap-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[22px] font-bold text-[var(--color-text)] tracking-wide font-disp">{campaign.name || "Campaign"}</h1>
              <button className="text-[var(--color-text3)] hover:text-[var(--color-text2)] transition-colors"><FiCopy size={14}/></button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] text-[var(--color-text2)]">Arslan</span>
              <button className="text-[var(--color-text3)] hover:text-[var(--color-text2)] transition-colors"><FiCopy size={12}/></button>
            </div>
            <div className="text-[13px] text-[var(--color-text3)]">Unknown Phone Number</div>
          </div>

          <div className="flex gap-2 items-center">
            {campaign.status !== "running" && campaign.status !== "completed" && (
              <button className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,212,255,0.5)] bg-[rgba(0,212,255,0.1)] text-[var(--color-cyan)] rounded-xl text-[13px] font-medium hover:bg-[rgba(0,212,255,0.2)] transition-colors" onClick={async () => { await startCampaign({ campaignId: id }); refetch(); }}>
                <FiPlay size={14}/> Launch Campaign
              </button>
            )}
            {campaign.status === "running" && (
              <button className="flex items-center gap-2 px-4 py-2 border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] text-[var(--color-red)] rounded-xl text-[13px] font-medium hover:bg-[rgba(239,68,68,0.1)] transition-colors" onClick={async () => { if (!confirm("Cancel this campaign?")) return; await controlCampaign({ campaignId: id, action: "stop" }); }}>
                Cancel Campaign <FiXCircle size={14}/>
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mt-2">
          {/* Total Calls */}
          <div className="bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg3)] border border-[var(--color-border2)] flex items-center justify-center text-[var(--color-text3)]">
              <FiPhoneCall size={16}/>
            </div>
            <div>
              <div className="text-[12px] text-[var(--color-text3)] font-medium mb-1">Total Calls</div>
              <div className="text-[22px] font-semibold text-[var(--color-text)] font-disp">{totalCalls}</div>
            </div>
          </div>
          {/* Ended Calls */}
          <div className="bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg3)] border border-[var(--color-border2)] flex items-center justify-center text-[var(--color-text3)]">
              <FiCheckCircle size={16}/>
            </div>
            <div>
              <div className="text-[12px] text-[var(--color-text3)] font-medium mb-1">Ended Calls</div>
              <div className="text-[22px] font-semibold text-[var(--color-text)] font-disp">{endedCalls}</div>
            </div>
          </div>
          {/* Picked Up Calls */}
          <div className="bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg3)] border border-[var(--color-border2)] flex items-center justify-center text-[var(--color-text3)]">
              <FiPhoneForwarded size={16}/>
            </div>
            <div>
              <div className="text-[12px] text-[var(--color-text3)] font-medium mb-1">Picked Up Calls</div>
              <div className="text-[22px] font-semibold text-[var(--color-text)] font-disp">{pickedUpCalls}</div>
            </div>
          </div>
          {/* Voicemail Calls */}
          <div className="bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg3)] border border-[var(--color-border2)] flex items-center justify-center text-[var(--color-text3)]">
              <FiVoicemail size={16}/>
            </div>
            <div>
              <div className="text-[12px] text-[var(--color-text3)] font-medium mb-1">Voicemail Calls</div>
              <div className="text-[22px] font-semibold text-[var(--color-text)] font-disp">{voicemailCalls}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Results */}
      <div className="flex flex-col gap-4 mt-2">
        <h2 className="text-[16px] font-bold text-[var(--color-text)] tracking-wide font-disp">Call Results</h2>

        <div className="w-full overflow-x-auto pb-20">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="py-4 px-4 w-12"><div className="w-4 h-4 rounded-[4px] border border-[var(--color-border2)] bg-[var(--color-bg2)]"></div></th>
                <th className="py-4 px-4 text-[12px] font-semibold text-[var(--color-text3)] tracking-wider">Call ID</th>
                <th className="py-4 px-4 text-[12px] font-semibold text-[var(--color-text3)] tracking-wider">Ended Reason</th>
                <th className="py-4 px-4 text-[12px] font-semibold text-[var(--color-text3)] tracking-wider">Customer Phone</th>
                <th className="py-4 px-4 text-[12px] font-semibold text-[var(--color-text3)] tracking-wider">Success Evaluation</th>
                <th className="py-4 px-4 text-[12px] font-semibold text-[var(--color-text3)] tracking-wider">Duration</th>
                <th className="py-4 px-4 text-[12px] font-semibold text-[var(--color-text3)] tracking-wider">Start Time</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[13px] text-[var(--color-text3)] border-b border-[var(--color-border)]">
                    No calls recorded yet
                  </td>
                </tr>
              ) : (
                calls.map((call: any) => {
                  const shortId = call.id.substring(0, 12) + "...";
                  return (
                    <tr key={call.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg2)] transition-colors group cursor-pointer" onClick={() => setSelectedCallId(call.id)}>
                      <td className="py-4 px-4">
                        <div className="w-4 h-4 rounded-[4px] border border-[var(--color-border2)] bg-[var(--color-bg2)] group-hover:border-[var(--color-text3)] transition-colors"></div>
                      </td>
                      <td className="py-4 px-4 text-[13px] text-[var(--color-text2)]">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-lg w-fit">
                          <span className="font-mono text-[11px]">{shortId}</span>
                          <FiCopy className="text-[var(--color-text3)] hover:text-[var(--color-text)]" size={12} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(call.id); }}/>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {call.status === "active" ? (
                           <svg className="animate-spin h-4 w-4 text-[var(--color-text3)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                        ) : (
                          <span className={`text-[11px] px-2.5 py-1 rounded-md font-bold uppercase ${
                            call.status === "completed" ? "bg-[rgba(0,255,0,0.1)] text-[var(--color-green)]" :
                            call.ended_reason === "customer-did-not-answer" || call.status === "no-answer" ? "bg-[#3A2A1A] text-[#E0A96D]" :
                            call.status === "failed" ? "bg-[rgba(255,0,0,0.1)] text-[var(--color-red)]" :
                            "bg-[var(--color-bg3)] text-[var(--color-text2)]"
                          }`}>
                            {call.ended_reason 
                              ? call.ended_reason.replace(/-/g, ' ') 
                              : (call.status === "no-answer" ? "Customer Did Not Answer" : call.status)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-[13px] text-[var(--color-text2)]">{call.phone_to}</td>
                      <td className="py-4 px-4 text-[13px] text-[var(--color-text3)]">-</td>
                      <td className="py-4 px-4 text-[13px] text-[var(--color-text3)]">{call.duration_secs ? fmtDuration(call.duration_secs) : "-"}</td>
                      <td className="py-4 px-4 text-[13px] text-[var(--color-text3)]">{call.started_at ? new Date(call.started_at).toLocaleTimeString() : "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Existing Call Details Popup/Modal */}
      {selectedCallId && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedCallId(null)}>
           <div className="max-w-[600px] w-full max-h-[90vh] overflow-y-auto bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold">Call Report</h3>
               <button onClick={() => setSelectedCallId(null)} className="text-[var(--color-text3)] hover:text-[var(--color-text)]"><FiX size={20}/></button>
             </div>
             <CallDetailPanel callId={selectedCallId} onEnd={() => { refetch(); setSelectedCallId(null); }}/>
           </div>
         </div>
      )}
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
