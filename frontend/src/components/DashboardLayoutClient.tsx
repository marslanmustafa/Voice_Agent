"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LuLayoutDashboard,
  LuUsers,
  LuRadio,
  LuPhone,
  LuSettings,
  LuBot,
  LuArrowRight,
  LuMenu,
  LuX,
} from "react-icons/lu";

import { useIsMobile } from "@/hooks/use-mobile";

const NAV = [
  { href: "/dashboard", icon: LuLayoutDashboard, label: "Overview" },
  { href: "/contacts", icon: LuUsers, label: "Contacts" },
  { href: "/campaigns", icon: LuRadio, label: "Campaigns" },
  { href: "/dialer", icon: LuPhone, label: "Dialer" },
  { href: "/settings", icon: LuSettings, label: "Settings" },
];

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0b0f14] via-[#0f172a] to-[#1e1b4b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 h-14 border-b border-white/5 backdrop-blur-md bg-[#0b0f14]/60">
        {/* Logo & Hamburger */}
        <div className="flex items-center gap-3">
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <LuMenu size={22} />
          </button>
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
            <LuBot size={18} />
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="text-sm font-semibold">VoiceofAgent</p>
            <p className="text-[11px] text-gray-400">
              AI Calling Platform
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/campaigns"
          className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium bg-cyan-400 text-black hover:bg-cyan-300 transition"
        >
          <LuRadio size={14} />
          <span className="hidden sm:inline">New Campaign</span>
          <span className="sm:hidden">New</span>
          <LuArrowRight size={14} className="hidden sm:block" />
        </Link>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && isMobile && (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`${isMobile ? "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out " + (sidebarOpen ? "translate-x-0" : "-translate-x-full") : "static flex-shrink-0"} w-56 flex flex-col border-r border-white/5 bg-[#0a0e13]/40 backdrop-blur-md`}>
          <div className="flex justify-between items-center px-4 pt-4 pb-2 md:hidden">
            <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">Navigation</span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
              <LuX size={18} />
            </button>
          </div>
          <div className="hidden md:block px-4 pt-4 pb-2 text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
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
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
