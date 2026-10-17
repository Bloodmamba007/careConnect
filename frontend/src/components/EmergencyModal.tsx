import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  PhoneCall,
  CheckCircle,
  Volume2,
  VolumeX,
  ShieldCheck,
  Clock,
  Zap,
  Pill,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Alert, Medication } from "../types";
import { emergencyAlarm } from "../utils/alarm";

interface EmergencyModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onAcknowledge: (eventId: string) => Promise<void>;
  onClose: () => void;
  medications?: Medication[];
}

export function EmergencyModal({
  alert,
  isOpen,
  onAcknowledge,
  onClose,
  medications = [],
}: EmergencyModalProps) {
  const [countdown, setCountdown] = useState(60);
  const [isResponding, setIsResponding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [emergencyCalled, setEmergencyCalled] = useState(false);
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !alert) {
      emergencyAlarm.stop();
      return;
    }

    // Reset state on open
    setCountdown(60);
    setIsResponding(false);
    setEmergencyCalled(false);
    setIsWhyOpen(false);

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
    window.open("tel:911", "_self");
  };

  // Plain language steps from alert or default standard 3 steps
  const steps =
    alert.instructions.length >= 3
      ? alert.instructions.slice(0, 3)
      : [
          "Stay with the patient.",
          "Recheck vitals immediately.",
          "Escalate to a clinician.",
        ];

  const isCompound = alert.type === "COMPOUND" || Boolean(alert.interaction);

  // Extract interacting drugs in lowercase for matching
  const interactingDrugNames = (alert.interaction?.drugs ?? []).map((d) =>
    d.toLowerCase().trim(),
  );

  // Compile full list of medications to display
  // Prioritize alert.medications or props.medications or interaction.drugs
  let displayMeds: Array<{
    name: string;
    strength?: string;
    frequency?: string;
    timing?: string;
    isInteracting: boolean;
  }> = [];

  if (Array.isArray(alert.medications) && alert.medications.length > 0) {
    if (typeof alert.medications[0] === "string") {
      displayMeds = (alert.medications as string[]).map((name) => ({
        name,
        isInteracting: true,
      }));
    } else {
      displayMeds = (alert.medications as Medication[]).map((med) => {
        const matches = interactingDrugNames.some(
          (d) =>
            med.drug_name.toLowerCase().includes(d) ||
            med.generic_name.toLowerCase().includes(d) ||
            d.includes(med.drug_name.toLowerCase()) ||
            d.includes(med.generic_name.toLowerCase()),
        );
        return {
          name: med.drug_name || med.generic_name,
          strength: med.strength,
          frequency: med.frequency,
          timing: med.timing,
          isInteracting: matches,
        };
      });
    }
  } else if (medications.length > 0) {
    displayMeds = medications.map((med) => {
      const matches = interactingDrugNames.some(
        (d) =>
          med.drug_name.toLowerCase().includes(d) ||
          med.generic_name.toLowerCase().includes(d) ||
          d.includes(med.drug_name.toLowerCase()) ||
          d.includes(med.generic_name.toLowerCase()),
      );
      return {
        name: med.drug_name || med.generic_name,
        strength: med.strength,
        frequency: med.frequency,
        timing: med.timing,
        isInteracting: matches,
      };
    });
  } else if (alert.interaction?.drugs && alert.interaction.drugs.length > 0) {
    displayMeds = alert.interaction.drugs.map((name) => ({
      name,
      isInteracting: true,
    }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/95 backdrop-blur-xl p-4 sm:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl rounded-3xl border-4 border-rose-500 bg-slate-950/90 p-6 sm:p-10 shadow-2xl shadow-rose-900/80 text-white my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Audio Mute & Close helper */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <button
            onClick={toggleSound}
            aria-label={isMuted ? "Unmute alarm sound" : "Mute alarm sound"}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-900 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-rose-300 animate-pulse" />
            )}
            <span>{isMuted ? "Unmute Alarm" : "Silence Alarm"}</span>
          </button>
        </div>

        {/* Header Alert Flag with Compound Risk Badge */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-600/50 animate-bounce">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md bg-rose-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white">
                CRITICAL VITAL ALERT
              </span>

              {/* Requirement: "Compound risk" badge */}
              {isCompound && (
                <span
                  data-testid="compound-risk-badge"
                  className="flex items-center gap-1 rounded-md bg-purple-600 border border-purple-300/50 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-purple-900/60 animate-pulse"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Compound risk
                </span>
              )}

              <span className="text-xs uppercase font-bold text-rose-300">
                {alert.type}
              </span>
            </div>
            <h1
              id="emergency-title"
              className="text-2xl sm:text-3xl font-extrabold text-white mt-1"
            >
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
            <span
              className={`text-2xl font-black tabular-nums ${
                countdown <= 15 ? "text-rose-400 animate-pulse" : "text-white"
              }`}
            >
              {countdown}s remaining
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900 border border-rose-500/30">
            <div
              className={`h-full transition-all duration-1000 ${
                countdown <= 15
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-amber-500 to-rose-500"
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

        {/* Alert Message Summary */}
        <div className="mb-6 rounded-2xl border border-rose-500/40 bg-slate-900 p-5">
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
                <span
                  key={sig}
                  className="rounded-md bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300 border border-rose-500/30 uppercase"
                >
                  {sig.replace("_", " ")}
                </span>
              ))}
            </div>
          )}

          {alert.interaction && (
            <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-950/40 p-3 text-xs text-purple-200">
              <span className="font-bold text-purple-300 uppercase">
                Active Interaction:
              </span>{" "}
              {alert.interaction.drugs?.join(" + ")} — {alert.interaction.clinical_effect}
            </div>
          )}
        </div>

        {/* Requirement: The Medication List for Emergency Team */}
        {displayMeds.length > 0 && (
          <div
            data-testid="emergency-medication-list"
            className="mb-6 rounded-2xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-950/40 via-slate-900 to-purple-950/30 p-5 shadow-lg"
          >
            <div className="flex items-center justify-between mb-3 border-b border-purple-500/30 pb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-200">
                  Medication List (Show to Emergency Team)
                </h3>
              </div>
              <span className="rounded bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[11px] font-bold text-purple-300 uppercase">
                Emergency Handoff
              </span>
            </div>

            <p className="text-xs text-purple-200/90 mb-3 font-medium">
              Show this medication list to the emergency team. Interacting medications are flagged below:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {displayMeds.map((med, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-3 border transition-colors ${
                    med.isInteracting
                      ? "border-purple-400 bg-purple-900/50 shadow-sm"
                      : "border-slate-800 bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-sm text-white">
                      {med.name}
                    </span>
                    {med.isInteracting && (
                      <span className="rounded bg-purple-500 text-[10px] font-black uppercase px-1.5 py-0.5 text-white">
                        Interacting
                      </span>
                    )}
                  </div>
                  {(med.strength || med.frequency || med.timing) && (
                    <div className="text-xs text-slate-300">
                      {med.strength && <span className="font-semibold">{med.strength}</span>}
                      {med.frequency && <span> • {med.frequency}</span>}
                      {med.timing && <span> ({med.timing})</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requirement: Expandable "Why this alert?" section */}
        <div
          data-testid="why-this-alert-section"
          className="mb-6 rounded-2xl border border-cyan-500/40 bg-slate-900/90 overflow-hidden shadow-md"
        >
          <button
            type="button"
            data-testid="why-this-alert-toggle"
            onClick={() => setIsWhyOpen(!isWhyOpen)}
            className="w-full flex items-center justify-between p-4 bg-slate-900/95 hover:bg-slate-800/80 transition-colors text-left"
            aria-expanded={isWhyOpen}
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-black uppercase tracking-wider text-cyan-300">
                Why this alert?
              </span>
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                (Click to {isWhyOpen ? "collapse" : "expand"} clinical signals, duration & thresholds)
              </span>
            </div>
            {isWhyOpen ? (
              <ChevronUp className="h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-cyan-400" />
            )}
          </button>

          {isWhyOpen && (
            <div
              data-testid="why-this-alert-content"
              className="border-t border-slate-800 p-4 sm:p-5 space-y-3.5 text-xs animate-fadeIn"
            >
              {/* Contributing signals */}
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Triggering Signals:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(alert.explanation?.signals ?? alert.contributing_signals ?? []).map((sig) => (
                    <span
                      key={sig}
                      className="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-xs font-bold text-rose-300 uppercase"
                    >
                      {sig.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>

              {/* Duration */}
              {alert.explanation?.duration && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Crisis Duration:
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {alert.explanation.duration}
                  </span>
                </div>
              )}

              {/* Thresholds */}
              {alert.explanation?.thresholds &&
                Object.keys(alert.explanation.thresholds).length > 0 && (
                  <div>
                    <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Violated Thresholds:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(alert.explanation.thresholds).map(([signal, detail]) => (
                        <div
                          key={signal}
                          className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 flex items-center justify-between"
                        >
                          <span className="font-bold text-slate-300 uppercase">
                            {signal.replace("_", " ")}:
                          </span>
                          <span className="font-black text-rose-400">
                            {detail.value} (Limit: {String(detail.threshold)} • {detail.condition})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Matched Rule */}
              {alert.explanation?.matched_rule && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Matched Diagnostic Rule:
                  </span>
                  <p className="rounded-lg bg-cyan-950/30 border border-cyan-500/30 p-2.5 text-cyan-200 leading-relaxed">
                    {alert.explanation.matched_rule}
                  </p>
                </div>
              )}

              {/* Clinical Rationale */}
              {alert.explanation?.clinical_rationale && (
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Clinical Rationale:
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {alert.explanation.clinical_rationale}
                  </p>
                </div>
              )}
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
            <span className="text-sm font-bold">
              Emergency services dialer activated. Stay with patient.
            </span>
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
