"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { FiArrowLeft, FiPlus, FiPlay, FiActivity } from "react-icons/fi";
import { useCreateCampaignMutation, useStartCampaignMutation, useGetContactsQuery, useGetConfigQuery, useGetPhoneNumbersQuery } from "@/store/api/allApis";

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
    <div className="flex flex-col gap-6 max-w-[1200px]">
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
          <h1 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-disp)" }}>Create Campaign</h1>
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
        <div className="p-5 rounded-[16px] border bg-[var(--color-bg2)] border-[var(--color-border)] flex flex-col gap-4">
          <h3 className="text-sm font-bold border-b pb-3 border-[var(--color-border)] flex justify-between items-center">
            1. Campaign Setup
            {campaignId && (
              <span className="text-[10px] text-[var(--color-green)] bg-[var(--color-green-dim)] px-2 py-0.5 rounded-md">
                CREATED: {campaignId}
              </span>
            )}
          </h3>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">Campaign Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} placeholder="e.g., Q3 Follow-ups" disabled={!!campaignId} />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">Assistant ID *</label>
                <input type="text" value={form.assistantId} onChange={e => setForm({ ...form, assistantId: e.target.value })} style={S.input} placeholder="ast_xyz123" disabled={!!campaignId} />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">Phone Number ID *</label>
                {phoneNumbersData && phoneNumbersData.length > 0 ? (
                  <select
                    value={form.phoneNumberId}
                    onChange={e => setForm({ ...form, phoneNumberId: e.target.value })}
                    style={{ ...S.input, cursor: "pointer" }}
                    disabled={!!campaignId}>
                    <option value="">— Select a phone number —</option>
                    {phoneNumbersData.map((pn: PhoneNumber) => (
                      <option key={pn.id} value={pn.id}>{pn.name || pn.number} ({pn.provider})</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={form.phoneNumberId} onChange={e => setForm({ ...form, phoneNumberId: e.target.value })} style={S.input} placeholder="Required (e.g. pnz_xxx)" disabled={!!campaignId} />
                )}
              </div>
            </div>

            {/* Contact Selection */}
            {!campaignId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">
                  Contacts <span className="font-normal text-[var(--color-text3)]">({selectedContacts.length} selected)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedContacts.map((cid) => {
                    const contact = contactsData?.contacts?.find((c: any) => c.id === cid);
                    return (
                      <span key={cid} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--color-cyan-dim)] text-[var(--color-cyan)] border border-[rgba(0,212,255,0.2)]">
                        {contact?.name || cid} ({contact?.phone})
                      </span>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={(e) => { const v = e.target.value; if (v && !selectedContacts.includes(v)) setSelectedContacts((p) => [...p, v]); }}
                  style={{ ...S.input, cursor: "pointer" }}>
                  <option value="">— Add a contact —</option>
                  {contactsData?.contacts?.filter((c: any) => !selectedContacts.includes(c.id)).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!campaignId && (
            <button style={{ ...S.btnPrimary, width: '100%' }} onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Initialize Campaign"}
            </button>
          )}

          {campaignId && (
            <div className="flex flex-col gap-2">
              <Link
                href={`/campaigns/${campaignId}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all"
                style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)", border: "1px solid rgba(0,212,255,0.25)", textDecoration: "none" }}
              >
                View Campaign Details
              </Link>
              <button
                style={{ ...S.btnPrimary, width: '100%', background: 'var(--color-green)', borderColor: 'var(--color-green)' }}
                onClick={handleStart}
                disabled={starting}
              >
                <FiPlay /> {starting ? "Starting..." : "Start Outbound Calls"}
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
  );
}
