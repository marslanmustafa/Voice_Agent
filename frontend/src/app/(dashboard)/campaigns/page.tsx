"use client";

import { useState } from "react";
import Link from "next/link";
import { FiPlus, FiRadio, FiClock, FiArrowRight } from "react-icons/fi";
import { useGetCampaignsQuery } from "@/store/api/allApis";

const STATUS_META: Record<string, { color: string; label: string }> = {
  draft:     { color: "var(--color-text3)",  label: "Draft"     },
  created:   { color: "var(--color-amber)",  label: "Created"   },
  queued:    { color: "var(--color-amber)",  label: "Queued"    },
  running:   { color: "var(--color-green)",  label: "Running"   },
  completed: { color: "var(--color-cyan)",   label: "Completed" },
  done:      { color: "var(--color-cyan)",   label: "Completed" },
  cancelled: { color: "var(--color-red)",    label: "Cancelled" },
  unknown:   { color: "var(--color-text2)",  label: "Unknown"   },
};

export default function CampaignsPage() {
  const { data, isLoading } = useGetCampaignsQuery();
  const [filter, setFilter] = useState<string>("all");

  const campaigns = data?.campaigns ?? [];
  const filtered = filter === "all"
    ? campaigns
    : campaigns.filter((c: any) => c.status === filter);

  const statusCounts = campaigns.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-[var(--color-cyan-dim)] text-[var(--color-cyan)] flex items-center justify-center border border-[rgba(0,212,255,0.3)]">
            <FiRadio size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-disp)" }}>Campaigns</h1>
            <p className="text-xs text-[var(--color-text2)] mt-1">
              {campaigns.length} total campaign{campaigns.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link
          href="/campaigns/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-xs font-bold transition-all"
          style={{
            background: "var(--color-cyan)",
            color: "#000",
            border: "1px solid var(--color-cyan)",
          }}
        >
          <FiPlus size={14} /> New Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "running", "completed", "queued", "draft", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold border transition-all capitalize"
            style={{
              background: filter === s ? "var(--color-cyan-dim)" : "var(--color-bg2)",
              color: filter === s ? "var(--color-cyan)" : "var(--color-text2)",
              borderColor: filter === s ? "rgba(0,212,255,0.25)" : "var(--color-border)",
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : STATUS_META[s]?.label ?? s}
            {s !== "all" && statusCounts[s] != null && (
              <span className="ml-1.5 opacity-60">({statusCounts[s]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 p-20">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent spin"
            style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-cyan)" }} />
          <span className="text-xs" style={{ color: "var(--color-text3)" }}>Loading campaigns…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 p-20 rounded-[16px] border border-dashed"
          style={{ borderColor: "var(--color-border2)", background: "var(--color-bg2)" }}>
          <FiRadio size={28} style={{ color: "var(--color-text3)" }} />
          <div className="text-center">
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text2)" }}>
              {filter === "all" ? "No campaigns yet" : `No ${filter} campaigns`}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text3)" }}>
              Create your first campaign to get started
            </p>
          </div>
          <Link
            href="/campaigns/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] text-xs font-bold transition-all"
            style={{ background: "var(--color-cyan)", color: "#000", border: "1px solid var(--color-cyan)" }}
          >
            <FiPlus size={12} /> Create Campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((campaign: any) => {
            const meta = STATUS_META[campaign.status] ?? STATUS_META.unknown;
            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="flex items-center gap-4 p-4 rounded-[14px] border transition-all"
                style={{
                  background: "var(--color-bg2)",
                  borderColor: "var(--color-border)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)";
                  e.currentTarget.style.background = "var(--color-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.background = "var(--color-bg2)";
                }}
              >
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30`, color: meta.color }}>
                  <FiRadio size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <span className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>
                      {campaign.name}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                      style={{ color: meta.color, background: `${meta.color}15`, borderColor: `${meta.color}40` }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--color-text3)" }}>
                    <FiClock size={9} />
                    Created {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : "—"}
                  </div>
                </div>
                <FiArrowRight size={14} style={{ color: "var(--color-text3)", flexShrink: 0 }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
