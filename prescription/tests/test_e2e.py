import os
import io
import pytest
from fastapi.testclient import TestClient

from app.main import app, review_store
from app.ocr import set_custom_ocr_engines

client = TestClient(app)

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "../samples")


@pytest.fixture(autouse=True)
def clean_review_store():
    review_store.clear()
    yield
    review_store.clear()


def test_e2e_printed_sample_image():
    printed_path = os.path.join(SAMPLES_DIR, "printed.png")
    assert os.path.exists(printed_path), "Sample printed.png must exist"

    # Mock OCR output for sample printed image to simulate PaddleOCR recognition
    set_custom_ocr_engines(
        printed_fn=lambda img: ("Tab Lipitor 20mg OD pc for 30 days\nTab Metformin 500mg BD pc for 60 days", 0.95),
        handwritten_fn=None,
    )

    try:
        with open(printed_path, "rb") as f:
            response = client.post(
                "/prescriptions/parse",
                files={"file": ("printed.png", f, "image/png")},
                data={"patient_id": "pt_printed_test"},
            )

        assert response.status_code == 201
        data = response.json()

        assert "prescription_id" in data
        assert data["overall_confidence"] >= 0.85
        assert data["status"] == "auto_approved"
        assert len(data["medications"]) >= 1
        assert data["cropped_image_base64"].startswith("data:image/")

        # Verify medication contents
        med = data["medications"][0]
        assert med["generic_name"] == "atorvastatin"
        assert med["rxnorm_id"] != ""
        assert med["frequency"] == "once daily"
    finally:
        set_custom_ocr_engines(None, None)


def test_e2e_neat_handwriting_sample_image():
    neat_path = os.path.join(SAMPLES_DIR, "neat_handwriting.png")
    assert os.path.exists(neat_path), "Sample neat_handwriting.png must exist"

    # Simulate neat TrOCR handwritten recognition
    set_custom_ocr_engines(
        printed_fn=None,
        handwritten_fn=lambda img: ("Tab Glucophage 500mg 1-0-1 pc x 60d\nCap Augmentin 625mg TDS pc x 7 days", 0.88),
    )

    try:
        with open(neat_path, "rb") as f:
            response = client.post(
                "/prescriptions/parse",
                files={"file": ("neat_handwriting.png", f, "image/png")},
                data={"patient_id": "pt_neat_test"},
            )

        assert response.status_code == 201
        data = response.json()

        assert "prescription_id" in data
        assert len(data["medications"]) >= 2
        # Glucophage should map to metformin
        generic_names = [m["generic_name"] for m in data["medications"]]
        assert "metformin" in generic_names

        # 1-0-1 decoded to twice daily
        metformin_med = next(m for m in data["medications"] if m["generic_name"] == "metformin")
        assert metformin_med["frequency"] == "twice daily"
        assert "morning and night" in metformin_med["timing"]
    finally:
        set_custom_ocr_engines(None, None)


def test_e2e_messy_sample_image_and_pharmacist_approval():
    messy_path = os.path.join(SAMPLES_DIR, "messy.png")
    assert os.path.exists(messy_path), "Sample messy.png must exist"

    # Messy text has low confidence OCR or uncertain markers
    set_custom_ocr_engines(
        printed_fn=None,
        handwritten_fn=lambda img: ("Cap Augmentin 625mg TDS SOS\nTab Zestril ??? dose illegible", 0.65),
    )

    try:
        with open(messy_path, "rb") as f:
            response = client.post(
                "/prescriptions/parse",
                files={"file": ("messy.png", f, "image/png")},
                data={"patient_id": "pt_messy_test"},
            )

        assert response.status_code == 201
        data = response.json()
        prescription_id = data["prescription_id"]

        # Because confidence was 0.65 (<0.85), status must be "needs_review"
        assert data["status"] == "needs_review"
        assert data["overall_confidence"] < 0.85
        assert len(data["gate_reasons"]) > 0

        # Step 2: Check GET /prescriptions/review-queue
        rq_resp = client.get("/prescriptions/review-queue")
        assert rq_resp.status_code == 200
        queue = rq_resp.json()
        assert any(item["id"] == prescription_id for item in queue)

        pending_item = next(item for item in queue if item["id"] == prescription_id)
        assert pending_item["cropped_image"].startswith("data:image/")
        assert len(pending_item["parsed_draft"]) >= 1

        # Step 3: Pharmacist 1-Tap Approval via POST /prescriptions/:id/approve
        approve_resp = client.post(
            f"/prescriptions/{prescription_id}/approve",
            json={
                "approved_by": "Pharmacist Jane",
                "notes": "Verified illegible line with doctor over phone.",
            },
        )
        assert approve_resp.status_code == 200
        approved_data = approve_resp.json()

        assert approved_data["id"] == prescription_id
        assert approved_data["status"] == "approved"
        assert approved_data["approved_by"] == "Pharmacist Jane"
        assert "approved_at" in approved_data
        assert approved_data["cropped_image"].startswith("data:image/")
        assert len(approved_data["parsed_draft"]) >= 1

        # Step 4: Verify it is no longer in the pending review-queue
        rq_after = client.get("/prescriptions/review-queue")
        assert not any(item["id"] == prescription_id for item in rq_after.json())
    finally:
        set_custom_ocr_engines(None, None)
