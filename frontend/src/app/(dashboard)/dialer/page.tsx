"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { FiPhone, FiLoader, FiCheckCircle, FiVolume2, FiVolumeX, FiActivity, FiMic } from "react-icons/fi";
import { RiRobot2Line, RiSparklingLine } from "react-icons/ri";
import { useDialCallMutation } from "@/store/api/allApis";
import { useLiveAudio } from "@/hooks/useLiveAudio";
import { useLiveTranscript } from "@/hooks";

const S = {
  input: { background: "var(--color-bg3)", border: "1px solid var(--color-border2)", borderRadius: 12, padding: "12px 16px", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 13, outline: "none", width: "100%", transition: "all 0.3s ease" },
  glass: { background: "rgba(20, 20, 20, 0.4)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255, 255, 255, 0.05)", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)" }
} as const;

export default function DialerPage() {
  const router = useRouter();
  const [dialCall, { isLoading }] = useDialCallMutation();
  const [activeListenUrl, setActiveListenUrl] = useState<string | null>(null);
  const { isListening, startListening, stopListening, error } = useLiveAudio(activeListenUrl);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  
  useLiveTranscript(activeCallId);
  const liveTranscript = useSelector((state: any) => activeCallId ? state.calls.liveTranscript[activeCallId] : null);

  const [form, setForm] = useState({
    phone_to: "",
    first_message: "Hello, this is your virtual assistant. How can I help you?",
    system_prompt: "You are a professional, friendly AI assistant calling on behalf of a company. Keep the conversation engaging and brief.",
  });

  const up = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleDial = async () => {
    if (!form.phone_to) return;
    try {
      const res = await dialCall(form).unwrap();
      if (res.ok && res.listen_url) {
        setActiveListenUrl(res.listen_url);
        setActiveCallId(res.call_id);
      } else {
        alert("Call queued, but lack of listen URL returned.");
        router.push("/calls");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to initiate call. Check console or Vapi configuration.");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-10">
      <div className="relative overflow-hidden rounded-[24px] p-8 mt-4 border border-[rgba(255,255,255,0.05)]" style={{ background: "linear-gradient(135deg, var(--color-bg2) 0%, var(--color-bg) 100%)" }}>
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <RiSparklingLine size={120} color="var(--color-cyan)" />
        </div>
        <div className="relative z-10">
          <h1 className="text-[28px] font-bold tracking-tight mb-2" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Smart Dialer</h1>
          <p className="text-sm max-w-md leading-relaxed" style={{ color: "var(--color-text2)" }}>Initialize one-off ad-hoc calls dynamically modifying your core Assistant's behavior.</p>
        </div>
      </div>

      <div className="flex justify-center w-full relative">
        {activeListenUrl && (
           <div className={`absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-3xl rounded-full transition-opacity duration-1000 ${isListening ? "opacity-100" : "opacity-0"}`}/>
        )}

        {activeListenUrl ? (
          <div className="w-full max-w-[650px] flex flex-col gap-6 p-8 rounded-[24px] items-center text-center relative z-10 overflow-hidden transition-all duration-500" style={S.glass}>
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, var(--color-cyan), transparent)" }} />

            <div className="relative mt-4">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20 scale-[1.5]" style={{ background: "var(--color-cyan)" }} />
              <div className="w-24 h-24 rounded-full flex items-center justify-center border z-10 relative shadow-[0_0_40px_rgba(0,212,255,0.15)]" style={{ background: "var(--color-bg3)", borderColor: isListening ? "var(--color-cyan)" : "var(--color-border2)" }}>
                 {isListening ? <FiActivity size={36} color="var(--color-cyan)" className="animate-pulse" /> : <FiPhone size={36} color="var(--color-text2)" />}
              </div>
            </div>
            
            <div className="mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3" style={{ background: "rgba(0,212,255,0.1)", color: "var(--color-cyan)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
                Active Session
              </div>
              <h2 className="text-[22px] font-medium tracking-tight mb-1" style={{ color: "var(--color-text)" }}>{form.phone_to}</h2>
              <p className="text-xs opacity-60">Connected via Vapi WebSocket</p>
            </div>

            <div className="flex gap-4 w-full mt-6">
              <button onClick={isListening ? stopListening : startListening} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-[16px] text-sm font-semibold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: isListening ? "linear-gradient(135deg, #1f0808 0%, #300c0c 100%)" : "linear-gradient(135deg, var(--color-cyan-dim) 0%, rgba(0,212,255,0.05) 100%)", color: isListening ? "#ff5555" : "var(--color-cyan)", border: `1px solid ${isListening ? "rgba(255,50,50,0.2)" : "rgba(0,212,255,0.3)"}` }}>
                {isListening ? <FiVolumeX size={18}/> : <FiVolume2 size={18}/>}
                {isListening ? "Mute Feed" : "Stream Audio"}
              </button>

              <button onClick={() => setShowTranscript(s => !s)} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-[16px] text-sm font-semibold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: showTranscript ? "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)" : "var(--color-bg3)", color: showTranscript ? "var(--color-text)" : "var(--color-text2)", border: `1px solid ${showTranscript ? "rgba(255,255,255,0.1)" : "var(--color-border2)"}` }}>
                <FiMic size={18}/>
                {showTranscript ? "Hide Transcript" : "View Transcript"}
              </button>
            </div>
            
            {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 w-full animate-in fade-in">{error}</div>}

            {/* Live Transcript Panel */}
            <div className={`w-full overflow-hidden transition-all duration-500 ease-in-out ${showTranscript ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"}`}>
              <div className="w-full text-left rounded-[16px] border p-5 flex flex-col gap-3 shadow-inner" style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.05)" }}>
                
                <div className="flex justify-between items-center sticky top-0 mb-2 border-b border-white/5 pb-3">
                   <h4 className="text-[10px] uppercase tracking-widest flex items-center gap-2 font-bold" style={{ color: "var(--color-text2)" }}>
                    <FiActivity size={12} className="opacity-50"/> Speech to Text Engine
                  </h4>
                  <span className="text-[9px] px-2 py-0.5 rounded border border-white/10 opacity-50">Live</span>
                </div>

                <div className="max-h-[250px] overflow-y-auto flex flex-col gap-3 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {liveTranscript && liveTranscript.length > 0 ? (
                    liveTranscript.map((seg: any, i: number) => (
                      <div key={i} className={`flex flex-col gap-1.5 px-4 py-3 rounded-[12px] border text-[13px] animate-in slide-in-from-bottom-2 flex-shrink-0 w-fit max-w-[85%] ${seg.speaker === "user" ? "self-end items-end" : "self-start items-start"}`}
                        style={{
                          background:   seg.speaker === "user" ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)",
                          borderColor:  seg.speaker === "user" ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.05)",
                          borderBottomRightRadius: seg.speaker === "user" ? 2 : 12,
                          borderBottomLeftRadius: seg.speaker === "user" ? 12 : 2,
                        }}>
                        <span className="text-[9px] uppercase tracking-wider font-bold opacity-60" style={{ color: seg.speaker === "user" ? "var(--color-cyan)" : "var(--color-text2)" }}>
                          {seg.speaker === "user" ? "Customer" : "AI Assistant"}
                        </span>
                        <span style={{ color: "var(--color-text)", lineHeight: 1.5 }}>{seg.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-3">
                      <FiMic size={24} className="animate-pulse"/>
                      <p className="text-xs text-center font-medium">Monitoring audio channels...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[650px] flex flex-col p-8 rounded-[24px] border relative overflow-hidden" style={S.glass}>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-full flex items-center justify-center border shadow-lg" style={{ background: "linear-gradient(135deg, var(--color-cyan-dim) 0%, rgba(0,212,255,0) 100%)", borderColor: "rgba(0,212,255,0.3)", color: "var(--color-cyan)" }}>
                <FiPhone size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>Launch Campaign Dial</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text3)" }}>Instantly push out an unscripted outbound ping.</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider pl-1" style={{ color: "var(--color-text2)" }}>Target Destination</label>
                <div className="relative">
                  <FiPhone className="absolute left-4 top-[14px] opacity-40"/>
                  <input type="text" value={form.phone_to} placeholder="+1 (415) 555-2671" autoFocus
                    onChange={(e) => up("phone_to", e.target.value)}
                    style={{...S.input, paddingLeft: 42}} 
                    onFocus={(e) => {e.currentTarget.style.borderColor = "var(--color-cyan)"; e.currentTarget.style.boxShadow = "0 0 0 1px var(--color-cyan)"}} 
                    onBlur={(e) => {e.currentTarget.style.borderColor = "var(--color-border2)"; e.currentTarget.style.boxShadow = "none"}}/>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider pl-1 flex items-center gap-2" style={{ color: "var(--color-text2)" }}>
                   Greeting Injection <span className="bg-white/5 text-[9px] px-1.5 py-0.5 rounded opacity-70">Optional</span>
                </label>
                <div className="relative">
                  <input type="text" value={form.first_message} placeholder="Hi! I am calling from..."
                    onChange={(e) => up("first_message", e.target.value)}
                    style={S.input} 
                    onFocus={(e) => {e.currentTarget.style.borderColor = "var(--color-cyan)"; e.currentTarget.style.boxShadow = "0 0 0 1px var(--color-cyan)"}} 
                    onBlur={(e) => {e.currentTarget.style.borderColor = "var(--color-border2)"; e.currentTarget.style.boxShadow = "none"}}/>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider pl-1 flex items-center gap-2" style={{ color: "var(--color-text2)" }}>
                   System Prompt Override <span className="bg-white/5 text-[9px] px-1.5 py-0.5 rounded opacity-70">Optional</span>
                </label>
                <textarea rows={6} value={form.system_prompt} placeholder="You are an AI assistant..."
                  onChange={(e) => up("system_prompt", e.target.value)}
                  style={{ ...S.input, resize: "vertical", lineHeight: 1.5 } as any} 
                  onFocus={(e) => {e.currentTarget.style.borderColor = "var(--color-cyan)"; e.currentTarget.style.boxShadow = "0 0 0 1px var(--color-cyan)"}} 
                  onBlur={(e) => {e.currentTarget.style.borderColor = "var(--color-border2)"; e.currentTarget.style.boxShadow = "none"}}/>
              </div>

              <button onClick={handleDial} disabled={isLoading || !form.phone_to} className="w-full flex items-center justify-center gap-3 mt-4 h-[52px] rounded-[14px] text-[15px] font-bold transition-all disabled:opacity-40 disabled:hover:scale-100 hover:scale-[1.01] active:scale-[0.99] shadow-lg"
                style={{ background: "linear-gradient(135deg, var(--color-cyan) 0%, #00bfff 100%)", color: "#000", border: "none", cursor: "pointer" }}>
                {isLoading ? <FiLoader size={18} className="spin"/> : <FiPhone size={18}/>}
                {isLoading ? "Negotiating Handshake..." : "Execute Call"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
