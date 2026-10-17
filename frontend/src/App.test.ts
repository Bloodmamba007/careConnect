import { describe, expect, it } from "vitest";
import { PATIENTS, INITIAL_MEDICATIONS, DEMO_SCENARIOS, generateInitialHistory, createInitialPacket } from "./utils/mockData";

describe("CareConnect Frontend Telemetry", () => {
  it("initializes default patients with complete baselines", () => {
    expect(PATIENTS.length).toBeGreaterThanOrEqual(3);
    const pt1 = PATIENTS[0];
    expect(pt1.id).toBe("pt_001");
    expect(pt1.baseline.heartRate).toBeGreaterThan(50);
    expect(pt1.baseline.spo2).toBeGreaterThanOrEqual(95);
  });

  it("provides initial medications matching contract", () => {
    expect(INITIAL_MEDICATIONS.length).toBeGreaterThan(0);
    const lipitor = INITIAL_MEDICATIONS.find((m) => m.drug_name === "Lipitor");
    expect(lipitor).toBeDefined();
    expect(lipitor?.rxnorm_id).toBe("617314");
    expect(lipitor?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("defines standard demo scenarios for presentation", () => {
    expect(DEMO_SCENARIOS.length).toBe(4);
    const compound = DEMO_SCENARIOS.find((s) => s.id === "compound");
    expect(compound).toBeDefined();
    expect(compound?.severity).toBe("RED");
    expect(compound?.vitals.systolic_bp).toBeLessThan(90);
  });

  it("generates realistic telemetry history for charts", () => {
    const history = generateInitialHistory("pt_001");
    expect(history.length).toBeGreaterThanOrEqual(15);
    const sample = history[0];
    expect(sample).toHaveProperty("heart_rate");
    expect(sample).toHaveProperty("spo2");
    expect(sample).toHaveProperty("systolic_bp");
    expect(sample).toHaveProperty("diastolic_bp");
    expect(sample).toHaveProperty("timeLabel");
  });

  it("creates valid initial packet", () => {
    const packet = createInitialPacket("pt_001");
    expect(packet.patient_id).toBe("pt_001");
    expect(packet.heart_rate).toBe(72);
    expect(packet.spo2).toBe(98);
  });
});
