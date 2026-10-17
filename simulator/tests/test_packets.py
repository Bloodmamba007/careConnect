from simulator.packets import generate_vitals


REQUIRED = {
    "patient_id",
    "timestamp",
    "heart_rate",
    "spo2",
    "systolic_bp",
    "diastolic_bp",
}


def test_generate_vitals_matches_contract():
    packet = generate_vitals("pt_001")
    assert set(packet.keys()) == REQUIRED
    assert packet["patient_id"] == "pt_001"
    assert "T" in packet["timestamp"]
    assert isinstance(packet["heart_rate"], float)
    assert isinstance(packet["spo2"], float)
    assert isinstance(packet["systolic_bp"], float)
    assert isinstance(packet["diastolic_bp"], float)
