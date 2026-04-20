"use client";

import Link from "next/link";
import {
  FiUsers,
  FiRadio,
  FiPhone,
  FiActivity,
  FiArrowRight,
  FiPlus,
  FiTarget,
} from "react-icons/fi";

import {
  useGetContactsQuery,
  useGetCampaignsQuery,
  useGetCallsQuery,
} from "@/store/api/allApis";

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      className="relative flex items-center gap-4 p-5 rounded-xl border transition hover:-translate-y-0.5 overflow-hidden"
      style={{
        background: "var(--color-bg2)",
        borderColor: "var(--color-border)",
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{ background: color }}
      />

      <div
        className="w-11 h-11 rounded-lg border flex items-center justify-center flex-shrink-0"
        style={{
          color,
          borderColor: `${color}40`,
          background: `${color}12`,
        }}
      >
        {icon}
      </div>

      <div>
        <div
          className="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
          style={{ color: "var(--color-text2)" }}
        >
          {label}
        </div>
        <div
          className="text-2xl font-extrabold leading-none"
          style={{
            fontFamily: "var(--font-disp)",
            color: "var(--color-text)",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  desc,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-xl border transition hover:-translate-y-0.5 group"
      style={{
        background: "var(--color-bg2)",
        borderColor: accent
          ? "rgba(245,166,35,0.15)"
          : "var(--color-border)",
      }}
    >
      <div
        className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
        style={{
          background: "var(--color-bg3)",
          borderColor: "var(--color-border2)",
          color: "var(--color-text2)",
        }}
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-bold"
          style={{
            fontFamily: "var(--font-disp)",
            color: "var(--color-text)",
          }}
        >
          {label}
        </div>
        <div className="text-xs" style={{ color: "var(--color-text2)" }}>
          {desc}
        </div>
      </div>

      <FiArrowRight size={13} style={{ color: "var(--color-text3)" }} />
    </Link>
  );
}

export default function DashboardPage() {
  const { data: contacts } = useGetContactsQuery({});
  const { data: campaigns } = useGetCampaignsQuery();
  const { data: calls } = useGetCallsQuery({});

  const totalContacts = contacts?.total ?? 0;
  const totalCampaigns = campaigns?.campaigns?.length ?? 0;
  const totalCalls = calls?.total ?? 0;
  const activeCalls =
    calls?.calls?.filter(
      (c) => c.status === "active" || c.status === "ringing"
    ).length ?? 0;

  const userName = "there";

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div
        className="relative flex items-start justify-between gap-8 p-8 rounded-2xl border overflow-hidden"
        style={{
          background: "var(--color-bg2)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="absolute -top-16 -right-10 w-60 h-60 rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(0,212,255,0.07)_0%,transparent_70%)]" />

        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{
              color: "var(--color-green)",
              background: "var(--color-green-dim)",
              borderColor: "rgba(45,218,147,0.2)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--color-green)" }}
            />
            Platform Online
          </div>

          <h1
            className="text-3xl font-extrabold mb-2 leading-tight"
            style={{
              fontFamily: "var(--font-disp)",
              color: "var(--color-text)",
            }}
          >
            Hey, <span style={{ color: "var(--color-cyan)" }}>{userName}</span>
          </h1>

          <p className="text-sm max-w-md" style={{ color: "var(--color-text2)" }}>
            Manage AI calling campaigns, contacts, and live call monitoring from
            one place.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {[
            { href: "/test", label: "Test Agent", Icon: FiTarget, accent: true },
            { href: "/campaigns", label: "New Campaign", Icon: FiRadio, primary: true },
            { href: "/contacts", label: "Add Contact", Icon: FiPlus },
          ].map(({ href, label, Icon, accent, primary }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition hover:-translate-y-0.5"
              style={{
                background: primary
                  ? "var(--color-cyan)"
                  : accent
                    ? "var(--color-amber-dim)"
                    : "var(--color-bg3)",
                color: primary
                  ? "#000"
                  : accent
                    ? "var(--color-amber)"
                    : "var(--color-text)",
                border: `1px solid ${primary
                    ? "var(--color-cyan)"
                    : accent
                      ? "rgba(245,166,35,0.3)"
                      : "var(--color-border2)"
                  }`,
              }}
            >
              <Icon size={12} />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2
          className="text-sm font-bold mb-4 flex items-center gap-2"
          style={{
            fontFamily: "var(--font-disp)",
            color: "var(--color-text)",
          }}
        >
          <FiActivity size={14} /> Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <StatCard icon={<FiUsers size={18} />} label="Total Contacts" value={totalContacts} color="var(--color-cyan)" />
          <StatCard icon={<FiRadio size={18} />} label="Campaigns" value={totalCampaigns} color="var(--color-amber)" />
          <StatCard icon={<FiPhone size={18} />} label="Total Calls" value={totalCalls} color="var(--color-green)" />
          <StatCard icon={<FiActivity size={18} />} label="Active Now" value={activeCalls} color={activeCalls > 0 ? "var(--color-red)" : "var(--color-text3)"} />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold mb-4">Quick Actions</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction href="/test" icon={<FiTarget size={15} />} label="Test Agent" desc="WebRTC testing environment" accent />
          <QuickAction href="/contacts" icon={<FiUsers size={15} />} label="Manage Contacts" desc="Add or import contacts" />
          <QuickAction href="/campaigns" icon={<FiRadio size={15} />} label="Launch Campaign" desc="Start outbound calling" />
          <QuickAction href="/calls" icon={<FiPhone size={15} />} label="Call History" desc="View logs & recordings" />
        </div>
      </div>
    </div>
  );
}