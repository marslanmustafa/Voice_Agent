"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiMail, FiLock, FiUser, FiArrowRight, FiAlertCircle, FiLoader } from "react-icons/fi";
import { RiRobot2Line } from "react-icons/ri";
import { AuthShell } from "@/components/shared/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/email/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Registration failed"); setLoading(false); return; }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) setError("Account created but sign-in failed. Please log in.");
      else router.push("/onboarding");
    } catch { setError("Something went wrong. Please try again."); }
    setLoading(false);
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[400px] rounded-[20px] p-9 border"
        style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
        <div className="flex flex-col items-center mb-7">
          <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center border mb-4"
            style={{ background: "var(--color-cyan-dim)", borderColor: "rgba(0,212,255,0.2)", color: "var(--color-cyan)" }}>
            <RiRobot2Line size={24} />
          </div>
          <h1 className="text-[22px] font-extrabold mb-1.5" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Create your account</h1>
          <p className="text-xs" style={{ color: "var(--color-text2)" }}>Get started with VoiceAgent today</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] text-xs border"
              style={{ background: "var(--color-red-dim)", borderColor: "rgba(255,77,106,0.25)", color: "var(--color-red)" }}>
              <FiAlertCircle size={12} /> {error}
            </div>
          )}
          {([
            { icon: <FiUser size={11}/>, label: "Full Name",      type: "text",     value: name,     set: setName,     ph: "John Doe",          req: false },
            { icon: <FiMail size={11}/>, label: "Email Address",  type: "email",    value: email,    set: setEmail,    ph: "you@example.com",    req: true  },
            { icon: <FiLock size={11}/>, label: "Password",       type: "password", value: password, set: setPassword, ph: "Min. 8 characters",  req: true  },
          ] as const).map(({ icon, label, type, value, set, ph, req }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-text2)" }}>
                {icon} {label}
              </label>
              <input type={type} value={value} onChange={(e) => (set as any)(e.target.value)}
                placeholder={ph} required={req}
                className="px-3.5 py-3 rounded-[10px] border text-sm outline-none transition-colors"
                style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-cyan)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--color-border2)")} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--color-cyan)", color: "#000", border: "none" }}>
            {loading ? <><FiLoader size={14} className="spin" /> Creating account…</> : <>Create Account <FiArrowRight size={13} /></>}
          </button>
        </form>

        <p className="text-center mt-5 text-xs" style={{ color: "var(--color-text2)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--color-cyan)" }}>Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}
