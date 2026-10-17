import numpy as np
import cv2
from app.layout import (
    BoundingBox,
    LayoutZones,
    segment_layout,
    crop_rx_body,
    crop_text_lines,
)


def create_mock_prescription_image() -> np.ndarray:
    """Creates a synthetic prescription image with distinct zones and lines."""
    img = np.full((600, 500, 3), 255, dtype=np.uint8)

    # 1. Header (y: 0 to 100)
    cv2.putText(img, "CITY GENERAL HOSPITAL", (100, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
    cv2.line(img, (20, 105), (480, 105), (0, 0, 0), 2)

    # 2. Patient info (y: 110 to 180)
    # Notice: anonymous test values, no real names
    cv2.putText(img, "Patient ID: pt_101  Age: 52  Date: 2026-10-18", (40, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    cv2.line(img, (20, 185), (480, 185), (0, 0, 0), 2)

    # 3. Rx Body (y: 200 to 480)
    cv2.putText(img, "Rx:", (30, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    # Line 1
    cv2.putText(img, "1. Tab Lipitor 20mg OD pc x 30 days", (60, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    # Line 2
    cv2.putText(img, "2. Cap Augmentin 625mg TDS pc x 7 days", (60, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    # Line 3
    cv2.putText(img, "3. Tab Metformin 500mg 1-0-1 pc", (60, 380), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    cv2.line(img, (20, 490), (480, 490), (0, 0, 0), 2)

    # 4. Footer (y: 500 to 600)
    cv2.putText(img, "Dr. Signature: ___________ Lic: 987654", (60, 540), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    return img


def test_segment_layout():
    img = create_mock_prescription_image()
    layout = segment_layout(img)

    assert isinstance(layout, LayoutZones)
    assert layout.header.y == 0
    assert layout.header.height > 0
    assert layout.patient_info.y >= layout.header.y2
    assert layout.rx_body.y >= layout.patient_info.y2
    assert layout.footer.y >= layout.rx_body.y2
    assert layout.footer.y2 == img.shape[0]


def test_crop_rx_body():
    img = create_mock_prescription_image()
    layout = segment_layout(img)
    rx_cropped = crop_rx_body(img, layout)

    assert rx_cropped.shape[0] == layout.rx_body.height
    assert rx_cropped.shape[1] == layout.rx_body.width
    assert rx_cropped.shape[0] > 100


def test_crop_text_lines():
    img = create_mock_prescription_image()
    layout = segment_layout(img)
    rx_cropped = crop_rx_body(img, layout)
    lines = crop_text_lines(rx_cropped)

    assert len(lines) >= 3, f"Expected at least 3 lines, got {len(lines)}"
    for line in lines:
        assert line.image.shape[0] > 5
        assert line.bbox.width == rx_cropped.shape[1]
        assert line.bbox.height == line.image.shape[0]
