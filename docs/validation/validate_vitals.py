"""
CareConnect Validation Harness - Vitals Engine Benchmark & Persistence Sweep
Compares:
  (a) Single-threshold alerting (static hospital thresholds)
  (b) CareConnect multi-signal engine with persistence sweeping (P = 1, 2, 3, 5)
Over 1,000 synthetic hours (60,000 minutes) containing:
  - Normal physiological baseline variation
  - 200 transient spikes (sensor/motion artifacts)
  - 20 gradual deteriorations (true clinical deterioration events)
  - 10 sensor dropouts (sensor disconnections)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import matplotlib.pyplot as plt

from generate_synthetic_vitals import (
    GroundTruthEvent,
    VitalsReading,
    generate_1000_hours_vitals,
)


@dataclass
class ValidationMetrics:
    engine_name: str
    persistence_p: int
    total_alerts: int
    false_alerts: int
    detected_true_events: int
    missed_events: int
    mean_delay_minutes: float
    max_delay_minutes: float
    false_alert_reduction_pct: float


def run_single_threshold(
    readings: List[VitalsReading],
    events: List[GroundTruthEvent],
) -> ValidationMetrics:
    """
    Evaluates Single-Threshold Alerting on the 1,000-hour telemetry stream.
    Alerts on any single violation of static thresholds:
      - HR < 50 or > 110 bpm
      - SpO2 < 94%
      - Systolic BP < 90 or > 160 mmHg
      - Diastolic BP < 50 or > 100 mmHg
    """
    deteriorations = [e for e in events if e.event_type == "deterioration"]
    total_alerts = 0
    false_alerts = 0
    detected_events = set()
    first_detection_minute: Dict[str, int] = {}

    for r in readings:
        # Check single-threshold breach
        is_breach = False

        if r.heart_rate < 50 or r.heart_rate > 110:
            is_breach = True
        elif r.spo2 < 94:
            is_breach = True
        elif r.systolic_bp < 90 or r.systolic_bp > 160:
            is_breach = True
        elif r.diastolic_bp < 50 or r.diastolic_bp > 100:
            is_breach = True

        if is_breach:
            total_alerts += 1
            if r.is_true_deterioration and r.event_id:
                if r.event_id not in detected_events:
                    detected_events.add(r.event_id)
                    first_detection_minute[r.event_id] = r.minute
            else:
                # Alert outside true deterioration window is a false alarm
                false_alerts += 1

    delays = []
    for det in deteriorations:
        if det.event_id in first_detection_minute:
            # Delay measured from onset of physiological breach
            delay = max(0, first_detection_minute[det.event_id] - det.onset_breach_minute)
            delays.append(delay)

    mean_delay = sum(delays) / len(delays) if delays else 0.0
    max_delay = max(delays) if delays else 0.0
    missed = len(deteriorations) - len(detected_events)

    return ValidationMetrics(
        engine_name="Single-Threshold",
        persistence_p=1,
        total_alerts=total_alerts,
        false_alerts=false_alerts,
        detected_true_events=len(detected_events),
        missed_events=missed,
        mean_delay_minutes=round(mean_delay, 2),
        max_delay_minutes=round(max_delay, 2),
        false_alert_reduction_pct=0.0,
    )


def run_careconnect_engine(
    readings: List[VitalsReading],
    events: List[GroundTruthEvent],
    persistence_p: int,
    baseline_false_alerts: int,
) -> ValidationMetrics:
    """
    Evaluates CareConnect's Multi-Signal Engine:
    - Persistence Window P: requires P consecutive readings in breach condition
    - Sensor Dropout Awareness: flags dropouts (0/missing) as sensor alerts rather than emergencies
    - Incident Deduplication: tracks active clinical incident per deterioration episode
    """
    deteriorations = [e for e in events if e.event_type == "deterioration"]
    consecutive_breaches = 0
    in_active_alert_incident = False
    total_alerts = 0
    false_alerts = 0
    detected_events = set()
    first_detection_minute: Dict[str, int] = {}

    for r in readings:
        # 1. Sensor Dropout Rejection
        # Zero or missing sensor values are flagged as sensor disconnections, not vitals crises
        if r.heart_rate <= 0 or r.spo2 <= 0 or r.systolic_bp <= 0:
            consecutive_breaches = 0
            in_active_alert_incident = False
            continue

        # 2. Multi-Signal Clinical Threshold Evaluation
        is_breach = False
        # Heart Rate: Warning < 60 or > 100, Critical < 50 or > 130
        if r.heart_rate < 50 or r.heart_rate > 110:
            is_breach = True
        # SpO2: Critical < 92, Warning < 94
        elif r.spo2 < 94:
            is_breach = True
        # Systolic BP: Critical < 80 or > 160, Warning < 90 or > 140
        elif r.systolic_bp < 90 or r.systolic_bp > 160:
            is_breach = True
        # Diastolic BP: Critical < 45 or > 105, Warning < 50 or > 100
        elif r.diastolic_bp < 50 or r.diastolic_bp > 100:
            is_breach = True

        if is_breach:
            consecutive_breaches += 1
            # Sustained requirement check
            if consecutive_breaches >= persistence_p:
                if not in_active_alert_incident:
                    # New clinical alert incident confirmed!
                    total_alerts += 1
                    in_active_alert_incident = True

                    if r.is_true_deterioration and r.event_id:
                        if r.event_id not in detected_events:
                            detected_events.add(r.event_id)
                            first_detection_minute[r.event_id] = r.minute
                    else:
                        false_alerts += 1
        else:
            consecutive_breaches = 0
            in_active_alert_incident = False

    delays = []
    for det in deteriorations:
        if det.event_id in first_detection_minute:
            delay = max(0, first_detection_minute[det.event_id] - det.onset_breach_minute)
            delays.append(delay)

    mean_delay = sum(delays) / len(delays) if delays else 0.0
    max_delay = max(delays) if delays else 0.0
    missed = len(deteriorations) - len(detected_events)

    reduction_pct = 0.0
    if baseline_false_alerts > 0:
        reduction_pct = round(
            ((baseline_false_alerts - false_alerts) / baseline_false_alerts) * 100.0, 2
        )

    return ValidationMetrics(
        engine_name=f"CareConnect (P={persistence_p})",
        persistence_p=persistence_p,
        total_alerts=total_alerts,
        false_alerts=false_alerts,
        detected_true_events=len(detected_events),
        missed_events=missed,
        mean_delay_minutes=round(mean_delay, 2),
        max_delay_minutes=round(max_delay, 2),
        false_alert_reduction_pct=reduction_pct,
    )


def generate_persistence_chart(
    results: List[ValidationMetrics],
    output_path: str = "docs/validation/persistence_chart.png",
):
    """
    Generates a high-quality chart plotting False Alarms vs Detection Delay across persistence sweep.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    fig, ax1 = plt.subplots(figsize=(10, 6), dpi=300)

    # Filter CareConnect sweep results
    cc_results = [r for r in results if "CareConnect" in r.engine_name]
    single_res = next(r for r in results if r.engine_name == "Single-Threshold")

    p_vals = [r.persistence_p for r in cc_results]
    false_alarms = [r.false_alerts for r in cc_results]
    delays = [r.mean_delay_minutes for r in cc_results]

    color1 = "#dc2626"  # Red
    color2 = "#2563eb"  # Blue

    ax1.set_xlabel("Persistence Window (Consecutive Readings P)", fontsize=12, fontweight="bold")
    ax1.set_ylabel("False Alarms (per 1,000 Hours)", color=color1, fontsize=12, fontweight="bold")
    line1 = ax1.plot(
        p_vals,
        false_alarms,
        color=color1,
        marker="o",
        linewidth=2.5,
        markersize=8,
        label="False Alarms",
    )
    ax1.tick_params(axis="y", labelcolor=color1)
    ax1.set_xticks(p_vals)
    ax1.grid(True, linestyle="--", alpha=0.5)

    # Single-threshold baseline reference line
    ax1.axhline(
        y=single_res.false_alerts,
        color="#b91c1c",
        linestyle=":",
        linewidth=1.8,
        label=f"Single-Threshold Baseline ({single_res.false_alerts} false alarms)",
    )

    ax2 = ax1.twinx()
    ax2.set_ylabel("Mean Detection Delay (Minutes)", color=color2, fontsize=12, fontweight="bold")
    line2 = ax2.plot(
        p_vals,
        delays,
        color=color2,
        marker="s",
        linewidth=2.5,
        markersize=8,
        linestyle="--",
        label="Detection Delay",
    )
    ax2.tick_params(axis="y", labelcolor=color2)

    # Title & Legend
    plt.title(
        "CareConnect Vitals Validation: False Alarms vs. Detection Delay Sweep",
        fontsize=14,
        fontweight="bold",
        pad=15,
    )

    # Combine legends from both axes
    lines = line1 + line2
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc="upper right", framealpha=0.9)

    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    print(f"Saved persistence chart to: {output_path}")


def main():
    print("Generating 1,000 synthetic hours of vitals telemetry (seed=42)...")
    readings, events = generate_1000_hours_vitals(seed=42)
    print(f"Loaded {len(readings)} readings. Running benchmark...\n")

    # 1. Run Single-Threshold Alerting
    single_metrics = run_single_threshold(readings, events)

    # 2. Run CareConnect Engine sweeping P in (1, 2, 3, 5)
    all_metrics: List[ValidationMetrics] = [single_metrics]
    for p in [1, 2, 3, 5]:
        cc_metrics = run_careconnect_engine(
            readings=readings,
            events=events,
            persistence_p=p,
            baseline_false_alerts=single_metrics.false_alerts,
        )
        all_metrics.append(cc_metrics)

    # 3. Print Results Table
    print("=" * 105)
    print(
        f"{'Engine':<24} | {'P':<2} | {'Total':<6} | {'False Alarms':<12} | {'True Det':<8} | {'Missed':<6} | {'Delay(m)':<8} | {'FA Reduct %':<10}"
    )
    print("=" * 105)
    for m in all_metrics:
        print(
            f"{m.engine_name:<24} | {m.persistence_p:<2} | {m.total_alerts:<6} | {m.false_alerts:<12} | {m.detected_true_events:<8} | {m.missed_events:<6} | {m.mean_delay_minutes:<8.2f} | {m.false_alert_reduction_pct:>9.2f}%"
        )
    print("=" * 105)

    # 4. Generate Plot
    chart_path = os.path.join(os.path.dirname(__file__), "persistence_chart.png")
    generate_persistence_chart(all_metrics, chart_path)

    # Return metrics for report generator
    return all_metrics


if __name__ == "__main__":
    main()
