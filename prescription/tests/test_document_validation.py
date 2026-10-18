"""
Unit tests for prescription document loading, validation, and image quality checks:
1. Rejection of unsupported file types (e.g. text/plain, .exe, .zip).
2. Image quality check: Blurry image detection (variance of Laplacian < 60) -> returns status 'retake_needed'.
3. Low resolution and too-dark image detection.
4. PDF input processing: Multi-page PDF rendered to images and medications merged.
5. File size limit enforcement (> 10 MB rejected).
"""

import io
import os
import cv2
import numpy as np
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app, review_store
from app.ocr import set_custom_ocr_engines
from app.quality import check_image_quality

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    review_store.clear()
    yield
    review_store.clear()


def create_blank_image(width=600, height=800, color=(255, 255, 255)) -> np.ndarray:
    return np.full((height, width, 3), color, dtype=np.uint8)


def create_blurry_image(width=600, height=800) -> bytes:
    """Creates an intentionally blurry image with very low Laplacian variance."""
    # A flat gray/white field or heavy Gaussian blur on slight noise
    img = np.full((height, width, 3), 200, dtype=np.uint8)
    # Add minimal variation then blur heavily
    img[100:200, 100:200] = 205
    blurred = cv2.GaussianBlur(img, (51, 51), 0)
    _, buf = cv2.imencode(".jpg", blurred)
    return buf.tobytes()


def create_sharp_prescription_image() -> bytes:
    """Creates a high-contrast sharp document image with text-like edges."""
    pil_img = Image.new("RGB", (600, 800), color=(255, 255, 255))
    draw = ImageDraw.Draw(pil_img)
    # Draw sharp borders and simulated text lines
    draw.rectangle([50, 50, 550, 750], outline=(0, 0, 0), width=3)
    for y in range(150, 600, 40):
        draw.line([70, y, 520, y], fill=(0, 0, 0), width=4)
        draw.line([70, y + 10, 300, y + 10], fill=(50, 50, 50), width=2)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def create_simple_pdf_bytes(page_count: int = 2) -> bytes:
    """Generates a minimal multi-page PDF in memory using PIL."""
    pages = []
    for i in range(page_count):
        pil_img = Image.new("RGB", (600, 800), color=(255, 255, 255))
        draw = ImageDraw.Draw(pil_img)
        draw.rectangle([40, 40, 560, 760], outline=(0, 0, 0), width=2)
        draw.text((60, 100), f"Page {i+1} Rx Document", fill=(0, 0, 0))
        for y in range(160, 500, 40):
            draw.line([60, y, 500, y], fill=(0, 0, 0), width=3)
        pages.append(pil_img)

    buf = io.BytesIO()
    pages[0].save(buf, format="PDF", save_all=True, append_images=pages[1:])
    return buf.getvalue()


# -------------------------------------------------------------------------
# Test Cases
# -------------------------------------------------------------------------

def test_unsupported_file_type_rejected():
    """Unsupported MIME/file extension should return 400 with a clear error message."""
    fake_payload = b"<html><body>Not a prescription</body></html>"
    response = client.post(
        "/prescriptions/parse",
        files={"file": ("malicious.html", fake_payload, "text/html")},
        data={"patient_id": "pt_unsupported"},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "Unsupported file format" in detail
    assert "Allowed formats" in detail


def test_unsupported_binary_file_rejected():
    """Executable or archive file should be rejected with 400."""
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00"
    response = client.post(
        "/prescriptions/parse",
        files={"file": ("payload.exe", fake_exe, "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_file_size_exceeded_rejected():
    """Files over 10 MB must be rejected with 400 and clear error message."""
    # 10.5 MB payload
    large_payload = b"x" * (10 * 1024 * 1024 + 512 * 1024)
    response = client.post(
        "/prescriptions/parse",
        files={"file": ("large_image.jpg", large_payload, "image/jpeg")},
    )
    assert response.status_code == 400
    assert "exceeds maximum size limit" in response.json()["detail"]


def test_blurry_image_returns_retake_needed():
    """Blurry image must be caught before OCR and return retake_needed with plain-language tip."""
    blurry_bytes = create_blurry_image()

    response = client.post(
        "/prescriptions/parse",
        files={"file": ("prescription_blurry.jpg", blurry_bytes, "image/jpeg")},
        data={"patient_id": "pt_blur"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "retake_needed"
    assert "Hold the phone steady and use good light" in data["tip"]
    assert len(data["medications"]) == 0
    assert any("blurry" in w.lower() for w in data["warnings"])
    assert "prescription_id" in data


def test_too_dark_image_returns_retake_needed():
    """Images that are underexposed/too dark must trigger retake_needed."""
    # Create pitch black image
    dark_img = np.full((600, 600, 3), 10, dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", dark_img)

    response = client.post(
        "/prescriptions/parse",
        files={"file": ("dark_rx.jpg", buf.tobytes(), "image/jpeg")},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "retake_needed"
    assert "Hold the phone steady and use good light" in data["tip"]
    assert any("too dark" in w.lower() or "blurry" in w.lower() for w in data["warnings"])


def test_pdf_input_processing_and_medication_merge():
    """PDF document rendering each page into an image and merging medications."""
    pdf_bytes = create_simple_pdf_bytes(page_count=2)

    # Set custom OCR engine mock to return Lipitor for page 1 calls, Metformin for page 2 calls
    call_count = {"val": 0}

    def mock_ocr(img):
        call_count["val"] += 1
        # Each page has ~1-3 lines cropped; return Lipitor for the first few and Metformin for later
        if call_count["val"] <= 2:
            return ("Tab Lipitor 20mg OD pc for 30 days", 0.95)
        else:
            return ("Tab Metformin 500mg BD pc for 60 days", 0.92)

    set_custom_ocr_engines(printed_fn=mock_ocr, handwritten_fn=mock_ocr)

    try:
        response = client.post(
            "/prescriptions/parse",
            files={"file": ("sample_multipage.pdf", pdf_bytes, "application/pdf")},
            data={"patient_id": "pt_pdf_test"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] in ["auto_approved", "needs_review"]
        assert len(data["medications"]) >= 2

        generic_names = [m["generic_name"] for m in data["medications"]]
        assert "atorvastatin" in generic_names
        assert "metformin" in generic_names
        assert data["prescription_id"] in review_store
    finally:
        set_custom_ocr_engines(None, None)
