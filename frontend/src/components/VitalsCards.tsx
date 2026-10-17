import React from "react";
import { Heart, Activity, Gauge, AlertCircle } from "lucide-react";
import type { VitalsPacket } from "../types";

interface VitalsCardsProps {
  vitals: VitalsPacket | null;
}

export function VitalsCards({ vitals }: VitalsCardsProps) {
  // Determine Heart Rate status: Normal: 60-100, Warning: 50-59 or 101-120, Critical: <50 or >120
  const getHrStatus = (hr?: number) => {
    if (hr === undefined) return { color: "bg-slate-600", border: "border-slate-800", text: "text-slate-400", label: "No data" };
    if (hr < 50 || hr > 120) return { color: "bg-rose-500 animate-ping", dotColor: "bg-rose-500", border: "border-rose-500/50", text: "text-rose-400", label: "Critical" };
    if (hr < 60 || hr > 100) return { color: "bg-amber-400", dotColor: "bg-amber-400", border: "border-amber-500/40", text: "text-amber-300", label: "Elevated" };
    return { color: "bg-emerald-500", dotColor: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-400", label: "Normal" };
  };

  // Determine SpO2 status: Normal: >=95%, Warning: 90-94%, Critical: <90%
  const getSpo2Status = (spo2?: number) => {
    if (spo2 === undefined) return { color: "bg-slate-600", border: "border-slate-800", text: "text-slate-400", label: "No data" };
    if (spo2 < 90) return { color: "bg-rose-500 animate-ping", dotColor: "bg-rose-500", border: "border-rose-500/50", text: "text-rose-400", label: "Critical Low" };
    if (spo2 < 95) return { color: "bg-amber-400", dotColor: "bg-amber-400", border: "border-amber-500/40", text: "text-amber-300", label: "Mild Hypoxia" };
    return { color: "bg-emerald-500", dotColor: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-400", label: "Optimal" };
  };

  // Determine Blood Pressure status
  const getBpStatus = (sys?: number, dia?: number) => {
    if (sys === undefined || dia === undefined) {
      return { color: "bg-slate-600", border: "border-slate-800", text: "text-slate-400", label: "No data" };
    }
    if (sys < 90 || sys > 160 || dia < 50 || dia > 100) {
      return { color: "bg-rose-500 animate-ping", dotColor: "bg-rose-500", border: "border-rose-500/50", text: "text-rose-400", label: "Critical Outlier" };
    }
    if (sys > 130 || dia > 85) {
      return { color: "bg-amber-400", dotColor: "bg-amber-400", border: "border-amber-500/40", text: "text-amber-300", label: "Borderline" };
    }
    return { color: "bg-emerald-500", dotColor: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-400", label: "Normal" };
  };

  const hrStatus = getHrStatus(vitals?.heart_rate);
  const spo2Status = getSpo2Status(vitals?.spo2);
  const bpStatus = getBpStatus(vitals?.systolic_bp, vitals?.diastolic_bp);

  return (
    <section aria-label="Current Vital Signs" className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Heart Rate Card */}
      <div className={`relative overflow-hidden rounded-2xl border-2 bg-slate-900/90 p-6 shadow-xl transition-all duration-200 ${hrStatus.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
              <Heart className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Heart Rate</span>
              <p className="text-sm text-slate-400">Resting Pulse</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${hrStatus.dotColor || hrStatus.color}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${hrStatus.text}`}>
              {hrStatus.label}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tracking-tight text-white tabular-nums">
              {vitals ? Math.round(vitals.heart_rate) : "—"}
            </span>
            <span className="text-lg font-semibold text-sky-400">bpm</span>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            Target: 60 - 100
          </span>
        </div>
      </div>

      {/* SpO2 Card */}
      <div className={`relative overflow-hidden rounded-2xl border-2 bg-slate-900/90 p-6 shadow-xl transition-all duration-200 ${spo2Status.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Oxygen (SpO2)</span>
              <p className="text-sm text-slate-400">Blood Saturation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${spo2Status.dotColor || spo2Status.color}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${spo2Status.text}`}>
              {spo2Status.label}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tracking-tight text-white tabular-nums">
              {vitals ? vitals.spo2.toFixed(1) : "—"}
            </span>
            <span className="text-lg font-semibold text-emerald-400">%</span>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            Target: ≥ 95%
          </span>
        </div>
      </div>

      {/* Blood Pressure Card */}
      <div className={`relative overflow-hidden rounded-2xl border-2 bg-slate-900/90 p-6 shadow-xl transition-all duration-200 ${bpStatus.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Blood Pressure</span>
              <p className="text-sm text-slate-400">Systolic / Diastolic</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${bpStatus.dotColor || bpStatus.color}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${bpStatus.text}`}>
              {bpStatus.label}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tracking-tight text-white tabular-nums">
              {vitals ? `${Math.round(vitals.systolic_bp)} / ${Math.round(vitals.diastolic_bp)}` : "— / —"}
            </span>
            <span className="text-lg font-semibold text-amber-400">mmHg</span>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            Target: &lt; 120 / 80
          </span>
        </div>
      </div>
    </section>
  );
}
export default VitalsCards;
