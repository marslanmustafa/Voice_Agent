"use client";

import { useState, useRef } from "react";
import { FiPlus, FiSearch, FiDownload, FiUpload, FiTrash2, FiX, FiCheck, FiUsers } from "react-icons/fi";
import { useGetContactsQuery, useCreateContactMutation, useDeleteContactMutation, useImportCsvMutation } from "@/store/api/allApis";
import type { Contact } from "@/types";

const S = {
  card: { background: "var(--color-bg2)", border: "1px solid var(--color-border)", borderRadius: 14 },
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "9px 12px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%" },
  btnPrimary: { background: "var(--color-cyan)", color: "#000", border: "1px solid var(--color-cyan)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
  btnGhost: { background: "var(--color-bg2)", color: "var(--color-text2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
} as const;

export default function ContactsPage() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", tag: "" });

  const { data, isLoading, refetch } = useGetContactsQuery({ search: search || undefined });
  const [createContact] = useCreateContactMutation();
  const [deleteContact] = useDeleteContactMutation();
  const [importCsv]     = useImportCsvMutation();

  const handleAdd = async () => {
    if (!form.name || !form.phone) return;
    await createContact(form as any);
    setForm({ name: "", phone: "", email: "", tag: "" });
    setShowAdd(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    await deleteContact(id); refetch();
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const res = await importCsv(fd) as any;
    alert(`Imported: ${res.data?.imported ?? 0}, Skipped: ${res.data?.skipped ?? 0}`);
    refetch(); if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob(["name,phone,email,tag,notes\nJohn Doe,+12345678901,john@example.com,Lead,Follow up\n"], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "contacts_template.csv"; a.click();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[12px] border flex items-center justify-center"
            style={{ background: "var(--color-cyan-dim)", borderColor: "rgba(0,212,255,0.2)", color: "var(--color-cyan)" }}>
            <FiUsers size={18} />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Contacts</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text2)" }}>{data?.total ?? 0} total</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button style={S.btnGhost} onClick={downloadTemplate}><FiDownload size={12}/> CSV Template</button>
          <label style={S.btnGhost as any}><FiUpload size={12}/> Import CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv}/>
          </label>
          <button style={S.btnPrimary} onClick={() => setShowAdd(true)}><FiPlus size={13}/> Add Contact</button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border transition-colors"
        style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", color: "var(--color-text2)" }}
        onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"}
        onBlur={(e)  => e.currentTarget.style.borderColor = "var(--color-border)"}>
        <FiSearch size={13}/>
        <input type="text" placeholder="Search by name or phone…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-xs" style={{ color: "var(--color-text)" }}/>
        {search && <button className="flex" onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "var(--color-text3)" }}><FiX size={11}/></button>}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-5 rounded-[14px] border flex flex-col gap-4" style={S.card}>
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>New Contact</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: "var(--color-text3)", cursor: "pointer" }}><FiX size={13}/></button>
          </div>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {[["Full Name*","text","name"],["Phone*","text","phone"],["Email","email","email"],["Tag","text","tag"]].map(([lbl,type,key]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>{lbl}</label>
                <input type={type} value={(form as any)[key]} onChange={(e) => setForm({...form, [key]: e.target.value})}
                  style={S.input}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"}
                  onBlur={(e)  => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button style={S.btnGhost} onClick={() => setShowAdd(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={handleAdd} disabled={!form.name || !form.phone}><FiCheck size={12}/> Save Contact</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[14px] border overflow-hidden" style={S.card}>
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 p-12 text-xs" style={{ color: "var(--color-text3)" }}>
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent spin" style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }}/>
            Loading contacts…
          </div>
        ) : !data?.contacts.length ? (
          <div className="flex flex-col items-center gap-3 p-12 text-xs text-center" style={{ color: "var(--color-text3)" }}>
            <FiUsers size={22}/><p className="text-sm font-semibold" style={{ color: "var(--color-text2)" }}>No contacts yet</p>
            <span>Add your first contact or import a CSV</span>
            <button style={S.btnPrimary} onClick={() => setShowAdd(true)}><FiPlus size={12}/> Add Contact</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name","Phone","Email","Tag",""].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider px-4 py-3 border-b whitespace-nowrap"
                      style={{ color: "var(--color-text2)", borderColor: "var(--color-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((c: Contact) => (
                  <tr key={c.id} className="border-b last:border-0 group"
                    style={{ borderColor: "var(--color-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--color-text)" }}>{c.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text2)", fontFamily: "var(--font-mono)" }}>{c.phone}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text2)" }}>{c.email || <span style={{ color: "var(--color-text3)" }}>—</span>}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.tag ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--color-cyan-dim)", color: "var(--color-cyan)" }}>{c.tag}</span>
                              : <span style={{ color: "var(--color-text3)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(c.id)}
                        className="w-7 h-7 rounded-[7px] border flex items-center justify-center transition-all"
                        style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text2)", cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-red)"; e.currentTarget.style.color = "var(--color-red)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border2)"; e.currentTarget.style.color = "var(--color-text2)"; }}>
                        <FiTrash2 size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
