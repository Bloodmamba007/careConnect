import React, { useEffect, useState } from "react";
import { AlertTriangle, PhoneCall, CheckCircle, Volume2, VolumeX, ShieldCheck, Clock } from "lucide-react";
import type { Alert } from "../types";
import { emergencyAlarm } from "../utils/alarm";

interface EmergencyModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onAcknowledge: (eventId: string) => Promise<void>;
  onClose: () => void;
}

export function EmergencyModal({ alert, isOpen, onAcknowledge, onClose }: EmergencyModalProps) {
  const [countdown, setCountdown] = useState(60);
  const [isResponding, setIsResponding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [emergencyCalled, setEmergencyCalled] = useState(false);

  useEffect(() => {
    if (!isOpen || !alert) {
      emergencyAlarm.stop();
      return;
    }

    // Reset state on open
    setCountdown(60);
    setIsResponding(false);
    setEmergencyCalled(false);

    // Play alarm sound
    emergencyAlarm.start();

    // 60-second countdown timer
    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      emergencyAlarm.stop();
    };
  }, [isOpen, alert]);

  if (!isOpen || !alert) return null;

  const toggleSound = () => {
    const nextMuted = !isMuted;
    emergencyAlarm.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  const handleResponding = async () => {
    setIsResponding(true);
    emergencyAlarm.stop();
    try {
      await onAcknowledge(alert.event_id);
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    } finally {
      setIsResponding(false);
      onClose();
    }
  };

  const handleCallEmergency = () => {
    setEmergencyCalled(true);
    emergencyAlarm.stop();
    // Also acknowledge or log dispatch
    window.open("tel:911", "_self");
  };

  // Plain language steps from alert or default standard 3 steps
  const steps = alert.instructions.length >= 3 ? alert.instructions.slice(0, 3) : [
    "Stay with the patient.",
    "Recheck vitals immediately.",
    "Escalate to a clinician."
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/95 backdrop-blur-xl p-4 sm:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl rounded-3xl border-4 border-rose-500 bg-slate-950/90 p-6 sm:p-10 shadow-2xl shadow-rose-900/80 text-white">
        
        {/* Audio Mute & Close helper */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <button
            onClick={toggleSound}
            aria-label={isMuted ? "Unmute alarm sound" : "Mute alarm sound"}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-rose-300 animate-pulse" />}
            <span>{isMuted ? "Unmute Alarm" : "Silence Alarm"}</span>
          </button>
        </div>

        {/* Header Alert Flag */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/50 animate-bounce">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-rose-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                CRITICAL VITAL ALERT
              </span>
              <span className="text-xs uppercase font-bold text-rose-300">
                {alert.type}
              </span>
            </div>
            <h1 id="emergency-title" className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Emergency Clinical Alert
            </h1>
          </div>
        </div>

        {/* 60-second countdown display */}
        <div className="mb-6 rounded-2xl border-2 border-rose-500/60 bg-rose-900/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rose-300">
              <Clock className="w-4 h-4 animate-spin" />
              Escalation Timer
            </span>
            <span className={`text-2xl font-black tabular-nums ${countdown <= 15 ? "text-rose-400 animate-pulse" : "text-white"}`}>
              {countdown}s remaining
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900 border border-rose-500/30">
            <div
              className={`h-full transition-all duration-1000 ${
                countdown <= 15 ? "bg-rose-500" : "bg-gradient-to-r from-amber-500 to-rose-500"
              }`}
              style={{ width: `${(countdown / 60) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-rose-300/80">
            {countdown > 0
              ? "Acknowledging this alert stops the automated escalation countdown."
              : "Countdown expired: Escalation triggered to backup emergency contacts!"}
          </p>
        </div>

        {/* Alert Message */}
        <div className="mb-8 rounded-2xl border border-rose-500/40 bg-slate-900 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">
            Condition Summary
          </h2>
          <p className="text-xl font-bold text-white leading-relaxed">
            {alert.message}
          </p>

          {alert.contributing_signals && alert.contributing_signals.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Signals:</span>
              {alert.contributing_signals.map((sig) => (
                <span key={sig} className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300 border border-rose-500/30">
                  {sig.replace("_", " ").toUpperCase()}
                </span>
              ))}
            </div>
          )}

          {alert.interaction && (
            <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-950/30 p-3 text-xs text-purple-200">
              <span className="font-bold text-purple-300 uppercase">Compound Drug Warning:</span>{" "}
              {alert.interaction.drugs?.join(" + ")} - {alert.interaction.clinical_effect}
            </div>
          )}
        </div>

        {/* 3 Plain-Language Steps */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 mb-3">
            Immediate Action Required (Follow in Order):
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border-2 border-rose-500/50 bg-rose-950/40 p-4 transition-transform hover:scale-[1.02]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-sm font-black text-white shadow">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Step {idx + 1}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-extrabold text-white leading-snug">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Call Confirmed Notice */}
        {emergencyCalled && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-950/50 p-4 text-emerald-200">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-bold">Emergency services dialer activated. Stay with patient.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={handleResponding}
            disabled={isResponding}
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 px-6 py-4 text-lg font-extrabold text-white shadow-xl shadow-emerald-950/60 transition-all duration-150 disabled:opacity-50"
          >
            <CheckCircle className="h-6 w-6" />
            <span>{isResponding ? "Acknowledging..." : "I'm Responding"}</span>
          </button>

          <button
            onClick={handleCallEmergency}
            className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 px-6 py-4 text-lg font-black uppercase tracking-wider text-white shadow-xl shadow-rose-950/60 transition-all duration-150"
          >
            <PhoneCall className="h-6 w-6 animate-pulse" />
            <span>Call Emergency (911)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
export default EmergencyModal;
