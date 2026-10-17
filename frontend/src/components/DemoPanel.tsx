import React, { useState } from "react";
import { Terminal, Play, X, Zap, AlertTriangle, ShieldCheck, RefreshCw, Radio } from "lucide-react";

interface DemoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerScenario: (scenario: "stable" | "watching" | "crisis" | "compound") => Promise<void>;
  onToggleSocketSimulation: () => void;
  isSocketConnected: boolean;
}

export function DemoPanel({
  isOpen,
  onClose,
  onTriggerScenario,
  onToggleSocketSimulation,
  isSocketConnected,
}: DemoPanelProps) {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScenario = async (scenario: "stable" | "watching" | "crisis" | "compound") => {
    setLoadingScenario(scenario);
    try {
      await onTriggerScenario(scenario);
    } catch (e) {
      console.error("Scenario trigger failed:", e);
    } finally {
      setLoadingScenario(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simulator Demo Scenarios"
      className="fixed bottom-6 right-6 z-40 w-96 rounded-2xl border-2 border-indigo-500/50 bg-slate-950/95 p-5 shadow-2xl shadow-indigo-950/80 backdrop-blur-md text-white animate-fadeIn"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
            Simulator Demo Panel
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            Alt+D
          </span>
          <button
            onClick={onClose}
            aria-label="Close demo panel"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Simulate patient telemetry scenarios instantly to test clinical responses:
      </p>

      <div className="space-y-2.5">
        {/* Crisis Button - The primary test goal! */}
        <button
          onClick={() => handleScenario("crisis")}
          disabled={loadingScenario !== null}
          className="group w-full flex items-center justify-between rounded-xl border-2 border-rose-500 bg-rose-950/60 p-3 text-left hover:bg-rose-900/80 transition-all shadow-md hover:shadow-rose-950"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-600 text-white group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  1. Trigger Crisis (Red Takeover)
                </span>
              </div>
              <p className="text-[11px] text-rose-300 mt-0.5">
                SpO2 83%, HR 146 bpm &rarr; Triggers full-screen takeover modal
              </p>
            </div>
          </div>
          <Play className="w-4 h-4 text-rose-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Compound Risk */}
        <button
          onClick={() => handleScenario("compound")}
          disabled={loadingScenario !== null}
          className="group w-full flex items-center justify-between rounded-xl border border-purple-500/50 bg-purple-950/40 p-3 text-left hover:bg-purple-900/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600 text-white">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                2. Compound Drug Risk (RED)
              </span>
              <p className="text-[11px] text-purple-300 mt-0.5">
                Profound BP crash with Beta-Blocker & ACE-Inhibitor
              </p>
            </div>
          </div>
          <Play className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Watching / Warning */}
        <button
          onClick={() => handleScenario("watching")}
          disabled={loadingScenario !== null}
          className="group w-full flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-left hover:bg-amber-900/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-600 text-white">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                3. Warning State (YELLOW)
              </span>
              <p className="text-[11px] text-amber-300 mt-0.5">
                HR 114 bpm &rarr; Triggers unobtrusive "Watching" banner
              </p>
            </div>
          </div>
          <Play className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Normal / Stable */}
        <button
          onClick={() => handleScenario("stable")}
          disabled={loadingScenario !== null}
          className="group w-full flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-left hover:bg-emerald-900/40 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                4. Return to Stable (GREEN)
              </span>
              <p className="text-[11px] text-emerald-300 mt-0.5">
                HR 74 bpm, SpO2 98.5% &rarr; All stable status
              </p>
            </div>
          </div>
          <Play className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Socket Drop Simulation button */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <button
          onClick={onToggleSocketSimulation}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition-all ${
            isSocketConnected
              ? "bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-500/30"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${!isSocketConnected ? "animate-spin" : ""}`} />
          <span>
            {isSocketConnected ? "Simulate Socket Drop (Test 'Reconnecting...')" : "Restore Socket Connection"}
          </span>
        </button>
      </div>
    </div>
  );
}
export default DemoPanel;
