"use client";

import Link from "next/link";
import { FiUsers, FiRadio, FiPhone, FiActivity, FiArrowRight, FiPlus, FiTarget } from "react-icons/fi";
import { useGetContactsQuery, useGetCampaignsQuery, useGetCallsQuery } from "@/store/api/allApis";

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-4 p-5 rounded-[14px] border transition-all hover:-translate-y-0.5 relative overflow-hidden"
      style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-50" style={{ background: color }} />
      <div className="w-11 h-11 rounded-[12px] border flex items-center justify-center flex-shrink-0"
        style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--color-text2)" }}>{label}</div>
        <div className="text-2xl font-extrabold leading-none" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>{value}</div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, desc, accent }: { href: string; icon: React.ReactNode; label: string; desc: string; accent?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3.5 p-4 rounded-[14px] border transition-all hover:-translate-y-0.5 group"
      style={{ background: "var(--color-bg2)", borderColor: accent ? "rgba(245,166,35,0.15)" : "var(--color-border)", textDecoration: "none" }}>
      <div className="w-9 h-9 rounded-[10px] border flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ background: "var(--color-bg3)", borderColor: "var(--color-border2)", color: "var(--color-text2)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold mb-0.5" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>{label}</div>
        <div className="text-[11px]" style={{ color: "var(--color-text2)" }}>{desc}</div>
      </div>
      <FiArrowRight size={13} style={{ color: "var(--color-text3)", flexShrink: 0 }} />
    </Link>
  );
}

export default function DashboardPage() {
  const { data: contacts }   = useGetContactsQuery({});
  const { data: campaigns }  = useGetCampaignsQuery();
  const { data: calls }      = useGetCallsQuery({});

  const totalContacts  = contacts?.total ?? 0;
  const totalCampaigns = campaigns?.campaigns?.length ?? 0;
  const totalCalls     = calls?.total ?? 0;
  const activeCalls    = calls?.calls?.filter((c) => c.status === "active" || c.status === "ringing").length ?? 0;
  const userName       = "there";

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-7 p-8 rounded-[20px] border relative overflow-hidden"
        style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
        <div className="absolute -top-16 -right-10 w-60 h-60 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)" }} />
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: "var(--color-green)", background: "var(--color-green-dim)", borderColor: "rgba(45,218,147,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "var(--color-green)" }} />
            Platform Online
          </div>
          <h1 className="text-[28px] font-extrabold mb-2 leading-tight" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>
            Hey, <span style={{ color: "var(--color-cyan)" }}>{userName}</span>
          </h1>
          <p className="text-sm max-w-[400px] leading-relaxed" style={{ color: "var(--color-text2)" }}>
            Manage your AI calling campaigns, contacts, and monitor live calls from your dashboard.
          </p>
        </div>
        <div className="flex gap-2.5 flex-shrink-0 flex-wrap">
          {[
            { href: "/test",      label: "Test Agent",   Icon: FiTarget, accent: true  },
            { href: "/campaigns", label: "New Campaign", Icon: FiRadio,  primary: true },
            { href: "/contacts",  label: "Add Contact",  Icon: FiPlus                  },
          ].map(({ href, label, Icon, accent, primary }) => (
            <Link key={href} href={href}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all hover:-translate-y-px"
              style={{
                background:  primary ? "var(--color-cyan)"    : accent ? "var(--color-amber-dim)" : "var(--color-bg3)",
                color:       primary ? "#000"                 : accent ? "var(--color-amber)"     : "var(--color-text)",
                border:      `1px solid ${primary ? "var(--color-cyan)" : accent ? "rgba(245,166,35,0.3)" : "var(--color-border2)"}`,
                textDecoration: "none",
              }}>
              <Icon size={12} /> {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-[15px] font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>
          <FiActivity size={14} style={{ opacity: 0.6 }} /> Overview
        </h2>
        <div className="grid grid-cols-2 gap-3.5" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <StatCard icon={<FiUsers size={18}/>}    label="Total Contacts" value={totalContacts}  color="var(--color-cyan)"  />
          <StatCard icon={<FiRadio size={18}/>}    label="Campaigns"      value={totalCampaigns} color="var(--color-amber)" />
          <StatCard icon={<FiPhone size={18}/>}    label="Total Calls"    value={totalCalls}     color="var(--color-green)" />
          <StatCard icon={<FiActivity size={18}/>} label="Active Now"     value={activeCalls}    color={activeCalls > 0 ? "var(--color-red)" : "var(--color-text3)"} />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-[15px] font-bold mb-4" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Quick Actions</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <QuickAction href="/test"      icon={<FiTarget size={15}/>} label="Test Agent"       desc="Test via WebRTC — no phone call" accent />
          <QuickAction href="/contacts"  icon={<FiUsers size={15}/>}  label="Manage Contacts"  desc="Add, edit, or import contacts"    />
          <QuickAction href="/campaigns" icon={<FiRadio size={15}/>}  label="Launch Campaign"  desc="Create an outbound call campaign" />
          <QuickAction href="/calls"     icon={<FiPhone size={15}/>}  label="Call History"     desc="Review transcripts and recordings" />
        </div>
      </div>

      {/* Getting Started */}
      <div>
        <h2 className="text-[15px] font-bold mb-4" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>Getting Started</h2>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { n: "01", title: "Configure your AI Agent", desc: "Set up voice, personality, and first message in Settings.", href: "/settings", cta: "Configure Agent" },
            { n: "02", title: "Add your contacts",        desc: "Import contacts manually or via CSV to start calling.",     href: "/contacts", cta: "Manage Contacts" },
            { n: "03", title: "Launch a campaign",        desc: "Create a campaign, assign contacts, and launch calls.",      href: "/campaigns", cta: "Create Campaign" },
          ].map(({ n, title, desc, href, cta }) => (
            <div key={n} className="flex gap-4 p-5 rounded-[14px] border transition-all hover:-translate-y-px"
              style={{ background: "var(--color-bg2)", borderColor: "var(--color-border)" }}>
              <div className="text-[22px] font-extrabold flex-shrink-0 mt-0.5" style={{ fontFamily: "var(--font-disp)", color: "var(--color-border2)" }}>{n}</div>
              <div>
                <h3 className="text-[13px] font-bold mb-1.5" style={{ fontFamily: "var(--font-disp)", color: "var(--color-text)" }}>{title}</h3>
                <p className="text-[11px] leading-relaxed mb-2.5" style={{ color: "var(--color-text2)" }}>{desc}</p>
                <Link href={href} className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition-all hover:gap-2.5" style={{ color: "var(--color-cyan)" }}>
                  {cta} <FiArrowRight size={10} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
