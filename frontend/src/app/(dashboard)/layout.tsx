"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LuLayoutDashboard,
  LuUsers,
  LuRadio,
  LuPhone,
  LuSettings,
  LuPhoneCall,
  LuBot,
  LuArrowRight,
} from "react-icons/lu";

const NAV = [
  { href: "/dashboard", icon: LuLayoutDashboard, label: "Overview" },
  { href: "/contacts", icon: LuUsers, label: "Contacts" },
  { href: "/campaigns", icon: LuRadio, label: "Campaigns" },
  // { href: "/calls", icon: LuPhoneCall, label: "Call History" },
  { href: "/dialer", icon: LuPhone, label: "Dialer" },
  { href: "/settings", icon: LuSettings, label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f14] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-white/5 backdrop-blur-md bg-[#0b0f14]/80">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
            <LuBot size={18} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">VoiceofAgent</p>
            <p className="text-[11px] text-gray-400">
              AI Calling Platform
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/campaigns"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-400 text-black hover:bg-cyan-300 transition"
        >
          <LuRadio size={14} />
          New Campaign
          <LuArrowRight size={14} />
        </Link>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col border-r border-white/5 bg-[#0a0e13]">
          <div className="px-4 pt-4 pb-2 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
            Navigation
          </div>

          <nav className="flex flex-col gap-1 px-2">
            {NAV.map(({ href, icon: Icon, label }) => {
              const active =
                pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                  ${active
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-400/20"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  <Icon size={16} />
                  <span className="flex-1">{label}</span>

                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="mt-auto p-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <LuBot size={14} />
              VoiceofAgent v2.0
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}