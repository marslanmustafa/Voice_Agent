"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiMail, FiLock, FiArrowRight, FiAlertCircle, FiLoader } from "react-icons/fi";
import { RiRobot2Line } from "react-icons/ri";
import { AuthShell } from "@/components/shared/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) setError("Invalid email or password");
    else router.push("/dashboard");
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
          <h1 className="text-[22px] font-extrabold mb-1.5" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Welcome back</h1>
          <p className="text-xs" style={{ color: "var(--color-text2)" }}>Sign in to your VoiceAgent dashboard</p>
        </div>

        <button type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-[10px] border text-sm transition-all"
          style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5 text-[10px]" style={{ color: "var(--color-text3)" }}>
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
          or continue with email
          <div className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] text-xs border"
              style={{ background: "var(--color-red-dim)", borderColor: "rgba(255,77,106,0.25)", color: "var(--color-red)" }}>
              <FiAlertCircle size={12} /> {error}
            </div>
          )}
          {([
            { icon: <FiMail size={11}/>, label: "Email Address", type: "email",    value: email,    set: setEmail,    ph: "you@example.com" },
            { icon: <FiLock size={11}/>, label: "Password",      type: "password", value: password, set: setPassword, ph: "••••••••" },
          ] as const).map(({ icon, label, type, value, set, ph }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-text2)" }}>
                {icon} {label}
              </label>
              <input type={type} value={value} onChange={(e) => (set as any)(e.target.value)} placeholder={ph} required
                className="px-3.5 py-3 rounded-[10px] border text-sm outline-none transition-colors"
                style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-cyan)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--color-border2)")} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="mt-1 w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "var(--color-cyan)", color: "#000", border: "none" }}>
            {loading ? <><FiLoader size={14} className="spin" /> Signing in…</> : <>Sign In <FiArrowRight size={13} /></>}
          </button>
        </form>

        <p className="text-center mt-5 text-xs" style={{ color: "var(--color-text2)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold" style={{ color: "var(--color-cyan)" }}>Create account</Link>
        </p>
      </div>
    </AuthShell>
  );
}
