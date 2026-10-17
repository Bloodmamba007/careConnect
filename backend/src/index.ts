import path from "node:path";
import { config as loadEnv } from "dotenv";
import http from "node:http";
import { randomUUID } from "node:crypto";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv();
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { evaluateVitals, isVitalsPacket } from "./alerts.js";
import { handleAlertEscalation, acknowledgeAlert } from "./escalation.js";
import { analyzeDrugInteractions } from "./ddiEngine.js";
import { runMigrations, getAuditTrail } from "./db/index.js";
import { FusionEngine } from "./fusionEngine.js";
import type { Alert, Medication, VitalsPacket } from "./types.js";

const PORT = Number(process.env.BACKEND_PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json());

const latestVitals = new Map<string, VitalsPacket>();
const alerts: Alert[] = [];
const medications = new Map<string, Medication[]>();
const escalationTimers = new Map<string, NodeJS.Timeout>();

// Preload default active medications with low-key safety notes for pt_001
const defaultMedications: Medication[] = [
  {
    drug_name: "Lisinopril",
    generic_name: "lisinopril",
    form: "tablet",
    strength: "10 mg",
    frequency: "once daily",
    timing: "morning",
    duration_days: 90,
    confidence: 0.96,
    rxnorm_id: "29046",
    safety_notes: [
      "Take with or without food at the same time each day.",
      "Monitor for orthostatic dizziness when standing quickly."
    ]
  },
  {
    drug_name: "Metoprolol Tartrate",
    generic_name: "metoprolol",
    form: "tablet",
    strength: "25 mg",
    frequency: "twice daily",
    timing: "morning & evening with meals",
    duration_days: 60,
    confidence: 0.95,
    rxnorm_id: "866416",
    safety_notes: [
      "Take with or immediately after food.",
      "Check pulse prior to taking; hold if HR < 55 bpm without clinician approval."
    ]
  },
  {
    drug_name: "Lipitor",
    generic_name: "atorvastatin",
    form: "tablet",
    strength: "20 mg",
    frequency: "once daily",
    timing: "bedtime",
    duration_days: 90,
    confidence: 0.98,
    rxnorm_id: "617314",
    safety_notes: [
      "Avoid large amounts of grapefruit juice.",
      "Report unexplained muscle stiffness or weakness."
    ]
  }
];
medications.set("pt_001", defaultMedications);

const fusionEngine = new FusionEngine();
fusionEngine.updateMedications("pt_001", defaultMedications);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

function handleCriticalAlert(alert: Alert) {
  if (alert.severity === "RED") {
    // Emit alert:critical as specifically required for EmergencyModal
    io.emit("alert:critical", alert);

    // Stop existing timer if event_id already tracked
    if (escalationTimers.has(alert.event_id)) {
      clearTimeout(escalationTimers.get(alert.event_id)!);
    }

    // 60-second escalation timer
    const timer = setTimeout(() => {
      escalationTimers.delete(alert.event_id);
      console.warn(`[ESCALATION TRIGGERED] Alert ${alert.event_id} was not acknowledged within 60s! Escalating to emergency response.`);
      io.emit("alert:escalated", {
        event_id: alert.event_id,
        patient_id: alert.patient_id,
        timestamp: new Date().toISOString(),
        message: "Caregiver response timeout (60s). Escalating to emergency medical services."
      });
    }, 60000);

    escalationTimers.set(alert.event_id, timer);
  }
}

// Health check
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ ok: true, service: "careconnect-backend" });
});

// Vitals by patient
app.get(["/vitals/:patient_id", "/api/vitals/:patient_id"], (req, res) => {
  const packet = latestVitals.get(String(req.params.patient_id));
  if (!packet) {
    res.status(404).json({ error: "No vitals for patient" });
    return;
  }
  res.json(packet);
});

// Alerts list
app.get(["/alerts", "/api/alerts"], (_req, res) => {
  res.json(alerts.slice(-100));
});

// Ingest vitals
app.post(["/vitals", "/api/vitals"], async (req, res) => {
  if (!isVitalsPacket(req.body)) {
    res.status(400).json({ error: "Body must be a VitalsPacket" });
    return;
  }
  const packet = req.body;
  latestVitals.set(packet.patient_id, packet);
  const fusionResult = fusionEngine.processVitals(packet);
  const alert = fusionResult.alert ?? evaluateVitals(packet);
  alerts.push(alert);
  
  io.emit("vitals", packet);
  io.emit("alert", alert);
  if (fusionResult.dashboard_card) {
    io.emit("dashboard:card", fusionResult.dashboard_card);
  }

  // Trigger escalation workflow on RED alerts (non-silent)
  if (!fusionResult.is_silent && alert.severity === "RED") {
    handleCriticalAlert(alert);
    handleAlertEscalation(alert, {
      vitals: packet,
      medications: medications.get(packet.patient_id),
    }).catch((err) => console.error("[Escalation] Error handling alert:", err));
  }

  res.status(201).json({ ok: true, alert, fusion: fusionResult });
});

app.post(["/alerts/:event_id/acknowledge", "/api/alerts/:event_id/acknowledge"], async (req, res) => {
  const alertId = String(req.params.event_id);
  const existingAlert = alerts.find((a) => a.event_id === alertId);
  const result = await acknowledgeAlert(
    alertId,
    req.body,
    existingAlert?.patient_id,
  );
  io.emit("alert_acknowledged", result);
  res.json(result);
});

app.get(["/alerts/:event_id/audit", "/api/alerts/:event_id/audit"], async (req, res) => {
  const alertId = String(req.params.event_id);
  const trail = await getAuditTrail({ alert_id: alertId });
  res.json(trail);
});

app.get(["/audit", "/api/audit"], async (req, res) => {
  const patientId = req.query.patient_id ? String(req.query.patient_id) : undefined;
  const alertId = req.query.alert_id ? String(req.query.alert_id) : undefined;
  const trail = await getAuditTrail({ patient_id: patientId, alert_id: alertId });
  res.json(trail);
});

// Medications
app.get(["/medications/:patient_id", "/api/medications/:patient_id"], (req, res) => {
  const patientId = String(req.params.patient_id);
  const list = medications.get(patientId) ?? defaultMedications;
  res.json(list);
});

// Handles medication updates and triggers DDI analysis
function updatePatientMedications(patientId: string, list: Medication[]) {
  medications.set(patientId, list);
  io.emit("medications", { patient_id: patientId, medications: list });

  const ddiResult = analyzeDrugInteractions(patientId, list);

  // If a CRITICAL drug interaction is detected, emit COMPOUND alert and trigger escalation
  if (ddiResult.critical_alert) {
    alerts.push(ddiResult.critical_alert);
    io.emit("alert", ddiResult.critical_alert);

    handleAlertEscalation(ddiResult.critical_alert, {
      vitals: latestVitals.get(patientId),
      medications: list,
    }).catch((err) =>
      console.error("[DDI Escalation] Error escalating compound alert:", err),
    );
  }

  return ddiResult;
}

// RESTful DDI endpoints
app.post("/api/patients/:id/medications", (req, res) => {
  const body = req.body;
  const list = Array.isArray(body) ? body : body.medications;
  if (!Array.isArray(list)) {
    res.status(400).json({ error: "Body must be Medication[] or { medications: Medication[] }" });
    return;
  }
  const patientId = String(req.params.id);
  const result = updatePatientMedications(patientId, list as Medication[]);
  res.status(201).json(result);
});

app.get("/api/patients/:id/interactions", (req, res) => {
  const patientId = String(req.params.id);
  const list = medications.get(patientId) || [];
  const result = analyzeDrugInteractions(patientId, list);
  res.json(result);
});

// Legacy medication POST route (also triggers DDI)
app.post(["/medications/:patient_id", "/api/medications/:patient_id"], (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    res.status(400).json({ error: "Body must be Medication[]" });
    return;
  }
  const patientId = String(req.params.patient_id);
  medications.set(patientId, list as Medication[]);
  const ddiOutput = fusionEngine.updateMedications(patientId, list as Medication[]);
  const ddiResult = updatePatientMedications(patientId, list as Medication[]);
  io.emit("medications", { patient_id: patientId, medications: list });
  res.status(201).json({ ok: true, ddi: ddiResult, fusion: ddiOutput });
});

// Acknowledge alert (stops escalation timer)
const ackAlert = (req: express.Request, res: express.Response) => {
  const eventId = String(req.params.id);
  const alert = alerts.find((a) => a.event_id === eventId);

  // Stop escalation timer if active
  if (escalationTimers.has(eventId)) {
    clearTimeout(escalationTimers.get(eventId)!);
    escalationTimers.delete(eventId);
    console.log(`[ESCALATION STOPPED] Escalation timer stopped for alert ${eventId}`);
  }

  if (alert) {
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    io.emit("alert:acknowledged", {
      event_id: alert.event_id,
      acknowledged: true,
      acknowledged_at: alert.acknowledged_at
    });
    io.emit("alert:updated", alert);
    res.json({ ok: true, alert, stopped_escalation: true });
    return;
  }

  // Fallback if not found in memory history
  io.emit("alert:acknowledged", {
    event_id: eventId,
    acknowledged: true,
    acknowledged_at: new Date().toISOString()
  });
  res.json({ ok: true, event_id: eventId, acknowledged: true, stopped_escalation: true });
};

app.post("/api/alerts/:id/ack", ackAlert);
app.post("/alerts/:id/ack", ackAlert);

// Alert feedback ("False alarm" / "Real problem")
const feedbackAlert = (req: express.Request, res: express.Response) => {
  const eventId = String(req.params.id);
  const feedback = req.body?.feedback;

  if (feedback !== "False alarm" && feedback !== "Real problem") {
    res.status(400).json({ error: "Feedback must be 'False alarm' or 'Real problem'" });
    return;
  }

  const alert = alerts.find((a) => a.event_id === eventId);
  if (alert) {
    alert.feedback = feedback;
    alert.feedback_at = new Date().toISOString();
    io.emit("alert:feedback", {
      event_id: alert.event_id,
      feedback: alert.feedback,
      feedback_at: alert.feedback_at
    });
    io.emit("alert:updated", alert);
    res.json({ ok: true, alert });
    return;
  }

  res.status(404).json({ error: "Alert not found" });
};

app.post("/api/alerts/:id/feedback", feedbackAlert);
app.post("/alerts/:id/feedback", feedbackAlert);

// Simulator scenarios handler for Demo Panel
const scenarioHandler = (req: express.Request, res: express.Response) => {
  const scenario = req.body?.scenario || req.params?.scenario;
  const patient_id = req.body?.patient_id || "pt_001";
  const now = new Date().toISOString();

  let packet: VitalsPacket;
  let customAlert: Alert | null = null;

  if (scenario === "stable" || scenario === "normal") {
    packet = {
      patient_id,
      timestamp: now,
      heart_rate: 74,
      spo2: 98.5,
      systolic_bp: 120,
      diastolic_bp: 78,
    };
  } else if (scenario === "watching" || scenario === "warning") {
    packet = {
      patient_id,
      timestamp: now,
      heart_rate: 114,
      spo2: 95,
      systolic_bp: 148,
      diastolic_bp: 94,
    };
  } else if (scenario === "crisis" || scenario === "critical") {
    packet = {
      patient_id,
      timestamp: now,
      heart_rate: 146,
      spo2: 83,
      systolic_bp: 74,
      diastolic_bp: 42,
    };
  } else if (scenario === "compound") {
    packet = {
      patient_id,
      timestamp: now,
      heart_rate: 46,
      spo2: 91,
      systolic_bp: 72,
      diastolic_bp: 40,
    };
    const patientMeds = medications.get(patient_id) ?? defaultMedications;
    fusionEngine.updateMedications(patient_id, patientMeds);
    const fusionRes = fusionEngine.processVitals(packet);
    customAlert = fusionRes.alert;
  } else {
    res.status(400).json({ error: "Unknown scenario. Use 'stable', 'watching', 'crisis', or 'compound'" });
    return;
  }

  latestVitals.set(packet.patient_id, packet);
  const alert = customAlert ?? evaluateVitals(packet);
  alerts.push(alert);

  io.emit("vitals", packet);
  io.emit("alert", alert);
  handleCriticalAlert(alert);

  res.json({ ok: true, scenario, packet, alert });
};

app.post("/api/simulator/scenario", scenarioHandler);
app.post("/simulator/scenario", scenarioHandler);
app.post("/api/simulator/:scenario", scenarioHandler);
app.post("/simulator/:scenario", scenarioHandler);

// Fusion risk state endpoint for dashboard
app.get(["/fusion/risk/:patient_id", "/api/fusion/risk/:patient_id"], (req, res) => {
  const patientId = String(req.params.patient_id);
  const state = fusionEngine.getRiskState(patientId);
  const ddi = fusionEngine.getDDIEngine().getLatestOutput(patientId);
  res.json({
    ok: true,
    risk_state: state,
    ddi,
  });
});

io.on("connection", (socket) => {
  socket.emit("hello", { service: "careconnect-backend" });
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[Server] Port ${PORT} already in use; reusing existing listener.`);
  } else {
    console.error("[Server] Error:", err);
  }
});

server.listen(PORT, async () => {
  console.log(`CareConnect backend listening on http://localhost:${PORT}`);
  try {
    await runMigrations();
  } catch (err) {
    console.warn("[PostgreSQL] Could not auto-apply migrations on startup:", err);
  }
});
export { app, server, io, alerts, latestVitals, escalationTimers, fusionEngine };

