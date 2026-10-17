import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { Alert, VitalsPacket } from "./types";

const severityStyles: Record<Alert["severity"], string> = {
  GREEN: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  YELLOW: "bg-amber-500/15 text-amber-200 ring-amber-500/40",
  RED: "bg-rose-500/15 text-rose-200 ring-rose-500/40",
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [vitals, setVitals] = useState<VitalsPacket | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const socket = io("http://localhost:4000", { transports: ["websocket"] });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("vitals", (packet: VitalsPacket) => setVitals(packet));
    socket.on("alert", (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 20));
    });
    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            CareConnect
          </p>
          <h1 className="mt-1 text-3xl font-bold">Patient monitoring</h1>
          <p className="mt-2 text-slate-400">
            Live vitals and alerts. No camera or video capture in this app.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm ring-1 ${
            connected
              ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
              : "bg-slate-800 text-slate-400 ring-slate-700"
          }`}
        >
          {connected ? "socket connected" : "socket offline"}
        </span>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VitalCard label="Heart rate" value={vitals?.heart_rate} unit="bpm" />
        <VitalCard label="SpO2" value={vitals?.spo2} unit="%" />
        <VitalCard label="Systolic BP" value={vitals?.systolic_bp} unit="mmHg" />
        <VitalCard label="Diastolic BP" value={vitals?.diastolic_bp} unit="mmHg" />
      </section>

      {vitals && (
        <p className="mt-4 text-sm text-slate-500">
          Patient {vitals.patient_id} · {vitals.timestamp}
        </p>
      )}

      <h2 className="mt-12 text-xl font-semibold">Alerts</h2>
      <ul className="mt-4 space-y-3">
        {alerts.length === 0 && (
          <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-slate-400">
            Waiting for simulator packets. Run <code className="text-cyan-300">make sim</code>.
          </li>
        )}
        {alerts.map((alert) => (
          <li
            key={alert.event_id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severityStyles[alert.severity]}`}
              >
                {alert.severity}
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-500">{alert.type}</span>
              <span className="text-xs text-slate-500">{alert.timestamp}</span>
            </div>
            <p className="mt-2 font-medium">{alert.message}</p>
            {alert.instructions.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-300">
                {alert.instructions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VitalCard({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {value ?? "—"}
        <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
