process.env.BACKEND_PORT = "4005";
process.env.MOCK_NOTIFICATIONS = "true";

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import type { Alert, Medication, VitalsPacket } from "./types.js";
import { clearAllActiveEscalations, resetRateLimits } from "./escalation.js";

describe("Phase 9: End-to-End Integration Test: simulator → backend → fusion → dashboard event → escalation (mock)", async () => {
  const { app, server, io, alerts, latestVitals, escalationTimers, fusionEngine } = await import("./index.js");
  const BACKEND_URL = "http://localhost:4005";
  const capturedSocketEvents: Array<{ event: string; data: any }> = [];

  before(async () => {
    for (let i = 0; i < 20; i++) {
      try {
        const h = await fetch(`${BACKEND_URL}/health`);
        if (h.ok) break;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    // Intercept socket.io emits to verify real-time dashboard events
    const origEmit = io.emit.bind(io);
    io.emit = ((ev: string, ...args: any[]) => {
      capturedSocketEvents.push({ event: ev, data: args[0] });
      return origEmit(ev, ...args);
    }) as any;
  });

  after(() => {
    clearAllActiveEscalations();
    for (const [, timer] of escalationTimers) {
      clearTimeout(timer);
    }
    escalationTimers.clear();
    server.close();
    io.close();
  });

  it("Full pipeline: Simulator sends resting vitals -> Backend ingests -> Fusion classifies NORMAL -> Dashboard receives normal telemetry", async () => {
    capturedSocketEvents.length = 0;

    // 1. Simulator generates resting baseline vitals packet
    const restingPacket: VitalsPacket = {
      patient_id: "pt_001",
      timestamp: new Date().toISOString(),
      heart_rate: 72,
      spo2: 98.4,
      systolic_bp: 118,
      diastolic_bp: 76,
    };

    // 2. Post to backend /api/vitals
    const res = await fetch(`${BACKEND_URL}/api/vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(restingPacket),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);

    // 3. Fusion engine evaluation
    assert.ok(body.fusion);
    // Since pt_001 has Lisinopril + Metoprolol, normal vitals route to CRITICAL_INTERACTION_NORMAL_VITALS or NORMAL
    assert.ok(
      body.fusion.decision_branch === "CRITICAL_INTERACTION_NORMAL_VITALS" ||
        body.fusion.decision_branch === "NORMAL",
    );
    assert.equal(body.fusion.is_silent, true);
    assert.equal(body.alert.severity, "GREEN");

    // 4. Dashboard events emitted via Socket.io
    const vitalsEvent = capturedSocketEvents.find((e) => e.event === "vitals");
    assert.ok(vitalsEvent, "Dashboard must receive 'vitals' event");
    assert.equal(vitalsEvent.data.heart_rate, 72);

    const alertEvent = capturedSocketEvents.find((e) => e.event === "alert");
    assert.ok(alertEvent, "Dashboard must receive 'alert' event");
    assert.equal(alertEvent.data.severity, "GREEN");

    // No critical alert or escalation for resting vitals
    const criticalEvent = capturedSocketEvents.find((e) => e.event === "alert:critical");
    assert.equal(criticalEvent, undefined, "Resting vitals must not trigger alert:critical");
  });

  it("Full pipeline: Simulator sends Compound crisis -> Backend ingests -> Fusion identifies COMPOUND_BREACH -> Dashboard receives critical alert -> Mock escalation triggers -> Caregiver ACK halts escalation", async () => {
    capturedSocketEvents.length = 0;
    resetRateLimits();

    // 1. Simulator sends compound crash packet (Hypotension + Bradycardia under Lisinopril + Metoprolol)
    const compoundCrashPacket: VitalsPacket = {
      patient_id: "pt_001",
      timestamp: new Date().toISOString(),
      heart_rate: 45, // Bradycardia breach
      spo2: 92,
      systolic_bp: 72, // Severe hypotension breach
      diastolic_bp: 41,
    };

    // 2. Simulator posts to backend
    const res = await fetch(`${BACKEND_URL}/api/vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compoundCrashPacket),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);

    // 3. Fusion engine verifies Branch 2: COMPOUND_BREACH
    const fusion = body.fusion;
    assert.ok(fusion, "Fusion payload must be present");
    assert.equal(fusion.decision_branch, "COMPOUND_BREACH");
    assert.equal(fusion.is_silent, false);

    const alert: Alert = body.alert;
    assert.equal(alert.severity, "RED");
    assert.equal(alert.type, "COMPOUND");
    assert.ok(alert.contributing_signals.includes("systolic_bp"));
    assert.ok(alert.contributing_signals.includes("heart_rate"));

    // Check non-causal phrasing
    assert.ok(alert.message.includes("possibly related to"));
    assert.ok(alert.message.includes("Show this medication list to the emergency team."));

    // Check explanation payload for caregiver "Why this alert?" panel
    assert.ok(alert.explanation);
    assert.ok(alert.explanation.matched_rule.includes("Compound Risk Rule"));
    assert.ok(alert.explanation.thresholds.systolic_bp);
    assert.ok(alert.explanation.thresholds.heart_rate);

    // 4. Dashboard events emitted via Socket.io
    const criticalSocketEvent = capturedSocketEvents.find((e) => e.event === "alert:critical");
    assert.ok(criticalSocketEvent, "Dashboard must receive 'alert:critical' event for EmergencyModal");
    assert.equal(criticalSocketEvent.data.event_id, alert.event_id);
    assert.equal(criticalSocketEvent.data.type, "COMPOUND");

    // 5. Escalation: verify active escalation timer was set on backend
    assert.ok(
      escalationTimers.has(alert.event_id),
      "Backend must activate 60s emergency escalation timer for RED alert",
    );

    // 6. Caregiver acknowledges alert: POST /api/alerts/:id/ack
    const ackRes = await fetch(`${BACKEND_URL}/api/alerts/${alert.event_id}/ack`, {
      method: "POST",
    });
    assert.equal(ackRes.status, 200);
    const ackBody = await ackRes.json();
    assert.equal(ackBody.ok, true);
    assert.equal(ackBody.stopped_escalation, true);

    // Verify escalation timer was cancelled and removed
    assert.equal(
      escalationTimers.has(alert.event_id),
      false,
      "Escalation timer must be cleared immediately upon acknowledgment",
    );

    // Verify dashboard received 'alert:acknowledged' event
    const ackSocketEvent = capturedSocketEvents.find((e) => e.event === "alert:acknowledged");
    assert.ok(ackSocketEvent, "Dashboard must receive 'alert:acknowledged' event");
    assert.equal(ackSocketEvent.data.event_id, alert.event_id);
  });
});
