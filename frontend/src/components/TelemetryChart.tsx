import React, { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "../types";
import { ActivityIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "./Icons";

interface TelemetryChartProps {
  data: ChartPoint[];
  isStreamingPaused: boolean;
  onToggleStreaming: () => void;
  onClearData: () => void;
}

type ViewMode = "combined" | "heart_rate" | "spo2" | "bp";

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-lg">
      <div className="text-[11px] font-semibold text-slate-400 font-mono">{label}</div>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-bold text-white font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TelemetryChart({
  data,
  isStreamingPaused,
  onToggleStreaming,
  onClearData,
}: TelemetryChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("combined");

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md">
      {/* Chart Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/70 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30">
            <ActivityIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Real-Time Telemetry Stream</h3>
            <p className="text-[11px] text-slate-400">Continuous clinical waveform history</p>
          </div>
        </div>

        {/* View Mode Pills & Stream Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Filter Tabs */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("combined")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                viewMode === "combined"
                  ? "bg-slate-800 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Signals
            </button>
            <button
              type="button"
              onClick={() => setViewMode("heart_rate")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                viewMode === "heart_rate"
                  ? "bg-slate-800 text-rose-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Heart Rate
            </button>
            <button
              type="button"
              onClick={() => setViewMode("spo2")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                viewMode === "spo2"
                  ? "bg-slate-800 text-sky-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              SpO2
            </button>
            <button
              type="button"
              onClick={() => setViewMode("bp")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                viewMode === "bp"
                  ? "bg-slate-800 text-violet-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Blood Pressure
            </button>
          </div>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={onToggleStreaming}
            title={isStreamingPaused ? "Resume live stream" : "Pause live stream"}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all ${
              isStreamingPaused
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
            }`}
          >
            {isStreamingPaused ? <PlayIcon className="h-3 w-3" /> : <PauseIcon className="h-3 w-3" />}
            <span className="hidden sm:inline">{isStreamingPaused ? "Resume" : "Pause"}</span>
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={onClearData}
            title="Clear chart buffer"
            className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-400 hover:border-slate-700 hover:text-slate-200"
          >
            <RotateCcwIcon className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="mt-4 h-64 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
            Awaiting streaming data packets...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradHr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradSpo2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradSys" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradDia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

              <XAxis
                dataKey="timeLabel"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 10", "dataMax + 10"]}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Threshold Lines */}
              {viewMode === "spo2" && (
                <ReferenceLine
                  y={94}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: "Hypoxia Threshold (94%)", fill: "#f43f5e", fontSize: 10 }}
                />
              )}
              {viewMode === "heart_rate" && (
                <ReferenceLine
                  y={100}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: "Tachycardia (>100)", fill: "#f59e0b", fontSize: 10 }}
                />
              )}

              {/* Render Area layers based on active viewMode */}
              {(viewMode === "combined" || viewMode === "heart_rate") && (
                <Area
                  type="monotone"
                  dataKey="heart_rate"
                  name="Heart Rate (bpm)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradHr)"
                  isAnimationActive={false}
                />
              )}

              {(viewMode === "combined" || viewMode === "spo2") && (
                <Area
                  type="monotone"
                  dataKey="spo2"
                  name="SpO2 (%)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradSpo2)"
                  isAnimationActive={false}
                />
              )}

              {(viewMode === "combined" || viewMode === "bp") && (
                <>
                  <Area
                    type="monotone"
                    dataKey="systolic_bp"
                    name="Systolic BP (mmHg)"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradSys)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="diastolic_bp"
                    name="Diastolic BP (mmHg)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradDia)"
                    isAnimationActive={false}
                  />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Heart Rate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span>SpO2 Oxygen</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            <span>Systolic BP</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            <span>Diastolic BP</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Buffer: {data.length} pts {isStreamingPaused && "(PAUSED)"}
        </div>
      </div>
    </div>
  );
}
