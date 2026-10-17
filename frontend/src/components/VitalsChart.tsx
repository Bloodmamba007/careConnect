import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import type { VitalsPacket } from "../types";

interface VitalsChartProps {
  data: VitalsPacket[];
}

export function VitalsChart({ data }: VitalsChartProps) {
  const [metricTab, setMetricTab] = useState<"all" | "hr" | "spo2" | "bp">("all");

  const formattedData = data.map((item, idx) => {
    let timeLabel = `#${idx + 1}`;
    try {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) {
        timeLabel = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }
    } catch {
      // fallback
    }
    return {
      index: idx,
      time: timeLabel,
      heart_rate: item.heart_rate,
      spo2: item.spo2,
      systolic_bp: item.systolic_bp,
      diastolic_bp: item.diastolic_bp,
    };
  });

  return (
    <div className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">Live Vitals Trend</h2>
            <span className="rounded-full bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30">
              {data.length} / 120 points
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">Continuous telemetry rolling buffer (last 120 samples)</p>
        </div>

        {/* Tab Filters */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setMetricTab("all")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              metricTab === "all"
                ? "bg-slate-800 text-white font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Metrics
          </button>
          <button
            onClick={() => setMetricTab("hr")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              metricTab === "hr"
                ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Heart Rate
          </button>
          <button
            onClick={() => setMetricTab("spo2")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              metricTab === "spo2"
                ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            SpO2
          </button>
          <button
            onClick={() => setMetricTab("bp")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              metricTab === "bp"
                ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Blood Pressure
          </button>
        </div>
      </div>

      {formattedData.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-slate-500">
          <p className="text-base font-medium">Awaiting vitals data from simulator or live stream...</p>
          <p className="text-xs text-slate-600 mt-1">Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700">Alt+D</kbd> or click Demo Scenarios below to simulate vitals.</p>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                minTickGap={25}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                domain={
                  metricTab === "spo2"
                    ? [75, 100]
                    : metricTab === "hr"
                    ? [40, 160]
                    : [30, 180]
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  borderColor: "#334155",
                  borderRadius: "0.75rem",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                  color: "#f8fafc",
                }}
                labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "12px", fontSize: "12px", color: "#cbd5e1" }}
              />

              {/* Threshold lines */}
              {(metricTab === "all" || metricTab === "spo2") && (
                <ReferenceLine
                  y={94}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: "SpO2 Hypoxia (<94%)", fill: "#f87171", fontSize: 10, position: "insideTopRight" }}
                />
              )}

              {/* Lines */}
              {(metricTab === "all" || metricTab === "hr") && (
                <Line
                  type="monotone"
                  dataKey="heart_rate"
                  name="Heart Rate (bpm)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {(metricTab === "all" || metricTab === "spo2") && (
                <Line
                  type="monotone"
                  dataKey="spo2"
                  name="SpO2 (%)"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {(metricTab === "all" || metricTab === "bp") && (
                <>
                  <Line
                    type="monotone"
                    dataKey="systolic_bp"
                    name="Systolic BP (mmHg)"
                    stroke="#fb7185"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="diastolic_bp"
                    name="Diastolic BP (mmHg)"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
export default VitalsChart;
