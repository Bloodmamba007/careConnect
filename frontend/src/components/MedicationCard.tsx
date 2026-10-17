import React from "react";
import { Pill, ShieldAlert, Clock, Calendar } from "lucide-react";
import type { Medication } from "../types";

interface MedicationCardProps {
  medications: Medication[];
}

export function MedicationCard({ medications }: MedicationCardProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Active Medications</h2>
            <p className="text-sm text-slate-400">Current prescription schedule and safety advisories</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
          {medications.length} Prescriptions
        </span>
      </div>

      {medications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500">
          No active medications recorded for patient.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medications.map((med, index) => (
            <div
              key={`${med.drug_name}-${index}`}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-all duration-200 hover:border-slate-700"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{med.drug_name}</h3>
                    <p className="text-xs text-slate-400 italic">
                      {med.generic_name} ({med.form})
                    </p>
                  </div>
                  <span className="rounded-md bg-purple-500/15 px-2 py-1 text-xs font-bold text-purple-300 border border-purple-500/30 whitespace-nowrap">
                    {med.strength}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {med.frequency}
                  </span>
                  <span className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    {med.timing}
                  </span>
                </div>
              </div>

              {/* Low-key medication safety notes */}
              {med.safety_notes && med.safety_notes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400/90 mb-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Safety Notes</span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-400">
                    {med.safety_notes.map((note, noteIdx) => (
                      <li key={noteIdx} className="flex items-start gap-1.5">
                        <span className="text-amber-500/60 select-none">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default MedicationCard;
