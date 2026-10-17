import React, { useState } from "react";
import type { Patient } from "../types";
import { PATIENTS } from "../utils/mockData";
import { ChevronDownIcon, SlidersIcon, UserIcon, Volume2Icon, VolumeXIcon } from "./Icons";

interface NavbarProps {
  connected: boolean;
  activePatient: Patient;
  onSelectPatient: (patient: Patient) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  demoStudioOpen: boolean;
  onToggleDemoStudio: () => void;
  isSimulating: boolean;
}

export function Navbar({
  connected,
  activePatient,
  onSelectPatient,
  audioEnabled,
  onToggleAudio,
  demoStudioOpen,
  onToggleDemoStudio,
  isSimulating,
}: NavbarProps) {
  const [patientMenuOpen, setPatientMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Monogram */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/20 via-sky-500/30 to-emerald-400/20 ring-1 ring-cyan-500/40">
            <svg
              className="h-5 w-5 text-cyan-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white font-sans">
                CareConnect
              </span>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-cyan-300 uppercase">
                Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-400">Remote Patient Monitoring Hub</p>
          </div>
        </div>

        {/* Center / Patient Selector */}
        <div className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setPatientMenuOpen(!patientMenuOpen)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-all hover:border-slate-700 hover:bg-slate-850"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40">
              <UserIcon className="h-3 w-3" />
            </span>
            <div className="text-left">
              <div className="text-slate-100 font-semibold leading-none">{activePatient.name}</div>
              <div className="text-[10px] text-slate-400 leading-none mt-1">
                {activePatient.id} · {activePatient.room}
              </div>
            </div>
            <ChevronDownIcon className="ml-1 h-3.5 w-3.5 text-slate-400" />
          </button>

          {patientMenuOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl backdrop-blur-lg">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Select Patient Monitor
              </div>
              {PATIENTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPatient(p);
                    setPatientMenuOpen(false);
                  }}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    p.id === activePatient.id
                      ? "bg-cyan-500/15 text-cyan-300 font-medium"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.room}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {p.age}y · {p.conditions[0]}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-all ${
              connected
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : isSimulating
                  ? "bg-sky-500/10 text-sky-300 ring-sky-500/30"
                  : "bg-slate-800 text-slate-400 ring-slate-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected
                  ? "bg-emerald-400 animate-pulse"
                  : isSimulating
                    ? "bg-sky-400 animate-pulse"
                    : "bg-slate-500"
              }`}
            />
            <span className="hidden sm:inline">
              {connected
                ? "Live Socket Connected"
                : isSimulating
                  ? "Live Simulation Active"
                  : "Socket Offline"}
            </span>
            <span className="sm:hidden">{connected ? "Live" : "Sim"}</span>
          </div>

          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            title={audioEnabled ? "Mute alert audio" : "Enable alert audio chime"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
              audioEnabled
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
            }`}
          >
            {audioEnabled ? <Volume2Icon className="h-4 w-4" /> : <VolumeXIcon className="h-4 w-4" />}
          </button>

          {/* Hackathon Demo Studio Trigger */}
          <button
            type="button"
            onClick={onToggleDemoStudio}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              demoStudioOpen
                ? "border-cyan-400 bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-cyan-200 shadow-md shadow-cyan-500/20"
                : "border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-700 hover:bg-slate-850"
            }`}
          >
            <SlidersIcon className={`h-3.5 w-3.5 ${demoStudioOpen ? "text-cyan-300 animate-spin" : "text-slate-400"}`} />
            <span className="hidden md:inline">Demo Studio</span>
            <span className="rounded bg-cyan-500/30 px-1 py-0.2 text-[9px] font-bold text-cyan-200">
              SIM
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
