// @ts-nocheck
"use client";

/**
 * FloatingDialer
 *
 * A persistent floating UI that lives in the root layout.
 * Handles the full call lifecycle:
 *   idle → dialing → ringing → active → ended
 *
 * State is driven entirely by Redux (activeCallSlice).
 * Live transcript is fed by useCallStream (SSE hook).
 * Survives page navigation.
 *
 * Mount in your root layout.tsx:
 *   import { FloatingDialer } from "@/components/FloatingDialer";
 *   ...
 *   <FloatingDialer />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiPhone, FiPhoneOff, FiMic, FiMicOff, FiPause,
  FiPlay, FiMinimize2, FiMaximize2, FiX, FiChevronDown,
} from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  callInitiated, resetCall, setMuted, setOnHold,
  CallStatus, TranscriptSegment,
} from "@/store/slices/activeCallSlice";
import { useCallStream } from "@/hooks/useCallStream";
import { useDialCallMutation, useEndCallMutation } from "@/store/api/allApis";
import { fmtDuration } from "@/lib/utils";

// ─── Status display config ─────────────────────────────────────────────────

const STATUS_META: Record<CallStatus, { label: string; color: string; pulse: boolean }> = {
  idle: { label: "Ready", color: "var(--color-text3)", pulse: false },
  dialing: { label: "Dialing…", color: "var(--color-amber)", pulse: true },
  ringing: { label: "Ringing…", color: "var(--color-amber)", pulse: true },
  active: { label: "Live", color: "var(--color-green)", pulse: true },
  ended: { label: "Call Ended", color: "var(--color-text2)", pulse: false },
  failed: { label: "Failed", color: "var(--color-red)", pulse: false },
  "no-answer": { label: "No Answer", color: "var(--color-text2)", pulse: false },
  busy: { label: "Busy", color: "var(--color-red)", pulse: false },
  cancelled: { label: "Cancelled", color: "var(--color-text3)", pulse: false },
};

// ─── Call Timer ────────────────────────────────────────────────────────────

function useCallTimer(startedAt: number | null, status: CallStatus) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || status !== "active") {
      if (status === "ended" && startedAt) {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  return elapsed;
}

// ─── Phone input dialog ────────────────────────────────────────────────────

function DialPad({
  onDial,
  onClose,
}: {
  onDial: (phone: string, firstMessage?: string) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [firstMsg, setFirstMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDial = () => {
    if (phone.trim()) onDial(phone.trim(), firstMsg.trim() || undefined);
  };

  return (
    <div
      className="absolute bottom-16 right-0 w-72 rounded-[16px] border p-4 flex flex-col gap-3 shadow-2xl"
      style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: "var(--color-text)" }}>New Call</span>
        <button onClick={onClose} style={{ color: "var(--color-text3)", cursor: "pointer" }}>
          <FiX size={14} />
        </button>
      </div>

      {/* Phone number input */}
      <input
        autoFocus
        type="tel"
        placeholder="+1 (555) 000-0000"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleDial()}
        className="w-full px-3 py-2 rounded-[8px] border text-sm outline-none"
        style={{
          background: "var(--color-bg2)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
      />

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1 text-[10px] self-start"
        style={{ color: "var(--color-text3)", cursor: "pointer" }}
      >
        <FiChevronDown
          size={10}
          style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
        Advanced
      </button>

      {showAdvanced && (
        <textarea
          placeholder="First message (optional)…"
          value={firstMsg}
          onChange={(e) => setFirstMsg(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-[8px] border text-xs outline-none resize-none"
          style={{
            background: "var(--color-bg2)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
        />
      )}

      <button
        onClick={handleDial}
        disabled={!phone.trim()}
        className="flex items-center justify-center gap-2 py-2 rounded-[8px] text-xs font-bold transition-all"
        style={{
          background: phone.trim() ? "var(--color-green)" : "var(--color-border)",
          color: phone.trim() ? "#000" : "var(--color-text3)",
          cursor: phone.trim() ? "pointer" : "not-allowed",
        }}
      >
        <FiPhone size={12} /> Call
      </button>
    </div>
  );
}

// ─── Active call panel ────────────────────────────────────────────────────

function ActiveCallPanel({
  callId,
  phone,
  status,
  elapsed,
  transcript,
  isMuted,
  isOnHold,
  error,
  onMute,
  onHold,
  onEnd,
  onMinimize,
}: {
  callId: string;
  phone: string;
  status: CallStatus;
  elapsed: number;
  transcript: TranscriptSegment[];
  isMuted: boolean;
  isOnHold: boolean;
  error: string | null;
  onMute: () => void;
  onHold: () => void;
  onEnd: () => void;
  onMinimize: () => void;
}) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[status] ?? STATUS_META.idle;

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const isTerminal = ["ended", "failed", "no-answer", "busy", "cancelled"].includes(status);

  return (
    <div
      className="absolute bottom-16 right-0 w-80 rounded-[16px] border flex flex-col overflow-hidden shadow-2xl"
      style={{
        background: "var(--color-bg)",
        borderColor: "var(--color-border)",
        maxHeight: "520px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Status dot */}
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: meta.color,
              boxShadow: meta.pulse ? `0 0 6px ${meta.color}` : "none",
              animation: meta.pulse ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
          />
          <div>
            <div className="text-xs font-bold" style={{ color: "var(--color-text)" }}>{phone}</div>
            <div className="text-[10px]" style={{ color: meta.color }}>{meta.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "active" && (
            <span className="text-[11px] font-mono tabular-nums" style={{ color: "var(--color-text2)" }}>
              {fmtDuration(elapsed)}
            </span>
          )}
          <button onClick={onMinimize} style={{ color: "var(--color-text3)", cursor: "pointer" }}>
            <FiMinimize2 size={13} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-[11px]" style={{ background: "rgba(255,80,80,0.08)", color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      {/* Live Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ minHeight: 0 }}>
        {transcript.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[11px]" style={{ color: "var(--color-text3)" }}>
            {isTerminal ? "Call ended" : "Waiting for conversation…"}
          </div>
        ) : (
          transcript.map((seg, i) => (
            <div
              key={i}
              className="flex flex-col gap-0.5 px-2.5 py-2 rounded-[8px] text-xs"
              style={{
                background: seg.speaker === "user"
                  ? "rgba(0,212,255,0.06)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${seg.speaker === "user" ? "rgba(0,212,255,0.1)" : "var(--color-border)"}`,
                opacity: seg.isPartial ? 0.65 : 1,
              }}
            >
              <span
                className="text-[9px] uppercase tracking-wider font-semibold"
                style={{ color: seg.speaker === "user" ? "var(--color-cyan)" : "var(--color-text3)" }}
              >
                {seg.speaker === "user" ? "Customer" : "Agent"}
                {seg.isPartial && " •"}
              </span>
              <span style={{ color: "var(--color-text)", lineHeight: 1.5 }}>{seg.text}</span>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      {!isTerminal && (
        <div
          className="flex items-center justify-between px-4 py-3 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          {/* Mute */}
          <ControlButton
            onClick={onMute}
            active={isMuted}
            activeColor="var(--color-amber)"
            label={isMuted ? "Unmute" : "Mute"}
            icon={isMuted ? <FiMicOff size={14} /> : <FiMic size={14} />}
          />

          {/* Hold */}
          <ControlButton
            onClick={onHold}
            active={isOnHold}
            activeColor="var(--color-amber)"
            label={isOnHold ? "Resume" : "Hold"}
            icon={isOnHold ? <FiPlay size={14} /> : <FiPause size={14} />}
          />

          {/* End call */}
          <button
            onClick={onEnd}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-[10px] transition-all"
            style={{
              background: "rgba(255,80,80,0.12)",
              border: "1px solid rgba(255,80,80,0.3)",
              cursor: "pointer",
            }}
          >
            <FiPhoneOff size={16} style={{ color: "var(--color-red)" }} />
            <span className="text-[9px]" style={{ color: "var(--color-red)" }}>End</span>
          </button>
        </div>
      )}

      {/* Post-call dismiss */}
      {isTerminal && (
        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={onEnd}
            className="w-full py-2 rounded-[8px] text-xs font-bold"
            style={{ background: "var(--color-bg2)", color: "var(--color-text2)", cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function ControlButton({
  onClick, active, activeColor, label, icon,
}: {
  onClick: () => void;
  active: boolean;
  activeColor: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-3 py-2 rounded-[10px] transition-all"
      style={{
        background: active ? `${activeColor}18` : "var(--color-bg2)",
        border: `1px solid ${active ? `${activeColor}40` : "var(--color-border)"}`,
        color: active ? activeColor : "var(--color-text2)",
        cursor: "pointer",
      }}
    >
      {icon}
      <span className="text-[9px]">{label}</span>
    </button>
  );
}

// ─── Main FloatingDialer export ────────────────────────────────────────────

export function FloatingDialer() {
  const dispatch = useAppDispatch();
  const call = useAppSelector((s) => s.activeCall);
  const [panelOpen, setPanelOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const [dialCall] = useDialCallMutation();
  const [endCall] = useEndCallMutation();

  const isActive = call.status !== "idle";
  const isTerminal = ["ended", "failed", "no-answer", "busy", "cancelled"].includes(call.status);

  // Drive all call state from the SSE stream
  useCallStream(isActive ? call.callId : null);

  const elapsed = useCallTimer(call.startedAt, call.status);

  const handleDial = useCallback(
    async (phone: string, firstMessage?: string) => {
      setPanelOpen(false);
      try {
        const result = await dialCall({ phone_to: phone, first_message: firstMessage }).unwrap();
        dispatch(
          callInitiated({
            callId: result.call_id,
            phone,
            listenUrl: result.listen_url ?? null,
            controlUrl: result.control_url ?? null,
          })
        );
        setMinimized(false);
      } catch (err: any) {
        console.error("[Dialer] Dial failed:", err);
      }
    },
    [dialCall, dispatch]
  );

  const handleEnd = useCallback(async () => {
    if (isTerminal) {
      dispatch(resetCall());
      setMinimized(false);
      return;
    }
    if (call.callId) {
      try {
        await endCall(call.callId).unwrap();
      } catch (e) {
        console.error("[Dialer] End call failed:", e);
      }
    }
  }, [call.callId, endCall, dispatch, isTerminal]);

  const handleMute = useCallback(async () => {
    dispatch(setMuted(!call.isMuted));
    // If you have a control URL, send the mute command via Vapi
    // await fetch(call.controlUrl, { method: "POST", body: JSON.stringify({ type: call.isMuted ? "unmute-assistant" : "mute-assistant" }) })
  }, [call.isMuted, dispatch]);

  const handleHold = useCallback(() => {
    dispatch(setOnHold(!call.isOnHold));
    // Implement hold via Vapi control URL if supported
  }, [call.isOnHold, dispatch]);

  return (
    <>
      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes dialerSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {/* Active call panel — expanded */}
        {isActive && !minimized && (
          <div style={{ animation: "dialerSlideUp 0.2s ease" }}>
            <ActiveCallPanel
              callId={call.callId!}
              phone={call.phone}
              status={call.status}
              elapsed={elapsed}
              transcript={call.transcript}
              isMuted={call.isMuted}
              isOnHold={call.isOnHold}
              error={call.error}
              onMute={handleMute}
              onHold={handleHold}
              onEnd={handleEnd}
              onMinimize={() => setMinimized(true)}
            />
          </div>
        )}

        {/* Dial pad — only when idle */}
        {!isActive && panelOpen && (
          <div style={{ animation: "dialerSlideUp 0.2s ease" }}>
            <DialPad onDial={handleDial} onClose={() => setPanelOpen(false)} />
          </div>
        )}

        {/* FAB / Minimized pill */}
        {isActive && minimized ? (
          /* Minimized pill */
          <button
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border transition-all shadow-lg"
            style={{
              background: "var(--color-bg)",
              borderColor: STATUS_META[call.status]?.pulse
                ? STATUS_META[call.status].color
                : "var(--color-border)",
              cursor: "pointer",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: STATUS_META[call.status]?.color,
                animation: STATUS_META[call.status]?.pulse ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            />
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text)" }}>
              {call.phone}
            </span>
            {call.status === "active" && (
              <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--color-text3)" }}>
                {fmtDuration(elapsed)}
              </span>
            )}
            <FiMaximize2 size={11} style={{ color: "var(--color-text3)" }} />
          </button>
        ) : !isActive ? (
          /* FAB */
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="w-12 h-12 rounded-full border flex items-center justify-center shadow-lg transition-all"
            style={{
              background: panelOpen ? "var(--color-green)" : "var(--color-bg)",
              borderColor: panelOpen ? "var(--color-green)" : "var(--color-border)",
              cursor: "pointer",
            }}
          >
            <FiPhone size={18} style={{ color: panelOpen ? "#000" : "var(--color-text)" }} />
          </button>
        ) : null}
      </div>
    </>
  );
}