"use client";

import { useState } from "react";
import Link from "next/link";
import { FiPlus, FiPlay, FiStopCircle, FiClock, FiRadio, FiX, FiCheck, FiTrash2 } from "react-icons/fi";
import { useGetCampaignsQuery, useCreateCampaignMutation, useLaunchCampaignMutation, useDeleteCampaignMutation, useCancelCampaignMutation, useGetContactsQuery } from "@/store/api/allApis";
import type { Campaign, Contact } from "@/types";

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:     { color: "var(--color-text3)",  label: "Draft"     },
  scheduled: { color: "var(--color-amber)",  label: "Scheduled" },
  running:   { color: "var(--color-green)",  label: "Running"   },
  done:      { color: "var(--color-cyan)",   label: "Completed" },
  cancelled: { color: "var(--color-red)",    label: "Cancelled" },
};

const S = {
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "9px 12px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%" },
  btnPrimary: { background: "var(--color-cyan)", color: "#000", border: "1px solid var(--color-cyan)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  btnGhost: { background: "none", color: "var(--color-text2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
} as const;

export default function CampaignsPage() {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", topic: "", first_message: "", system_prompt: "You are a professional AI assistant calling on behalf of a company. Keep calls under 5 minutes.", max_concurrent: 3, retry_count: 1 });
  const { data, isLoading, refetch } = useGetCampaignsQuery({});
  const { data: contactsData } = useGetContactsQuery({});
  const [createCampaign] = useCreateCampaignMutation();
  const [launchCampaign] = useLaunchCampaignMutation();
  const [deleteCampaign] = useDeleteCampaignMutation();
  const [cancelCampaign] = useCancelCampaignMutation();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const handleCreate = async () => {
    if (!form.name) return;
    await createCampaign({ ...form, contact_ids: selectedContacts } as any);
    setShowNew(false);
    setSelectedContacts([]);
    setForm({ ...form, name: "", topic: "", first_message: "" });
    refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[12px] border flex items-center justify-center"
            style={{ background: "var(--color-amber-dim)", borderColor: "rgba(245,166,35,0.2)", color: "var(--color-amber)" }}>
            <FiRadio size={18}/>
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Campaigns</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text2)" }}>{data?.total ?? 0} campaign{data?.total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button style={S.btnPrimary} onClick={() => setShowNew(true)}><FiPlus size={13}/> New Campaign</button>
      </div>

      {/* New form */}
      {showNew && (
        <div className="p-5 rounded-[14px] border flex flex-col gap-4" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Create Campaign</h3>
            <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: "var(--color-text3)", cursor: "pointer" }}><FiX size={13}/></button>
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {[["Campaign Name *","name","text",true],["Topic / Goal","topic","text",false],["Opening Message","first_message","text",false]].map(([lbl,key,type,_req]) => (
              <div key={key as string} className="flex flex-col gap-1.5" style={key === "name" ? { gridColumn: "1 / -1" } : {}}>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>{lbl as string}</label>
                <input type={type as string} value={(form as any)[key as string]} onChange={(e) => setForm({...form, [key as string]: e.target.value})}
                  style={S.input}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"}
                  onBlur={(e)  => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>Max Concurrent</label>
              <input type="number" min={1} max={10} value={form.max_concurrent}
                onChange={(e) => setForm({...form, max_concurrent: parseInt(e.target.value)||3})}
                style={S.input}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
            </div>
            <div className="flex flex-col gap-1.5" style={{ gridColumn: "1 / -1" }}>
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>
                Contacts <span style={{ color: "var(--color-text3)", fontWeight: 400 }}>({selectedContacts.length} selected)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {selectedContacts.map((cid) => {
                  const contact = contactsData?.contacts?.find((c: Contact) => c.id === cid);
                  return (
                    <span key={cid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)", border: "1px solid rgba(0,212,255,0.3)" }}>
                      {contact?.name ?? cid}
                      <button onClick={() => setSelectedContacts((p) => p.filter((id) => id !== cid))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}><FiX size={9}/></button>
                    </span>
                  );
                })}
              </div>
              <select
                value=""
                onChange={(e) => { const v = e.target.value; if (v && !selectedContacts.includes(v)) setSelectedContacts((p) => [...p, v]); }}
                style={{ ...S.input, cursor: "pointer" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--color-cyan)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--color-border2)")}>
                <option value="">— Add a contact —</option>
                {contactsData?.contacts
                  ?.filter((c: Contact) => !selectedContacts.includes(c.id))
                  .map((c: Contact) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5" style={{ gridColumn: "1 / -1" }}>
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>System Prompt</label>
              <textarea rows={3} value={form.system_prompt} onChange={(e) => setForm({...form, system_prompt: e.target.value})}
                style={{ ...S.input, resize: "vertical" } as any}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button style={S.btnGhost} onClick={() => setShowNew(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={handleCreate} disabled={!form.name}><FiCheck size={12}/> Create Campaign</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-3 p-12 rounded-[14px] border text-xs" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent spin" style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }}/> Loading…
          </div>
        ) : !data?.campaigns.length ? (
          <div className="col-span-full flex flex-col items-center gap-3 p-12 rounded-[14px] border text-center text-xs" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", color: "var(--color-text3)" }}>
            <FiRadio size={22}/><p className="text-sm font-semibold" style={{ color: "var(--color-text2)" }}>No campaigns yet</p>
            <button style={S.btnPrimary} onClick={() => setShowNew(true)}><FiPlus size={12}/> New Campaign</button>
          </div>
        ) : data.campaigns.map((c: Campaign) => {
          const meta = STATUS_META[c.status] ?? STATUS_META.draft;
          const pct = c.call_count > 0 ? Math.round((c.completed_count / c.call_count) * 100) : 0;
          return (
            <div key={c.id} className="flex flex-col gap-3.5 p-5 rounded-[14px] border transition-all" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
              <Link href={`/campaigns/${c.id}`} style={{ textDecoration: "none" }} className="flex flex-col gap-3.5 flex-1">
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: meta.color, background: `${meta.color}15`, borderColor: `${meta.color}40` }}>{meta.label}</span>
                  <h3 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>{c.name}</h3>
                  {c.topic && <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text2)" }}>{c.topic}</p>}
                </div>
                {c.call_count > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-bg3)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }}/>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--color-text3)" }}>{c.completed_count}/{c.call_count} calls · {pct}%</span>
                  </div>
                )}
                <div className="flex gap-3 text-[11px] flex-wrap" style={{ color: "var(--color-text2)" }}>
                  <span className="flex items-center gap-1.5"><FiPlus size={10}/> {c.contact_count} contacts</span>
                  <span className="flex items-center gap-1.5"><FiClock size={10}/> {c.call_count} calls</span>
                </div>
              </Link>
              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                {c.status === "draft" && (
                  <button onClick={async (e) => { e.stopPropagation(); await launchCampaign(c.id); refetch(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] text-xs font-bold transition-all"
                    style={{ background: "var(--color-green)", color: "#000", border: "none", cursor: "pointer" }}>
                    <FiPlay size={11}/> Launch
                  </button>
                )}
                {c.status === "running" && (
                  <>
                    <div className="flex-1 flex items-center gap-1.5 py-2 rounded-[8px] text-xs font-semibold"
                      style={{ background: "var(--color-green-dim)", color: "var(--color-green)", paddingLeft: 12 }}>
                      <FiStopCircle size={11}/> Running…
                    </div>
                    <button onClick={async (e) => { e.stopPropagation(); if (!confirm("Cancel this campaign?")) return; await cancelCampaign(c.id); refetch(); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all"
                      style={{ background: "var(--color-bg3)", color: "var(--color-red)", border: "1px solid var(--color-border2)", cursor: "pointer" }}>
                      <FiStopCircle size={11}/> Cancel
                    </button>
                  </>
                )}
                {c.status === "done" && (
                  <div className="flex-1 flex items-center gap-1.5 py-2 rounded-[8px] text-xs font-semibold"
                    style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)", paddingLeft: 12 }}>
                    <FiCheck size={11}/> Completed
                  </div>
                )}
                {c.status === "cancelled" && (
                  <div className="flex-1 flex items-center gap-1.5 py-2 rounded-[8px] text-xs font-semibold"
                    style={{ background: "var(--color-bg3)", color: "var(--color-text3)", paddingLeft: 12 }}>
                    Cancelled
                  </div>
                )}
                {c.status === "scheduled" && (
                  <>
                    <div className="flex-1 flex items-center gap-1.5 py-2 rounded-[8px] text-xs font-semibold"
                      style={{ background: "rgba(245,166,35,0.15)", color: "var(--color-amber)", paddingLeft: 12 }}>
                      <FiClock size={11}/> Scheduled
                    </div>
                    <button onClick={async (e) => { e.stopPropagation(); if (!confirm("Cancel this campaign?")) return; await cancelCampaign(c.id); refetch(); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-xs font-bold transition-all"
                      style={{ background: "var(--color-bg3)", color: "var(--color-red)", border: "1px solid var(--color-border2)", cursor: "pointer" }}>
                      <FiStopCircle size={11}/> Cancel
                    </button>
                  </>
                )}
                <button onClick={async (e) => { e.stopPropagation(); if (!confirm("Delete campaign?")) return; await deleteCampaign(c.id); refetch(); }}
                  className="w-8 h-8 rounded-[7px] border flex items-center justify-center transition-all"
                  style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text2)", cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-red)"; e.currentTarget.style.color = "var(--color-red)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border2)"; e.currentTarget.style.color = "var(--color-text2)"; }}>
                  <FiTrash2 size={12}/>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
