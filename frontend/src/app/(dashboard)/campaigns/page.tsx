"use client";

import { useState, useEffect, useRef } from "react";
import { FiPlus, FiPlay, FiStopCircle, FiRadio, FiX, FiCheck, FiTrash2, FiUser, FiActivity } from "react-icons/fi";
import { useCreateCampaignMutation, useStartCampaignMutation, useGetContactsQuery, useGetConfigQuery, useGetPhoneNumbersQuery } from "@/store/api/allApis";

interface LiveCall {
  callId: string;
  status: string;
  customer?: { number?: string; name?: string };
  transcripts: { speaker: string; text: string; timestamp: number }[];
  durationSecs?: number;
}

interface PhoneNumber {
  id: string;
  name?: string;
  number: string;
  provider: string;
  status: string;
}

const S = {
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "9px 12px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%" },
  btnPrimary: { background: "var(--color-cyan)", color: "#000", border: "1px solid var(--color-cyan)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyCenter: "center", gap: 6 },
  btnGhost: { background: "none", color: "var(--color-text2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyCenter: "center", gap: 6 },
} as const;

export default function CampaignCommandCenter() {
  const [form, setForm] = useState({ name: "", assistantId: "", phoneNumberId: "" });
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const { data: contactsData } = useGetContactsQuery({});
  const { data: configData } = useGetConfigQuery();
  const { data: phoneNumbersData } = useGetPhoneNumbersQuery();

  const [createCampaign, { isLoading: creating }] = useCreateCampaignMutation();
  const [startCampaign, { isLoading: starting }] = useStartCampaignMutation();

  const [liveCalls, setLiveCalls] = useState<Record<string, LiveCall>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-fill assistantId from config
  useEffect(() => {
    if (configData?.vapi_assistant_id && !form.assistantId) {
      setForm(prev => ({ ...prev, assistantId: configData.vapi_assistant_id || "" }));
    }
  }, [configData]);

  const [liveCalls, setLiveCalls] = useState<Record<string, LiveCall>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Establish global monitor WebSocket
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let wsHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") || window.location.host;
    try {
        const url = new URL(process.env.NEXT_PUBLIC_API_URL || "");
        wsHost = url.host;
    } catch {}

    const wsUrl = `${protocol}//${wsHost}/ws/monitor`;
    console.log("Connecting Command Center to JS WebSocket:", wsUrl);
    
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
    if (!form.name) return alert("Campaign name is required.");
    if (!form.assistantId) return alert("Assistant ID is required. Configure it in Settings or enter manually.");
    if (!form.phoneNumberId) return alert("Phone Number ID is required.");

    // Build customers array from selected contacts
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
      alert("Error: " + (typeof message === "object" ? JSON.stringify(message) : message));
    }
  };

  const handleStart = async () => {
    if (!campaignId) return alert("Must create campaign first.");

    try {
      // Start campaign without contacts (they were already added during creation)
      await startCampaign({ campaignId, customers: [] }).unwrap();
      alert("Campaign calls queued.");
    } catch (e: any) {
      const message = e?.data?.detail || e?.detail || e?.message || "Unknown error";
      alert("Error starting calls: " + (typeof message === "object" ? JSON.stringify(message) : message));
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-[var(--color-cyan-dim)] text-[var(--color-cyan)] flex items-center justify-center border border-[rgba(0,212,255,0.3)]">
            <FiActivity size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-disp)" }}>Command Center</h1>
            <p className="text-xs text-[var(--color-text2)] mt-1">Live Vapi Campaign Monitoring Architecture</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Setup Block */}
        <div className="p-5 rounded-[16px] border bg-[var(--color-bg2)] border-[var(--color-border)] flex flex-col gap-4">
          <h3 className="text-sm font-bold border-b pb-3 border-[var(--color-border)] flex justify-between items-center">
            1. Campaign Setup
            {campaignId && <span className="text-[10px] text-[var(--color-green)] bg-[var(--color-green-dim)] px-2 py-0.5 rounded-md">INITIALIZED: {campaignId}</span>}
          </h3>
          
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">Campaign Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={S.input} placeholder="e.g., Q3 Follow-ups" disabled={!!campaignId}/>
            </div>
            <div className="flex gap-3">
               <div className="flex flex-col gap-1.5 flex-1">
                 <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">Assistant ID *</label>
                 <input type="text" value={form.assistantId} onChange={e => setForm({...form, assistantId: e.target.value})} style={S.input} placeholder="ast_xyz123" disabled={!!campaignId}/>
               </div>
               <div className="flex flex-col gap-1.5 flex-1">
                 <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">Phone Number ID *</label>
                 {phoneNumbersData && phoneNumbersData.length > 0 ? (
                   <select
                     value={form.phoneNumberId}
                     onChange={e => setForm({...form, phoneNumberId: e.target.value})}
                     style={{ ...S.input, cursor: "pointer" }}
                     disabled={!!campaignId}>
                     <option value="">— Select a phone number —</option>
                     {phoneNumbersData.map((pn: PhoneNumber) => (
                       <option key={pn.id} value={pn.id}>{pn.name || pn.number} ({pn.provider})</option>
                     ))}
                   </select>
                 ) : (
                   <input type="text" value={form.phoneNumberId} onChange={e => setForm({...form, phoneNumberId: e.target.value})} style={S.input} placeholder="Required (e.g. pnz_xxx)" disabled={!!campaignId}/>
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
                        <button onClick={() => setSelectedContacts((p) => p.filter((id) => id !== cid))} className="ml-1 text-[var(--color-text)] hover:text-white"><FiX size={10}/></button>
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
            <button style={{...S.btnPrimary, width: '100%'}} onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Initialize Campaign"}
            </button>
          )}
        </div>

        {/* Trigger Block */}
        <div className="p-5 rounded-[16px] border bg-[var(--color-bg2)] border-[var(--color-border)] flex flex-col gap-4 relative" style={{ opacity: campaignId ? 1 : 0.5 }}>
          {!campaignId && <div className="absolute inset-0 z-10 cursor-not-allowed"></div>}
          <h3 className="text-sm font-bold border-b pb-3 border-[var(--color-border)]">2. Trigger Calls</h3>

          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text2)]">
              Lead List <span className="font-normal text-[var(--color-text3)]">({selectedContacts.length} contacts added)</span>
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
          </div>

          <button style={{...S.btnPrimary, width: '100%', background: 'var(--color-green)', borderColor: 'var(--color-green)'}} onClick={handleStart} disabled={starting || !campaignId}>
            <FiPlay /> {starting ? "Sending..." : "Start Outbound Calls"}
          </button>
        </div>
      </div>

      {/* Live Monitor View */}
      <div className="mt-4 flex flex-col gap-4">
        <h2 className="text-lg font-bold border-b pb-2 border-[var(--color-border)] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-red)] animate-pulse shadow-[0_0_8px_var(--color-red)]"></span>
          Live Stream
        </h2>
        
        {Object.keys(liveCalls).length === 0 ? (
          <div className="text-center p-12 text-[var(--color-text3)] text-sm border border-dashed rounded-xl border-[var(--color-border2)]">
            Waiting for webhook events...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(liveCalls).map(call => (
              <div key={call.callId} className="flex flex-col gap-3 p-4 rounded-[14px] border border-[var(--color-border2)] bg-[var(--color-bg)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--color-text3)] truncate mw-[120px]">{call.callId}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${call.status === 'active' ? 'bg-[var(--color-green-dim)] text-[var(--color-green)] border border-[rgba(var(--color-green-rgb),0.3)]' : 'bg-[var(--color-bg3)] text-[var(--color-text2)]'}`}>
                    {call.status}
                  </span>
                </div>
                
                <div className="h-[200px] overflow-y-auto pr-2 flex flex-col gap-2 p-2 rounded-lg bg-[var(--color-bg2)] border border-[var(--color-bg3)] text-xs font-mono">
                  {call.transcripts.length === 0 ? (
                    <span className="text-[var(--color-text3)] italic">Connecting audio...</span>
                  ) : (
                    call.transcripts.map((t, idx) => (
                      <div key={idx} className={`flex flex-col ${t.speaker === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`px-2 py-1.5 rounded-md max-w-[90%] ${t.speaker === 'user' ? 'bg-[var(--color-bg3)] text-[var(--color-text2)]' : 'bg-[var(--color-cyan-dim)] text-[var(--color-cyan)]'}`}>
                          {t.text}
                        </div>
                      </div>
                    ))
                  )}
                  {/* Auto-scroll anchor logic via CSS would be ideal here */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
