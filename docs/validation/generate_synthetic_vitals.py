"""
CareConnect Validation Harness - Synthetic Vitals Generator
Generates 1,000 synthetic hours (60,000 minutes) of physiological vitals with:
- Normal physiological baseline variation (autoregressive AR(1) process)
- 200 transient spikes (isolated sensor/motion artifacts, 1-reading duration)
- 20 gradual deteriorations (true clinical deterioration events lasting 20-40 min)
- 10 sensor dropouts (signal loss / disconnection, 2-5 min duration)
Seeded with a fixed seed (42) for deterministic reproducibility.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from random import Random
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class GroundTruthEvent:
    event_id: str
    event_type: str  # "deterioration", "spike", "dropout"
    is_true_event: bool  # True for true clinical deterioration, False for artifacts
    primary_signal: str  # "spo2", "heart_rate", "systolic_bp", "diastolic_bp", "compound"
    start_minute: int
    onset_breach_minute: int
    end_minute: int
    description: str


@dataclass
class VitalsReading:
    minute: int
    timestamp: str
    patient_id: str
    heart_rate: float
    spo2: float
    systolic_bp: float
    diastolic_bp: float
    is_artifact: bool
    is_true_deterioration: bool
    is_dropout: bool
    event_id: Optional[str] = None


def generate_1000_hours_vitals(
    seed: int = 42,
    patient_id: str = "pt_synth_001",
    total_hours: int = 1000,
    sampling_interval_minutes: int = 1,
) -> Tuple[List[VitalsReading], List[GroundTruthEvent]]:
    """
    Generates 1,000 hours of continuous vitals at 1-minute resolution (60,000 readings).
    """
    rng = Random(seed)
    total_minutes = total_hours * 60 // sampling_interval_minutes
    base_time = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # 1. Plan 20 Gradual Deteriorations (spaced out across the 1,000 hours)
    # Each spaced ~45-50 hours apart, duration 20-40 minutes
    deterioration_events: List[GroundTruthEvent] = []
    deterioration_intervals: List[Tuple[int, int]] = []

    # 4 clinical deterioration archetypes:
    # - Hypoxia / Respiratory Decompensation
    # - Tachycardic Sepsis / Shock
    # - Hypotensive Collapse
    # - Compound Bradycardia + Severe Hypotension
    archetypes = [
        ("hypoxia", "spo2", "Acute progressive hypoxia (SpO2 desaturation < 90%)"),
        ("tachycardia", "heart_rate", "Severe progressive tachycardic crisis (HR > 130 bpm)"),
        ("hypotension", "systolic_bp", "Decompensating hypotensive shock (SBP < 80 mmHg)"),
        ("compound", "compound", "Compound cardiac collapse (HR < 50 bpm & SBP < 80 mmHg)"),
    ]

    spacing = total_minutes // 21
    for i in range(20):
        start_m = spacing * (i + 1) + rng.randint(-300, 300)
        duration = rng.randint(25, 40)
        end_m = start_m + duration
        arch_type, prim_sig, desc = archetypes[i % len(archetypes)]

        event = GroundTruthEvent(
            event_id=f"det_{i+1:02d}",
            event_type="deterioration",
            is_true_event=True,
            primary_signal=prim_sig,
            start_minute=start_m,
            onset_breach_minute=start_m + 3,  # ramps into breach around minute 3
            end_minute=end_m,
            description=f"{desc} (duration {duration}m)",
        )
        deterioration_events.append(event)
        deterioration_intervals.append((start_m, end_m))

    def in_deterioration(m: int) -> bool:
        return any(start <= m <= end for start, end in deterioration_intervals)

    # 2. Plan 10 Sensor Dropouts (2-5 minutes each, outside deteriorations)
    dropout_events: List[GroundTruthEvent] = []
    dropout_intervals: List[Tuple[int, int]] = []
    d_spacing = total_minutes // 11
    for i in range(10):
        # find slot not in deterioration
        for _ in range(100):
            d_start = d_spacing * (i + 1) + rng.randint(-400, 400)
            d_len = rng.randint(2, 5)
            d_end = d_start + d_len
            if not any(in_deterioration(m) for m in range(d_start - 10, d_end + 10)):
                break
        event = GroundTruthEvent(
            event_id=f"drop_{i+1:02d}",
            event_type="dropout",
            is_true_event=False,
            primary_signal="all",
            start_minute=d_start,
            onset_breach_minute=d_start,
            end_minute=d_end,
            description=f"Sensor loss/disconnection artifact (duration {d_len}m)",
        )
        dropout_events.append(event)
        dropout_intervals.append((d_start, d_end))

    def in_dropout(m: int) -> Optional[str]:
        for ev in dropout_events:
            if ev.start_minute <= m <= ev.end_minute:
                return ev.event_id
        return None

    # 3. Plan 200 Transient Spikes (isolated 1-reading sensor/motion artifacts)
    spike_events: List[GroundTruthEvent] = []
    spike_minutes = set()
    spike_signal_types = [
        ("spo2", "Transient motion artifact: pulse oximeter optical sensor slip"),
        ("heart_rate", "Transient EMG artifact / isolated premature contraction"),
        ("systolic_bp", "Transient movement pressure artifact on NIBP cuff"),
        ("diastolic_bp", "Transient diastolic cuff fluctuation artifact"),
        ("bradycardia", "Transient sensor miscount / bradycardia artifact"),
    ]

    while len(spike_minutes) < 200:
        candidate_m = rng.randint(10, total_minutes - 10)
        if candidate_m in spike_minutes:
            continue
        if in_deterioration(candidate_m) or in_dropout(candidate_m):
            continue
        # Also ensure neighbor not a spike (isolated)
        if (candidate_m - 1 in spike_minutes) or (candidate_m + 1 in spike_minutes):
            continue
        spike_minutes.add(candidate_m)

    sorted_spikes = sorted(list(spike_minutes))
    spike_map: Dict[int, GroundTruthEvent] = {}

    for idx, sm in enumerate(sorted_spikes):
        sig_type, desc = spike_signal_types[idx % len(spike_signal_types)]
        # 175 spikes last 1 min, 20 spikes last 2 min, 5 spikes last 3 min
        if idx < 175:
            spk_len = 1
        elif idx < 195:
            spk_len = 2
        else:
            spk_len = 3
        
        event = GroundTruthEvent(
            event_id=f"spk_{idx+1:03d}",
            event_type="spike",
            is_true_event=False,
            primary_signal=sig_type,
            start_minute=sm,
            onset_breach_minute=sm,
            end_minute=sm + spk_len - 1,
            description=f"{desc} (duration {spk_len}m)",
        )
        spike_events.append(event)
        for offset in range(spk_len):
            spike_map[sm + offset] = event

    # 4. Generate Continuous Readings across all 60,000 minutes
    readings: List[VitalsReading] = []

    # Baseline physiological states (mean reversion AR(1))
    hr = 74.0
    spo2 = 98.2
    sbp = 121.0
    dbp = 77.0

    all_events = deterioration_events + dropout_events + spike_events

    for m in range(total_minutes):
        timestamp = (base_time + timedelta(minutes=m)).isoformat().replace("+00:00", "Z")

        # Normal smooth autoregressive drift
        hr = 0.96 * hr + 0.04 * 74.0 + rng.gauss(0, 0.9)
        hr = max(62.0, min(92.0, hr))

        spo2 = 0.96 * spo2 + 0.04 * 98.2 + rng.gauss(0, 0.25)
        spo2 = max(96.0, min(99.8, spo2))

        sbp = 0.96 * sbp + 0.04 * 121.0 + rng.gauss(0, 1.2)
        sbp = max(110.0, min(134.0, sbp))

        dbp = 0.96 * dbp + 0.04 * 77.0 + rng.gauss(0, 0.9)
        dbp = max(68.0, min(86.0, dbp))

        cur_hr = hr
        cur_spo2 = spo2
        cur_sbp = sbp
        cur_dbp = dbp

        is_artifact = False
        is_true_deterioration = False
        is_drop = False
        active_event_id: Optional[str] = None

        # Check if in dropout
        drop_id = in_dropout(m)
        if drop_id:
            is_drop = True
            is_artifact = True
            active_event_id = drop_id
            # Sensor disconnect yields 0 readings
            cur_hr = 0.0
            cur_spo2 = 0.0
            cur_sbp = 0.0
            cur_dbp = 0.0
        elif m in spike_map:
            # Inject isolated 1-minute transient spike
            is_artifact = True
            ev = spike_map[m]
            active_event_id = ev.event_id
            if ev.primary_signal == "spo2":
                cur_spo2 = rng.uniform(84.0, 91.0)
            elif ev.primary_signal == "heart_rate":
                cur_hr = rng.uniform(128.0, 146.0)
            elif ev.primary_signal == "systolic_bp":
                cur_sbp = rng.uniform(166.0, 178.0)
            elif ev.primary_signal == "diastolic_bp":
                cur_dbp = rng.uniform(104.0, 114.0)
            elif ev.primary_signal == "bradycardia":
                cur_hr = rng.uniform(42.0, 47.0)
        else:
            # Check if in deterioration
            for det in deterioration_events:
                if det.start_minute <= m <= det.end_minute:
                    is_true_deterioration = True
                    active_event_id = det.event_id
                    progress = min(1.0, (m - det.start_minute) / 6.0)  # ramps over 6 minutes

                    if det.primary_signal == "spo2":
                        # Hypoxia: SpO2 drifts from 98% down to 85-88%
                        target_spo2 = rng.uniform(85.0, 88.5)
                        cur_spo2 = (1 - progress) * spo2 + progress * target_spo2
                    elif det.primary_signal in ("tachycardia", "heart_rate"):
                        # Tachycardia: HR drifts from 75 up to 138-152 bpm
                        target_hr = rng.uniform(138.0, 152.0)
                        cur_hr = (1 - progress) * hr + progress * target_hr
                    elif det.primary_signal in ("hypotension", "systolic_bp"):
                        # Hypotension: SBP drifts down to 72-78 mmHg, DBP to 40-44 mmHg
                        target_sbp = rng.uniform(72.0, 78.0)
                        target_dbp = rng.uniform(40.0, 44.0)
                        cur_sbp = (1 - progress) * sbp + progress * target_sbp
                        cur_dbp = (1 - progress) * dbp + progress * target_dbp
                    elif det.primary_signal == "compound":
                        # Compound: HR < 50 bpm and SBP < 80 mmHg
                        target_hr = rng.uniform(43.0, 48.0)
                        target_sbp = rng.uniform(71.0, 76.0)
                        target_dbp = rng.uniform(40.0, 43.0)
                        cur_hr = (1 - progress) * hr + progress * target_hr
                        cur_sbp = (1 - progress) * sbp + progress * target_sbp
                        cur_dbp = (1 - progress) * dbp + progress * target_dbp
                    break

        readings.append(
            VitalsReading(
                minute=m,
                timestamp=timestamp,
                patient_id=patient_id,
                heart_rate=round(cur_hr, 1),
                spo2=round(cur_spo2, 1),
                systolic_bp=round(cur_sbp, 1),
                diastolic_bp=round(cur_dbp, 1),
                is_artifact=is_artifact,
                is_true_deterioration=is_true_deterioration,
                is_dropout=is_drop,
                event_id=active_event_id,
            )
        )

    return readings, all_events


if __name__ == "__main__":
    readings, events = generate_1000_hours_vitals()
    print(f"Generated {len(readings)} readings ({len(readings)/60:.1f} hours).")
    spikes = [e for e in events if e.event_type == "spike"]
    deteriorations = [e for e in events if e.event_type == "deterioration"]
    dropouts = [e for e in events if e.event_type == "dropout"]
    print(f"Events: {len(spikes)} spikes, {len(deteriorations)} deteriorations, {len(dropouts)} dropouts.")
