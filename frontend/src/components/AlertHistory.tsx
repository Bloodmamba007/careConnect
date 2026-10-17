import React, { useState } from "react";
import { AlertCircle, History, ThumbsUp, ThumbsDown, CheckCircle, ShieldAlert } from "lucide-react";
import type { Alert } from "../types";

interface AlertHistoryProps {
  alerts: Alert[];
  onFeedback: (alertId: string, feedback: "False alarm" | "Real problem") => Promise<void>;
}

export function AlertHistory({ alerts, onFeedback }: AlertHistoryProps) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleFeedbackClick = async (alertId: string, feedback: "False alarm" | "Real problem") => {
    setSubmittingId(alertId);
    try {
      await onFeedback(alertId, feedback);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setSubmittingId(null);
    }
  };

  const getSeverityBadge = (severity: Alert["severity"]) => {
    switch (severity) {
      case "RED":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "YELLOW":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "GREEN":
      default:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
  };

  return (
    <div className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Alert History</h2>
            <p className="text-sm text-slate-400">Logged clinical events & caregiver classification feedback</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
          {alerts.length} Events
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
          No alerts recorded yet. Monitor is clean.
        </div>
      ) : (
        <ul className="space-y-4">
          {alerts.map((item) => {
            let formattedTime = item.timestamp;
            try {
              const d = new Date(item.timestamp);
              if (!isNaN(d.getTime())) {
                formattedTime = `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
              }
            } catch {
              // fallback
            }

            return (
              <li
                key={item.event_id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 transition-all duration-150 hover:border-slate-700"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${getSeverityBadge(
                        item.severity
                      )}`}
                    >
                      {item.severity}
                    </span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {formattedTime}
                    </span>
                    {item.acknowledged && (
                      <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Acknowledged
                      </span>
                    )}
                  </div>

                  {/* Feedback action buttons on each alert */}
                  <div className="flex items-center gap-2 pt-1 sm:pt-0">
                    <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Review:</span>
                    <button
                      onClick={() => handleFeedbackClick(item.event_id, "False alarm")}
                      disabled={submittingId === item.event_id || item.feedback === "False alarm"}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                        item.feedback === "False alarm"
                          ? "bg-slate-700 text-white border border-slate-600 shadow-sm"
                          : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                      } disabled:opacity-60`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>False alarm</span>
                    </button>

                    <button
                      onClick={() => handleFeedbackClick(item.event_id, "Real problem")}
                      disabled={submittingId === item.event_id || item.feedback === "Real problem"}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                        item.feedback === "Real problem"
                          ? "bg-rose-600 text-white border border-rose-500 shadow-sm"
                          : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-700"
                      } disabled:opacity-60`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Real problem</span>
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-base font-semibold text-white">{item.message}</p>

                  {item.contributing_signals && item.contributing_signals.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">Trigger signals:</span>
                      {item.contributing_signals.map((sig) => (
                        <span
                          key={sig}
                          className="rounded bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300 border border-slate-700"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.instructions && item.instructions.length > 0 && (
                    <ul className="mt-2.5 space-y-1 text-xs text-slate-300 pl-4 list-disc">
                      {item.instructions.map((instr, idx) => (
                        <li key={idx}>{instr}</li>
                      ))}
                    </ul>
                  )}

                  {item.interaction && (
                    <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-950/20 p-2.5 text-xs text-purple-200">
                      <div className="font-semibold text-purple-300">Compound Drug Interaction:</div>
                      <div>
                        {item.interaction.drugs?.join(", ")} &mdash; {item.interaction.mechanism} ({item.interaction.clinical_effect})
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
export default AlertHistory;
