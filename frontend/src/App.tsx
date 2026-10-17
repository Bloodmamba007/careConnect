import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Activity, Wifi, WifiOff, Terminal, User, Clock, AlertTriangle } from "lucide-react";
import type { Alert, Medication, VitalsPacket } from "./types";
import { VitalsCards } from "./components/VitalsCards";
import { VitalsChart } from "./components/VitalsChart";
import { StatusBanner } from "./components/StatusBanner";
import { MedicationCard } from "./components/MedicationCard";
import { EmergencyModal } from "./components/EmergencyModal";
import { AlertHistory } from "./components/AlertHistory";
import { DemoPanel } from "./components/DemoPanel";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [currentVitals, setCurrentVitals] = useState<VitalsPacket | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsPacket[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  
  // Emergency Modal state
  const [criticalAlert, setCriticalAlert] = useState<Alert | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hidden Demo Panel state
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Load initial patient state (vitals, alerts, medications)
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [vitalsRes, alertsRes, medsRes] = await Promise.allSettled([
          fetch(`${BACKEND_URL}/api/vitals/pt_001`),
          fetch(`${BACKEND_URL}/api/alerts`),
          fetch(`${BACKEND_URL}/api/medications/pt_001`),
        ]);

        if (vitalsRes.status === "fulfilled" && vitalsRes.value.ok) {
          const vData = await vitalsRes.value.json();
          setCurrentVitals(vData);
          setVitalsHistory([vData]);
        }

        if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
          const aData = await alertsRes.value.json();
          setAlerts(aData.reverse());
        }

        if (medsRes.status === "fulfilled" && medsRes.value.ok) {
          const mData = await medsRes.value.json();
          setMedications(mData);
        }
      } catch (err) {
        console.warn("Initial data load partial failure:", err);
      }
    }

    loadInitialData();
  }, []);

  // Initialize Socket.io connection
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setIsReconnecting(false);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      setIsReconnecting(true);
      console.warn("Socket disconnected:", reason);
    });

    socket.on("connect_error", () => {
      setConnected(false);
      setIsReconnecting(true);
    });

    // Receive streaming vitals: maintain buffer of the last 120 vitals points
    socket.on("vitals", (packet: VitalsPacket) => {
      setCurrentVitals(packet);
      setVitalsHistory((prev) => [...prev.slice(-119), packet]);
    });

    // Receive general alert
    socket.on("alert", (newAlert: Alert) => {
      setAlerts((prev) => {
        const exists = prev.some((a) => a.event_id === newAlert.event_id);
        if (exists) {
          return prev.map((a) => (a.event_id === newAlert.event_id ? newAlert : a));
        }
        return [newAlert, ...prev].slice(0, 50);
      });

      // If critical and not acknowledged, trigger takeover
      if (newAlert.severity === "RED" && !newAlert.acknowledged) {
        setCriticalAlert(newAlert);
        setIsModalOpen(true);
      }
    });

    // Receive critical alert specifically
    socket.on("alert:critical", (newAlert: Alert) => {
      setAlerts((prev) => {
        const exists = prev.some((a) => a.event_id === newAlert.event_id);
        if (exists) {
          return prev.map((a) => (a.event_id === newAlert.event_id ? newAlert : a));
        }
        return [newAlert, ...prev].slice(0, 50);
      });
      setCriticalAlert(newAlert);
      setIsModalOpen(true);
    });

    // Acknowledged alert event
    socket.on("alert:acknowledged", ({ event_id }: { event_id: string }) => {
      setAlerts((prev) =>
        prev.map((a) => (a.event_id === event_id ? { ...a, acknowledged: true } : a))
      );
      if (criticalAlert?.event_id === event_id) {
        setIsModalOpen(false);
      }
    });

    // Feedback updated event
    socket.on("alert:feedback", ({ event_id, feedback }: { event_id: string; feedback: "False alarm" | "Real problem" }) => {
      setAlerts((prev) =>
        prev.map((a) => (a.event_id === event_id ? { ...a, feedback } : a))
      );
    });

    // Updated medications
    socket.on("medications", ({ medications: newMeds }: { medications: Medication[] }) => {
      if (Array.isArray(newMeds)) {
        setMedications(newMeds);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [criticalAlert]);

  // Keyboard shortcut for Demo Panel: Alt+D or Ctrl+Shift+D or 'd' when not in inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement as HTMLElement)?.isContentEditable;

      if ((e.altKey && e.key.toLowerCase() === "d") || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d")) {
        e.preventDefault();
        setShowDemoPanel((prev) => !prev);
      } else if (e.key.toLowerCase() === "d" && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShowDemoPanel((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Acknowledge alert (POST /api/alerts/:id/ack)
  const handleAcknowledge = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/${eventId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.event_id === eventId ? { ...a, acknowledged: true } : a))
        );
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Error acknowledging alert:", err);
    }
  }, []);

  // Feedback on alert (POST /api/alerts/:id/feedback)
  const handleFeedback = useCallback(async (eventId: string, feedback: "False alarm" | "Real problem") => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/alerts/${eventId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.event_id === eventId ? { ...a, feedback } : a))
        );
      }
    } catch (err) {
      console.error("Error sending alert feedback:", err);
    }
  }, []);

  // Trigger simulator scenario
  const handleTriggerScenario = useCallback(async (scenario: "stable" | "watching" | "crisis" | "compound") => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/simulator/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, patient_id: "pt_001" }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.packet) {
          setCurrentVitals(data.packet);
          setVitalsHistory((prev) => [...prev.slice(-119), data.packet]);
        }
        if (data.alert) {
          setAlerts((prev) => [data.alert, ...prev.filter((a) => a.event_id !== data.alert.event_id)].slice(0, 50));
          if (data.alert.severity === "RED") {
            setCriticalAlert(data.alert);
            setIsModalOpen(true);
          }
        }
      }
    } catch (err) {
      console.error("Failed to trigger scenario:", err);
    }
  }, []);

  // Toggle Socket simulation for testing "Reconnecting..." state
  const handleToggleSocketSimulation = useCallback(() => {
    if (!socketRef.current) return;
    if (connected) {
      socketRef.current.disconnect();
      setConnected(false);
      setIsReconnecting(true);
    } else {
      socketRef.current.connect();
    }
  }, [connected]);

  const latestAlert = alerts[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Reconnecting banner if socket drops */}
      {(!connected || isReconnecting) && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-50 flex items-center justify-between bg-amber-500 px-4 py-2.5 text-slate-950 font-black shadow-lg animate-pulse"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-5 h-5 animate-bounce" />
            <span className="text-sm uppercase tracking-wider">
              Reconnecting... Live telemetry stream offline. Attempting automatic reconnection.
            </span>
          </div>
          <button
            onClick={handleToggleSocketSimulation}
            className="rounded bg-slate-950 px-2.5 py-1 text-xs text-amber-400 font-bold hover:bg-slate-900 transition-colors"
          >
            Reconnect Now
          </button>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest uppercase text-cyan-400">CareConnect</span>
                <span className="text-xs text-slate-400 font-medium bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  Caregiver Dashboard
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Patient Monitoring Station
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Patient Badge */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
              <User className="w-4 h-4 text-slate-400" />
              <span>Patient: <strong className="text-white">pt_001 (Eleanor Vance)</strong></span>
            </div>

            {/* Socket Status Pill */}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${
                connected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/40"
              }`}
            >
              {connected ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span>Telemetry Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Reconnecting...</span>
                </>
              )}
            </div>

            {/* Demo Button to toggle demo panel */}
            <button
              onClick={() => setShowDemoPanel((prev) => !prev)}
              aria-label="Toggle Demo Scenarios Panel"
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 px-3 py-1.5 text-xs font-bold text-indigo-300 transition-colors"
            >
              <Terminal className="w-4 h-4" />
              <span>Demo Panel <kbd className="text-[10px] bg-slate-900 px-1 py-0.5 rounded border border-slate-700">Alt+D</kbd></span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        {/* Status Banner */}
        <StatusBanner
          latestAlert={latestAlert}
          onOpenEmergencyModal={latestAlert?.severity === "RED" ? () => setIsModalOpen(true) : undefined}
        />

        {/* Current Vitals Cards */}
        <VitalsCards vitals={currentVitals} />

        {/* Live Recharts Line Chart */}
        <VitalsChart data={vitalsHistory} />

        {/* Active Medications & Safety Notes */}
        <MedicationCard medications={medications} />

        {/* Past Alert History with Feedback Buttons */}
        <AlertHistory alerts={alerts} onFeedback={handleFeedback} />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-5 text-center text-xs text-slate-400">
        <p>CareConnect Realtime Caregiver Station &middot; High Contrast Continuous Telemetry &middot; Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">Alt+D</kbd> to launch scenario simulator</p>
      </footer>

      {/* Full-Screen Red Emergency Takeover Modal */}
      <EmergencyModal
        alert={criticalAlert}
        isOpen={isModalOpen}
        onAcknowledge={handleAcknowledge}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Hidden Demo Panel */}
      <DemoPanel
        isOpen={showDemoPanel}
        onClose={() => setShowDemoPanel(false)}
        onTriggerScenario={handleTriggerScenario}
        onToggleSocketSimulation={handleToggleSocketSimulation}
        isSocketConnected={connected}
      />
    </div>
  );
}
