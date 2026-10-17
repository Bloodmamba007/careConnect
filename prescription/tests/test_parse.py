from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_parse_returns_medication_contract():
    response = client.post(
        "/parse",
        json={"patient_id": "pt_001", "text": "Lipitor 20 mg tablet once daily in the evening for 90 days"},
    )
    assert response.status_code == 200
    meds = response.json()
    assert len(meds) == 1
    keys = set(meds[0].keys())
    assert keys == {
        "drug_name",
        "generic_name",
        "form",
        "strength",
        "frequency",
        "timing",
        "duration_days",
        "confidence",
        "rxnorm_id",
    }
