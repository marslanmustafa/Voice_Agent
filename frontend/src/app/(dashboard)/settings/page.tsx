"use client";

import { useState, useEffect } from "react";
import { FiSave, FiLoader, FiCheckCircle } from "react-icons/fi";
import { useGetConfigQuery, useUpdateConfigMutation } from "@/store/api/allApis";
import type { UserConfig } from "@/types";

const S = {
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "9px 12px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%" },
  label: { fontSize: 10, color: "var(--color-text2)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" },
} as const;

export default function SettingsPage() {
  const { data: config, isLoading } = useGetConfigQuery();
  const [updateConfig, { isLoading: saving }] = useUpdateConfigMutation();
  const [saved, setSaved] = useState(false);
  const [form, setForm]   = useState<Partial<UserConfig>>({});

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const up = (key: keyof UserConfig, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    await updateConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center p-20 text-xs" style={{ color: "var(--color-text3)" }}>
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent spin mr-3" style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }}/> Loading config…
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Settings</h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text2)" }}>VoiceAgent is natively powered by Vapi. Manage your AI voices and prompts directly on your Vapi Dashboard.</p>
        </div>
        <button onClick={handleSave} disabled={saving || saved}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{ background: saved ? "var(--color-green)" : "var(--color-cyan)", color: "#000", border: "none", cursor: "pointer" }}>
          {saving ? <FiLoader size={13} className="spin"/> : saved ? <FiCheckCircle size={13}/> : <FiSave size={13}/>}
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
        
        {/* Vapi */}
        <Card title="Vapi Configuration">
          <p className="text-xs mb-3" style={{ color: "var(--color-text2)" }}>Link your Vapi Assistant to this platform. You can find your Assistant ID in your Vapi dashboard under the Assistants tab.</p>
          <Field label="Vapi Assistant ID">
            <input type="text" value={form.vapi_assistant_id ?? ""} onChange={(e) => up("vapi_assistant_id", e.target.value)}
              placeholder="799d1a7f-... (from Vapi dashboard)"
              style={S.input} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
          </Field>
        </Card>

        {/* Call Defaults */}
        <Card title="Call Limits">
          <Field label="Max Duration (seconds)">
            <input type="number" min={30} max={3600} value={form.max_call_duration ?? 300}
              onChange={(e) => up("max_call_duration", parseInt(e.target.value))}
              style={S.input} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
          </Field>
          <Field label="Retry Count">
            <input type="number" min={0} max={5} value={form.retry_count ?? 1}
              onChange={(e) => up("retry_count", parseInt(e.target.value))}
              style={S.input} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
          </Field>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-[12px] border" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
      <h2 className="text-sm font-bold pb-2.5 border-b" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)", borderColor: "var(--color-border)" }}>{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>{label}</label>
      {children}
    </div>
  );
}
