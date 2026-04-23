"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { FiArrowLeft, FiPlus, FiPlay, FiActivity, FiInfo, FiDownload, FiFileText, FiClock } from "react-icons/fi";
import { useCreateCampaignMutation, useStartCampaignMutation, useGetContactsQuery, useGetConfigQuery, useGetPhoneNumbersQuery } from "@/store/api/allApis";
import { Skeleton } from "boneyard-js/react";

interface PhoneNumber {
  id: string;
  name?: string;
  number: string;
  provider: string;
  status: string;
}

const S = {
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "9px 12px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%" },
  btnPrimary: { background: "var(--color-cyan)", color: "#000", border: "1px solid var(--color-cyan)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 },
  btnGhost: { background: "none", color: "var(--color-text2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 },
} as const;

export default function CreateCampaignPage() {
  const [form, setForm] = useState({ name: "", assistantId: "", phoneNumberId: "" });
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [scheduleType, setScheduleType] = useState<"now" | "later">("later");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const { data: contactsData } = useGetContactsQuery({});
  const { data: configData } = useGetConfigQuery();
  const { data: phoneNumbersData } = useGetPhoneNumbersQuery();

  const [createCampaign, { isLoading: creating }] = useCreateCampaignMutation();
  const [startCampaign, { isLoading: starting }] = useStartCampaignMutation();

  const [liveCalls, setLiveCalls] = useState<Record<string, any>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-fill assistantId from config
  useEffect(() => {
    if (configData?.vapi_assistant_id && !form.assistantId) {
      setForm(prev => ({ ...prev, assistantId: configData.vapi_assistant_id || "" }));
    }
  }, [configData]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") || window.location.host;
    try {
      const url = new URL(process.env.NEXT_PUBLIC_API_URL || "");
      wsHost = url.host;
    } catch { }

    const wsUrl = `${protocol}//${wsHost}/ws/monitor`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const cid = data.callId;
        if (!cid) return;

        setLiveCalls(prev => {
          const call = prev[cid] || { callId: cid, status: "unknown", transcripts: [] };

          if (data.type === "call-started") {
            call.status = "active";
          } else if (data.type === "call-ended" || data.type === "call-failed") {
            call.status = data.status || "completed";
            call.durationSecs = data.duration_secs;
          } else if (data.type === "transcript") {
            call.transcripts = [...call.transcripts, {
              speaker: data.speaker,
              text: data.text,
              timestamp: data.timestamp
            }];
          }

          return { ...prev, [cid]: { ...call } };
        });
      } catch (e) {
        console.error("WS Parse Error:", e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleCreate = async () => {
    setCreateError(null);
    if (!form.name) return setCreateError("Campaign name is required.");
    if (!form.assistantId) return setCreateError("Assistant ID is required. Configure it in Settings or enter manually.");
    if (!form.phoneNumberId) return setCreateError("Phone Number ID is required.");

    const customers = selectedContacts.map(cid => {
      const contact = contactsData?.contacts?.find((c: any) => c.id === cid);
      return {
        number: contact?.phone,
        name: contact?.name,
        email: contact?.email
      };
    });

    const payload = { ...form, customers };

    try {
      const res = await createCampaign(payload).unwrap();
      if (res.id) setCampaignId(res.id);
    } catch (e: any) {
      const message = e?.data?.detail || e?.detail || e?.message || "Unknown error";
      setCreateError(typeof message === "object" ? JSON.stringify(message) : message);
    }
  };

  const handleStart = async () => {
    if (!campaignId) return;

    try {
      await startCampaign({ campaignId, customers: [] }).unwrap();
    } catch (e: any) {
      const message = e?.data?.detail || e?.detail || e?.message || "Unknown error";
      setCreateError("Error starting calls: " + (typeof message === "object" ? JSON.stringify(message) : message));
    }
  };

  return (
    <Skeleton name="campaign-create" loading={!configData && !phoneNumbersData}>
      <div className="flex flex-col gap-6 w-full max-w-[1200px] px-2 md:px-0">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-xs transition-all"
            style={{ color: "var(--color-text2)", textDecoration: "none", width: "fit-content" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-cyan)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text2)"}>
            <FiArrowLeft size={12}/> Back to Campaigns
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-[var(--color-cyan-dim)] text-[var(--color-cyan)] flex items-center justify-center border border-[rgba(0,212,255,0.3)]">
            <FiActivity size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-[28px] font-extrabold tracking-wide" style={{ fontFamily: "var(--font-disp)", background: "linear-gradient(135deg, var(--color-cyan) 0%, #F5DEB3 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Create Campaign</h1>
            <p className="text-xs text-[var(--color-text2)] mt-1">Set up a new outbound calling campaign</p>
          </div>
        </div>

      {createError && (
        <div className="px-4 py-3 rounded-[10px] border text-xs" style={{
          background: "rgba(239,68,68,0.1)",
          borderColor: "rgba(239,68,68,0.3)",
          color: "var(--color-red)"
        }}>
          {createError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Setup Block */}
        <div className="flex flex-col gap-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text)] mb-2">Campaign Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-cyan)]" placeholder="Campaign Name" disabled={!!campaignId} />
          </div>

          {/* Phone Number */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <label className="block text-[13px] font-medium text-[var(--color-text)]">Phone Number</label>
              <FiInfo className="text-[var(--color-text3)]" size={14} />
            </div>
            <div className="relative">
              <select value={form.phoneNumberId} onChange={e => setForm({ ...form, phoneNumberId: e.target.value })} className="w-full bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text2)] focus:outline-none appearance-none cursor-pointer" disabled={!!campaignId}>
                <option value="">Select</option>
                {phoneNumbersData?.map((pn: PhoneNumber) => (
                  <option key={pn.id} value={pn.id}>{pn.name || pn.number} ({pn.provider})</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 6L0 0H10L5 6Z" fill="#666"/></svg>
              </div>
            </div>
          </div>

          {/* Best Practices Callout */}
          <div className="bg-[var(--color-bg2)] rounded-xl p-4 flex gap-3 border border-[var(--color-border)] shadow-sm">
            <FiInfo className="text-[var(--color-text3)] mt-0.5 flex-shrink-0" size={16} />
            <div>
              <div className="text-[13px] text-[var(--color-text)] mb-1">Best Practices</div>
              <div className="text-[12px] text-[var(--color-text3)] leading-relaxed">
                Learn how to avoid spam flagging and optimize your calling strategy for better success rates. <a href="#" className="underline decoration-[var(--color-text3)] underline-offset-2 hover:text-[var(--color-text)] transition-colors">Spam flagging best practices</a>
              </div>
            </div>
          </div>

          {/* Upload CSV */}
          {!campaignId && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[13px] font-medium text-[var(--color-text)]">Upload CSV</label>
                <button className="flex items-center gap-2 text-[12px] text-[var(--color-text2)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-bg3)] transition-colors">
                  <FiDownload size={14} /> Download template
                </button>
              </div>
              <div className="border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-bg2)] p-8 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-text3)] transition-colors group">
                <FiFileText className="text-[var(--color-text3)] mb-4 group-hover:text-[var(--color-text2)] transition-colors" size={32} />
                <div className="text-[13px] text-[var(--color-text2)] mb-1">Drag and drop a CSV file here or click to select file locally</div>
                <div className="text-[12px] text-[var(--color-text3)]">Maximum file size: 5MB</div>
              </div>
            </div>
          )}

          {/* Assistant */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--color-text)] mb-2">Assistant</label>
            <div className="relative">
              <select value={form.assistantId} onChange={e => setForm({ ...form, assistantId: e.target.value })} className="w-full bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text2)] focus:outline-none appearance-none cursor-pointer" disabled={!!campaignId}>
                <option value="">Select</option>
                <option value={configData?.vapi_assistant_id || "ast_xyz"}>Configured Assistant ({configData?.vapi_assistant_id || "Not Set"})</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 6L0 0H10L5 6Z" fill="#666"/></svg>
              </div>
            </div>
          </div>

          {/* Choose when to send */}
          {!campaignId && (
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text)] mb-3">Choose when to send</label>
              <div className="flex gap-4">
                <div onClick={() => setScheduleType('now')} className={`flex-1 border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors ${scheduleType === 'now' ? 'border-[var(--color-cyan)] bg-[rgba(0,212,255,0.03)]' : 'border-[var(--color-border)] bg-[var(--color-bg2)]'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scheduleType === 'now' ? 'border-[var(--color-cyan)]' : 'border-[var(--color-border)]'}`}>
                    {scheduleType === 'now' && <div className="w-2 h-2 rounded-full bg-[var(--color-cyan)]"></div>}
                  </div>
                  <span className="text-[13px] text-[var(--color-text)]">Send Now</span>
                </div>
                <div onClick={() => setScheduleType('later')} className={`flex-1 border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors ${scheduleType === 'later' ? 'border-[var(--color-cyan)] bg-[rgba(0,212,255,0.03)]' : 'border-[var(--color-border)] bg-[var(--color-bg2)]'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scheduleType === 'later' ? 'border-[var(--color-cyan)]' : 'border-[var(--color-border)]'}`}>
                    {scheduleType === 'later' && <div className="w-2 h-2 rounded-full bg-[var(--color-cyan)]"></div>}
                  </div>
                  <span className="text-[13px] text-[var(--color-text)]">Schedule for later</span>
                </div>
              </div>
            </div>
          )}

          {/* Start at: */}
          {!campaignId && scheduleType === 'later' && (
            <div>
              <label className="block text-[13px] font-medium text-[var(--color-text)] mb-3">Start at:</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-[12px] text-[var(--color-text3)] mb-2">Date</label>
                  <div className="relative">
                    <select className="w-full bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text)] focus:outline-none appearance-none cursor-pointer">
                      <option>Today</option>
                      <option>Tomorrow</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none">
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-[2px]"><path d="M4 0L8 5H0L4 0Z" fill="#666"/></svg>
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5L0 0H8L4 5Z" fill="#666"/></svg>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] text-[var(--color-text3)] mb-2">Time</label>
                  <div className="relative">
                    <input type="text" defaultValue="12:49 PM" className="w-full bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-cyan)]" />
                    <FiClock className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text3)] pointer-events-none" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] text-[var(--color-text3)] mb-2">Timezone</label>
                  <div className="relative">
                    <select className="w-full bg-[var(--color-bg2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text)] focus:outline-none appearance-none cursor-pointer">
                      <option>Asia/Karachi (GM...</option>
                      <option>America/New_York</option>
                      <option>Europe/London</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 6L0 0H10L5 6Z" fill="#666"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!campaignId && (
            <button className="w-full font-bold text-[13px] py-3 rounded-xl transition-colors mt-2 text-black hover:opacity-90" style={{ background: "linear-gradient(135deg, #00d4ff 0%, #F5DEB3 100%)" }} onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Initialize Campaign"}
            </button>
          )}

          {campaignId && (
            <div className="flex flex-col gap-3 mt-2">
              <div className="p-4 rounded-xl border border-[var(--color-green)] bg-[rgba(0,255,0,0.05)] text-center">
                <span className="text-[13px] text-[var(--color-green)] font-semibold">
                  Campaign initialized successfully! (ID: {campaignId})
                </span>
              </div>
              <button
                className="w-full bg-[var(--color-green)] text-black font-bold text-[13px] py-3 rounded-xl hover:bg-[#00cc00] transition-colors flex items-center justify-center gap-2"
                onClick={handleStart}
                disabled={starting}
              >
                <FiPlay /> {starting ? "Starting Calls..." : "Start Outbound Calls Now"}
              </button>
            </div>
          )}
        </div>

        {/* Live Monitor */}
        <div className="p-5 rounded-[16px] border bg-[var(--color-bg2)] border-[var(--color-border)] flex flex-col gap-4">
          <h3 className="text-sm font-bold border-b pb-3 border-[var(--color-border)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-red)] animate-pulse shadow-[0_0_8px_var(--color-red)]"></span>
            Live Monitor
          </h3>

          {Object.keys(liveCalls).length === 0 ? (
            <div className="text-center p-12 text-[var(--color-text3)] text-sm border border-dashed rounded-xl border-[var(--color-border2)]">
              {campaignId ? "Waiting for call events..." : "Create a campaign to start monitoring calls"}
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
              {Object.values(liveCalls).map((call: any) => (
                <div key={call.callId} className="flex flex-col gap-2 p-3 rounded-[10px] border" style={{ background: "var(--color-bg)", borderColor: "var(--color-border2)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--color-text3)] truncate max-w-[120px]">{call.callId}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${call.status === 'active' ? 'bg-[var(--color-green-dim)] text-[var(--color-green)]' : 'bg-[var(--color-bg3)] text-[var(--color-text2)]'}`}>
                      {call.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs font-mono max-h-32 overflow-y-auto">
                    {call.transcripts.length === 0 ? (
                      <span className="text-[var(--color-text3)] italic">Connecting audio...</span>
                    ) : call.transcripts.slice(-5).map((t: any, idx: number) => (
                      <div key={idx} className={`px-2 py-1 rounded-md ${t.speaker === 'user' ? 'bg-[var(--color-bg3)] text-[var(--color-text2)]' : 'bg-[var(--color-cyan-dim)] text-[var(--color-cyan)]'}`}>
                        {t.text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </Skeleton>
  );
}
