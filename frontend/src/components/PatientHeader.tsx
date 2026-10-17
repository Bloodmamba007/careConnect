import React from "react";
import type { AlertSeverity, Patient, VitalsPacket } from "../types";
import { ActivityIcon, CheckCircleIcon, ShieldAlertIcon } from "./Icons";

interface PatientHeaderProps {
  patient: Patient;
  vitals: VitalsPacket | null;
  latestSeverity: AlertSeverity;
  lastUpdatedTime: string | null;
}

export function PatientHeader({
  patient,
  vitals,
  latestSeverity,
  lastUpdatedTime,
}: PatientHeaderProps) {
  // Compute dynamic clinical health stability score based on current vitals
  let stabilityScore = 96;
  let statusColor = "text-emerald-400";
  let statusBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
  let statusText = "Stable Baseline";

  if (vitals) {
    let penalty = 0;
    if (vitals.heart_rate < 50 || vitals.heart_rate > 110) penalty += 20;
    if (vitals.spo2 < 94) penalty += 35;
    if (vitals.systolic_bp < 90 || vitals.systolic_bp > 150) penalty += 20;
    if (vitals.diastolic_bp < 55 || vitals.diastolic_bp > 95) penalty += 15;

    stabilityScore = Math.max(30, 100 - penalty);
  }

  if (latestSeverity === "RED" || stabilityScore < 70) {
    statusColor = "text-rose-400";
    statusBg = "bg-rose-500/10 border-rose-500/30 text-rose-300";
    statusText = "Critical Attention Required";
  } else if (latestSeverity === "YELLOW" || stabilityScore < 85) {
    statusColor = "text-amber-400";
    statusBg = "bg-amber-500/10 border-amber-500/30 text-amber-300";
    statusText = "Observation Protocol";
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md">
      {/* Subtle background glow */}
      <div
        className={`pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full blur-3xl opacity-20 ${
          latestSeverity === "RED"
            ? "bg-rose-500"
            : latestSeverity === "YELLOW"
              ? "bg-amber-500"
              : "bg-cyan-500"
        }`}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Patient Profile */}
        <div className="flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 font-bold text-slate-200 ring-1 ring-slate-700 shadow-md">
            <span className="text-lg">
              {patient.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <span
              className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-slate-950 ${
                latestSeverity === "RED"
                  ? "bg-rose-500"
                  : latestSeverity === "YELLOW"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                {patient.name}
              </h2>
              <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {patient.age}y · {patient.gender}
              </span>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                {patient.room} ({patient.bed})
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Attending: <span className="text-slate-300">{patient.attendingPhysician}</span> · ID:{" "}
              <code className="text-slate-400 font-mono">{patient.id}</code>
            </p>

            {/* Clinical Condition Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {patient.conditions.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-800 bg-slate-950/60 px-2.5 py-0.5 text-[11px] text-slate-300 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Health Index Gauge & Sync Status */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:self-center">
          {/* Health Index Card */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/70 px-4 py-2.5">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <svg className="h-11 w-11 -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={statusColor}
                  strokeDasharray={`${stabilityScore}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-bold text-slate-100 font-mono">
                {stabilityScore}
              </span>
            </div>

            <div>
              <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Stability Index
              </div>
              <div className={`mt-0.5 inline-flex items-center gap-1 text-xs font-bold ${statusColor}`}>
                {latestSeverity === "RED" ? (
                  <ShieldAlertIcon className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                )}
                <span>{statusText}</span>
              </div>
            </div>
          </div>

          {/* Sync & Telemetry Badge */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 px-3.5 py-2.5 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              <ActivityIcon className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span>Continuous Telemetry</span>
            </div>
            <div className="mt-1 text-xs font-medium text-slate-300">
              {lastUpdatedTime ? `Synced ${lastUpdatedTime}` : "Awaiting stream..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
