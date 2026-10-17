import React from "react";
import { CheckCircle2, Eye, AlertTriangle } from "lucide-react";
import type { Alert, AlertSeverity } from "../types";

interface StatusBannerProps {
  latestAlert: Alert | null;
  onOpenEmergencyModal?: () => void;
}

export function StatusBanner({ latestAlert, onOpenEmergencyModal }: StatusBannerProps) {
  const severity: AlertSeverity = latestAlert?.severity ?? "GREEN";

  if (severity === "YELLOW") {
    // YELLOW "Watching" (small, unobtrusive)
    return (
      <aside aria-label="Status: Watching" className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-amber-200">
        <div className="flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            Watching
          </span>
          <span className="text-sm text-amber-200/90 font-medium truncate max-w-xl">
            {latestAlert?.message || "Mild vital variation detected. Continuing routine observation."}
          </span>
        </div>
        <span className="text-xs text-amber-300/70 shrink-0 hidden sm:inline">
          {latestAlert?.timestamp ? new Date(latestAlert.timestamp).toLocaleTimeString() : ""}
        </span>
      </aside>
    );
  }

  if (severity === "RED") {
    // RED: Critical Alert Banner
    return (
      <aside aria-label="Status: Critical Alert" className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border-2 border-rose-500 bg-rose-950/80 p-4 text-rose-100 shadow-lg shadow-rose-950/50 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-white bg-rose-600 px-2 py-0.5 rounded">
                CRITICAL ALERT
              </span>
              <span className="text-xs font-semibold text-rose-300">
                {latestAlert?.type}
              </span>
            </div>
            <p className="mt-0.5 text-base font-bold text-white">
              {latestAlert?.message || "Critical vital sign deviation detected!"}
            </p>
          </div>
        </div>

        {onOpenEmergencyModal && (
          <button
            onClick={onOpenEmergencyModal}
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl shadow-md uppercase tracking-wider transition-all duration-150"
          >
            Open Emergency Takeover
          </button>
        )}
      </aside>
    );
  }

  // GREEN: "All stable"
  return (
    <aside aria-label="Status: All stable" className="flex items-center justify-between rounded-2xl border-2 border-emerald-500/30 bg-emerald-950/25 px-5 py-3.5 text-emerald-200 shadow-md">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <span className="text-base font-bold text-emerald-300 tracking-wide">
            All stable
          </span>
          <span className="ml-3 text-sm text-emerald-400/80 hidden sm:inline">
            Vitals are within expected clinical thresholds.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-medium text-emerald-400">Active monitoring</span>
      </div>
    </aside>
  );
}
export default StatusBanner;
