import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import { app, server, io } from "./index.js";

test("API routes: simulator scenarios, ack, feedback", async () => {
  // 1. Simulator scenario 'crisis' produces RED alert and vitals
  const crisisRes = await fetch("http://localhost:4000/api/simulator/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: "crisis", patient_id: "pt_001" }),
  });
  assert.equal(crisisRes.status, 200);
  const crisisData = await crisisRes.json();
  assert.equal(crisisData.ok, true);
  assert.equal(crisisData.alert.severity, "RED");
  assert.equal(crisisData.packet.spo2, 83);
  const eventId = crisisData.alert.event_id;

  // 2. Acknowledge alert: POST /api/alerts/:id/ack stops escalation
  const ackRes = await fetch(`http://localhost:4000/api/alerts/${eventId}/ack`, {
    method: "POST",
  });
  assert.equal(ackRes.status, 200);
  const ackData = await ackRes.json();
  assert.equal(ackData.ok, true);
  assert.equal(ackData.alert.acknowledged, true);
  assert.equal(ackData.stopped_escalation, true);

  // 3. Feedback: POST /api/alerts/:id/feedback with "Real problem"
  const feedbackRes = await fetch(`http://localhost:4000/api/alerts/${eventId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback: "Real problem" }),
  });
  assert.equal(feedbackRes.status, 200);
  const feedbackData = await feedbackRes.json();
  assert.equal(feedbackData.ok, true);
  assert.equal(feedbackData.alert.feedback, "Real problem");

  // 4. Stable scenario produces GREEN alert
  const stableRes = await fetch("http://localhost:4000/api/simulator/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: "stable", patient_id: "pt_001" }),
  });
  assert.equal(stableRes.status, 200);
  const stableData = await stableRes.json();
  assert.equal(stableData.alert.severity, "GREEN");

  // Close server after test
  server.close();
  io.close();
});
