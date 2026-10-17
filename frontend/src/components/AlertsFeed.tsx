import React, { useState } from "react";
import type { Alert, AlertSeverity } from "../types";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  PillIcon,
  SendIcon,
  ShieldAlertIcon,
  ZapIcon,
} from "./Icons";

interface AlertsFeedProps {
  alerts: Alert[];
  onAcknowledgeAlert?: (eventId: string) => void;
  onAlertFeedback?: (eventId: string, feedback: "false_alarm" | "real_problem") => void;
  onEscalateAlert?: (alert: Alert) => void;
}

export function AlertsFeed({
  alerts,
  onAcknowledgeAlert,
  onAlertFeedback,
  onEscalateAlert,
}: AlertsFeedProps) {
  const [filterSeverity, setFilterSeverity] = useState<"ALL" | AlertSeverity | "COMPOUND">("ALL");
  const [completedSteps, setCompletedSteps] = useState<Record<string, Record<number, boolean>>>({});

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (filterSeverity === "ALL") return true;
    if (filterSeverity === "COMPOUND") return alert.type === "COMPOUND";
    return alert.severity === filterSeverity;
  });

  const redCount = alerts.filter((a) => a.severity === "RED").length;
  const yellowCount = alerts.filter((a) => a.severity === "YELLOW").length;
  const greenCount = alerts.filter((a) => a.severity === "GREEN").length;
  const compoundCount = alerts.filter((a) => a.type === "COMPOUND").length;

  const toggleStep = (eventId: string, stepIndex: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || {}),
        [stepIndex]: !prev[eventId]?.[stepIndex],
      },
    }));
  };

  const getSeverityBadge = (severity: AlertSeverity, isCompound: boolean) => {
    if (isCompound) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/15 px-2.5 py-0.5 text-xs font-bold text-purple-300">
          <ZapIcon className="h-3 w-3 text-purple-400" />
          <span>COMPOUND RISK</span>
        </span>
      );
    }

    switch (severity) {
      case "RED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            <ShieldAlertIcon className="h-3 w-3 text-rose-400" />
            <span>CRITICAL</span>
          </span>
        );
      case "YELLOW":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
            <AlertTriangleIcon className="h-3 w-3 text-amber-400" />
            <span>WARNING</span>
          </span>
        );
      case "GREEN":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
            <CheckCircleIcon className="h-3 w-3 text-emerald-400" />
            <span>ROUTINE</span>
          </span>
        );
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md">
      {/* Feed Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/70 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white tracking-tight">Clinical Alerts & Decision Support</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 font-mono">
              {alerts.length} Total
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Realtime triage and compound drug-vital risk alerts
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterSeverity("ALL")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filterSeverity === "ALL"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold"
                : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity("RED")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filterSeverity === "RED"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
            }`}
          >
            Critical ({redCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity("YELLOW")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filterSeverity === "YELLOW"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
            }`}
          >
            Warning ({yellowCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity("GREEN")}
            className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
              filterSeverity === "GREEN"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
            }`}
          >
            Routine ({greenCount})
          </button>
          {compoundCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterSeverity("COMPOUND")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                filterSeverity === "COMPOUND"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold"
                  : "border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚡ Compound ({compoundCount})
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="mt-4 space-y-3.5">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800/80 p-8 text-center">
            <CheckCircleIcon className="h-8 w-8 text-emerald-400 opacity-60" />
            <p className="mt-2 text-sm font-semibold text-slate-300">No active alerts matching filter</p>
            <p className="text-xs text-slate-500">All vitals are within expected parameters.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCompound = alert.type === "COMPOUND";
            const borderAccent = isCompound
              ? "border-purple-500/50 bg-gradient-to-r from-purple-950/20 to-slate-900/80"
              : alert.severity === "RED"
                ? "border-rose-500/50 bg-gradient-to-r from-rose-950/20 to-slate-900/80"
                : alert.severity === "YELLOW"
                  ? "border-amber-500/40 bg-gradient-to-r from-amber-950/20 to-slate-900/80"
                  : "border-slate-800/80 bg-slate-900/70";

            return (
              <div
                key={alert.event_id}
                className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-200 ${borderAccent}`}
              >
                {/* Alert Top Meta Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {getSeverityBadge(alert.severity, isCompound)}
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                      {alert.patient_id}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatTimestamp(alert.timestamp)}
                    </span>
                  </div>

                  {alert.acknowledged && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <CheckIcon className="h-3 w-3" />
                      Acknowledged
                    </span>
                  )}
                </div>

                {/* Primary Message */}
                <h4 className="mt-2 text-sm font-bold text-white tracking-tight">
                  {alert.message}
                </h4>

                {/* Contributing Signals Tags */}
                {alert.contributing_signals.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Triggered By:
                    </span>
                    {alert.contributing_signals.map((signal) => (
                      <span
                        key={signal}
                        className="rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-cyan-300"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                )}

                {/* Compound Risk Drug-Interaction Box */}
                {alert.interaction && (
                  <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-950/30 p-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-purple-300">
                      <ZapIcon className="h-3.5 w-3.5 text-purple-400" />
                      <span>Concomitant Drug Interaction Detected</span>
                    </div>

                    {alert.interaction.drugs && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-slate-400">Interacting agents:</span>
                        {alert.interaction.drugs.map((drug) => (
                          <span
                            key={drug}
                            className="inline-flex items-center gap-1 rounded border border-purple-500/40 bg-purple-500/20 px-1.5 py-0.5 text-[11px] font-medium text-purple-200"
                          >
                            <PillIcon className="h-3 w-3" />
                            {drug}
                          </span>
                        ))}
                      </div>
                    )}

                    {alert.interaction.mechanism && (
                      <p className="mt-1 text-slate-300">
                        <strong className="text-slate-400">Mechanism:</strong>{" "}
                        {alert.interaction.mechanism}
                      </p>
                    )}

                    {alert.interaction.clinical_effect && (
                      <p className="mt-0.5 text-rose-300">
                        <strong className="text-slate-400">Potential effect:</strong>{" "}
                        {alert.interaction.clinical_effect}
                      </p>
                    )}
                  </div>
                )}

                {/* Clinical Action Checklist */}
                {alert.instructions.length > 0 && (
                  <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      Caregiver Protocol Checklist
                    </div>
                    <ul className="mt-1.5 space-y-1.5">
                      {alert.instructions.map((step, idx) => {
                        const isDone = completedSteps[alert.event_id]?.[idx];
                        return (
                          <li
                            key={step}
                            onClick={() => toggleStep(alert.event_id, idx)}
                            className="flex cursor-pointer items-start gap-2 text-xs text-slate-300 hover:text-white"
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                isDone
                                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                  : "border-slate-700 bg-slate-900"
                              }`}
                            >
                              {isDone && <CheckIcon className="h-3 w-3" />}
                            </span>
                            <span className={isDone ? "line-through text-slate-400" : ""}>
                              {step}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Caregiver Actions Footer */}
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {!alert.acknowledged && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeAlert?.(alert.event_id)}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                      >
                        <CheckIcon className="h-3 w-3" />
                        Acknowledge
                      </button>
                    )}

                    {onEscalateAlert && (
                      <button
                        type="button"
                        onClick={() => onEscalateAlert(alert)}
                        className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                      >
                        <SendIcon className="h-3 w-3" />
                        Escalate to Attending
                      </button>
                    )}
                  </div>

                  {/* Feedback: Real Problem vs False Alarm */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="text-[10px]">Triage feedback:</span>
                    <button
                      type="button"
                      onClick={() => onAlertFeedback?.(alert.event_id, "real_problem")}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        alert.feedback === "real_problem"
                          ? "bg-rose-500/30 text-rose-300 font-bold"
                          : "hover:bg-slate-800 text-slate-300"
                      }`}
                    >
                      Real Event
                    </button>
                    <span className="text-slate-600">/</span>
                    <button
                      type="button"
                      onClick={() => onAlertFeedback?.(alert.event_id, "false_alarm")}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        alert.feedback === "false_alarm"
                          ? "bg-amber-500/30 text-amber-300 font-bold"
                          : "hover:bg-slate-800 text-slate-300"
                      }`}
                    >
                      False Alarm
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
