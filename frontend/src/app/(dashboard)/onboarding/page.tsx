"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiArrowLeft, FiMic, FiFileText, FiShield, FiCheck, FiLoader, FiCheckCircle } from "react-icons/fi";
import { RiRobot2Line } from "react-icons/ri";
import { useUpdateConfigMutation } from "@/store/api/allApis";

const S = {
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 8, padding: "10px 14px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", width: "100%", transition: "border-color 0.2s" },
} as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [updateConfig, { isLoading }] = useUpdateConfigMutation();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    vapi_assistant_id: "", max_call_duration: 300, retry_count: 1,
  });
  const up = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleFinish = async () => {
    await updateConfig(form as any);
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <header className="flex items-center gap-3 px-7 py-4 border-b" style={{ borderColor: "var(--color-border)", background: "rgba(13,17,23,0.85)" }}>
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center border" style={{ background: "var(--color-cyan-dim)", borderColor: "rgba(0,212,255,0.2)", color: "var(--color-cyan)" }}>
          <RiRobot2Line size={18}/>
        </div>
        <div>
          <div className="font-bold text-sm" style={{ fontFamily: "var(--font-disp)", color: "#e8f0f8" }}>VoiceAgent</div>
          <div className="text-[10px]" style={{ color: "var(--color-text2)" }}>Setup Wizard</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10 gap-6">
        <div className="w-full max-w-[560px] rounded-[16px] border p-8" style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-[18px] font-bold flex items-center gap-2 mb-1" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>
                <FiShield size={19} className="text-cyan-400"/> Vapi Configuration
              </h2>
              <p className="text-xs" style={{ color: "var(--color-text2)" }}>VoiceAgent is natively powered by Vapi. Manage your AI voices and prompts directly on your Vapi Dashboard, then connect your Assistant here.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>Vapi Assistant ID</label>
              <input type="text" value={form.vapi_assistant_id} placeholder="799d1a7f-... (from Vapi dashboard)"
                onChange={(e) => up("vapi_assistant_id", e.target.value)}
                style={S.input} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>Max Duration (sec)</label>
              <input type="number" value={form.max_call_duration} placeholder="300"
                onChange={(e) => up("max_call_duration", parseInt(e.target.value)||0)}
                style={S.input} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text2)" }}>Retry Count</label>
              <input type="number" value={form.retry_count} placeholder="1"
                onChange={(e) => up("retry_count", parseInt(e.target.value)||0)}
                style={S.input} onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-cyan)"} onBlur={(e) => e.currentTarget.style.borderColor = "var(--color-border2)"}/>
            </div>
          </div>

          <div className="flex justify-end items-center mt-8 pt-5 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button onClick={handleFinish} disabled={isLoading || done || !form.vapi_assistant_id} className="flex items-center gap-1.5 px-6 py-3 rounded-[10px] text-xs font-bold transition-all disabled:opacity-70"
              style={{ background: done ? "var(--color-green)" : "var(--color-cyan)", color: "#000", border: "none", cursor: "pointer" }}>
              {isLoading ? <FiLoader size={14} className="spin"/> : done ? <FiCheckCircle size={14}/> : <FiCheck size={14}/>}
              {done ? "Connected!" : isLoading ? "Linking…" : "Complete Setup"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
