import path from "node:path";
import { config as loadEnv } from "dotenv";
import http from "node:http";

loadEnv({ path: path.resolve(process.cwd(), "../.env") });
loadEnv();
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { evaluateVitals, isVitalsPacket } from "./alerts.js";
import type { Alert, Medication, VitalsPacket } from "./types.js";

const PORT = Number(process.env.BACKEND_PORT ?? 4000);

const app = express();
app.use(cors());
app.use(express.json());

const latestVitals = new Map<string, VitalsPacket>();
const alerts: Alert[] = [];
const medications = new Map<string, Medication[]>();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "careconnect-backend" });
});

app.get("/vitals/:patient_id", (req, res) => {
  const packet = latestVitals.get(String(req.params.patient_id));
  if (!packet) {
    res.status(404).json({ error: "No vitals for patient" });
    return;
  }
  res.json(packet);
});

app.get("/alerts", (_req, res) => {
  res.json(alerts.slice(-100));
});

app.post("/vitals", (req, res) => {
  if (!isVitalsPacket(req.body)) {
    res.status(400).json({ error: "Body must be a VitalsPacket" });
    return;
  }
  const packet = req.body;
  latestVitals.set(packet.patient_id, packet);
  const alert = evaluateVitals(packet);
  alerts.push(alert);
  io.emit("vitals", packet);
  io.emit("alert", alert);
  res.status(201).json({ ok: true, alert });
});

app.post("/medications/:patient_id", (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    res.status(400).json({ error: "Body must be Medication[]" });
    return;
  }
  const patientId = String(req.params.patient_id);
  medications.set(patientId, list as Medication[]);
  io.emit("medications", { patient_id: patientId, medications: list });
  res.status(201).json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  socket.emit("hello", { service: "careconnect-backend" });
});

server.listen(PORT, () => {
  console.log(`CareConnect backend listening on http://localhost:${PORT}`);
});
