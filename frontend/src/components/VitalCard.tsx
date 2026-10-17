import React from "react";
import { ActivityIcon, GaugeIcon, HeartIcon, OxygenIcon } from "./Icons";

interface VitalCardProps {
  id: "hr" | "spo2" | "sys" | "dia";
  label: string;
  value?: number;
  unit: string;
  normalMin: number;
  normalMax: number;
  history?: number[];
  selected?: boolean;
  onClick?: () => void;
}

export function VitalCard({
  id,
  label,
  value,
  unit,
  normalMin,
  normalMax,
  history = [],
  selected = false,
  onClick,
}: VitalCardProps) {
  // Determine clinical status
  let status: "normal" | "warning" | "critical" = "normal";
  let statusLabel = "Normal";

  if (value !== undefined) {
    if (id === "spo2") {
      if (value < 90) {
        status = "critical";
        statusLabel = "Critical Low";
      } else if (value < 94) {
        status = "warning";
        statusLabel = "Low SpO2";
      }
    } else if (id === "hr") {
      if (value < 50 || value > 120) {
        status = "critical";
        statusLabel = value > 120 ? "Tachycardia" : "Bradycardia";
      } else if (value < normalMin || value > normalMax) {
        status = "warning";
        statusLabel = value > normalMax ? "Elevated" : "Low";
      }
    } else if (id === "sys") {
      if (value < 85 || value > 165) {
        status = "critical";
        statusLabel = value > 165 ? "Stage 2 Hyper" : "Hypotension";
      } else if (value < normalMin || value > normalMax) {
        status = "warning";
        statusLabel = value > normalMax ? "Elevated" : "Low BP";
      }
    } else if (id === "dia") {
      if (value < 50 || value > 100) {
        status = "critical";
        statusLabel = value > 100 ? "High Pressure" : "Low Pressure";
      } else if (value < normalMin || value > normalMax) {
        status = "warning";
        statusLabel = value > normalMax ? "Elevated" : "Low";
      }
    }
  }

  // Styles according to status
  const statusStyles = {
    normal: {
      badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      accent: "text-emerald-400",
      border: "border-slate-800/80 hover:border-emerald-500/40",
      glow: "group-hover:shadow-emerald-500/10",
      stroke: "#10b981",
    },
    warning: {
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      accent: "text-amber-400",
      border: "border-amber-500/40 hover:border-amber-500/60",
      glow: "shadow-amber-500/10",
      stroke: "#f59e0b",
    },
    critical: {
      badge: "bg-rose-500/15 text-rose-300 border-rose-500/40",
      accent: "text-rose-400",
      border: "border-rose-500/60 hover:border-rose-500/80 animate-pulse",
      glow: "shadow-rose-500/20",
      stroke: "#f43f5e",
    },
  }[status];

  // Calculate percentage within bar range [minBound, maxBound]
  const minBound = Math.min(normalMin * 0.7, value ?? normalMin);
  const maxBound = Math.max(normalMax * 1.3, value ?? normalMax);
  const currentPct =
    value !== undefined
      ? Math.max(0, Math.min(100, ((value - minBound) / (maxBound - minBound)) * 100))
      : 50;

  // Render SVG Sparkline
  const renderSparkline = () => {
    if (history.length < 2) return null;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const width = 80;
    const height = 24;

    const points = history
      .map((val, idx) => {
        const x = (idx / (history.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg className="h-6 w-20 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke={statusStyles.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const getIcon = () => {
    switch (id) {
      case "hr":
        return <HeartIcon className="h-4 w-4" pulse={status === "critical" || status === "warning"} />;
      case "spo2":
        return <OxygenIcon className="h-4 w-4" />;
      case "sys":
        return <ActivityIcon className="h-4 w-4" />;
      case "dia":
        return <GaugeIcon className="h-4 w-4" />;
    }
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-slate-900/70 p-4 transition-all duration-300 backdrop-blur-md hover:-translate-y-0.5 hover:shadow-xl ${
        selected ? "border-cyan-500/80 ring-2 ring-cyan-500/30" : statusStyles.border
      } ${statusStyles.glow}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800/80 ${statusStyles.accent} ring-1 ring-slate-700/60`}
          >
            {getIcon()}
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-300">{label}</span>
            <div className="text-[10px] text-slate-400">
              Target: {normalMin}–{normalMax} {unit}
            </div>
          </div>
        </div>

        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyles.badge}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Numerical Display & Sparkline */}
      <div className="mt-3.5 flex items-baseline justify-between">
        <div className="flex items-baseline">
          <span className="text-3xl font-extrabold tracking-tight text-white font-sans tabular-nums sm:text-4xl">
            {value !== undefined ? value : "—"}
          </span>
          <span className="ml-1.5 text-xs font-medium text-slate-400">{unit}</span>
        </div>

        <div className="flex flex-col items-end">
          {renderSparkline()}
          <span className="mt-1 text-[10px] text-slate-400">Last 10 samples</span>
        </div>
      </div>

      {/* Visual Safe Zone Progress Gauge */}
      <div className="mt-3.5">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          {/* Normal range highlight background */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/20"
            style={{
              left: `${Math.max(0, ((normalMin - minBound) / (maxBound - minBound)) * 100)}%`,
              width: `${Math.min(100, ((normalMax - normalMin) / (maxBound - minBound)) * 100)}%`,
            }}
          />
          {/* Current reading position indicator */}
          <div
            className={`absolute top-0 bottom-0 w-2 -translate-x-1/2 rounded-full transition-all duration-500 ${
              status === "critical"
                ? "bg-rose-400"
                : status === "warning"
                  ? "bg-amber-400"
                  : "bg-emerald-400"
            }`}
            style={{ left: `${currentPct}%` }}
          />
        </div>
      </div>

      {/* Card Footer with Session Stats */}
      {history.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400">
          <span>Min: {Math.min(...history)}</span>
          <span className="text-slate-400 font-mono">avg {Math.round(history.reduce((a, b) => a + b, 0) / history.length)}</span>
          <span>Max: {Math.max(...history)}</span>
        </div>
      )}
    </div>
  );
}
