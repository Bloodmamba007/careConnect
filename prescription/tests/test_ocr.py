import numpy as np
import cv2
from app.layout import BoundingBox, TextLine
from app.ocr import (
    is_line_handwritten,
    perform_ocr_on_lines,
    set_custom_ocr_engines,
    DocumentOcrResult,
    LineOcrResult,
)


def create_printed_line_image() -> np.ndarray:
    img = np.full((40, 300, 3), 255, dtype=np.uint8)
    cv2.putText(
        img,
        "Tab Lipitor 20mg OD pc",
        (10, 25),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0, 0, 0),
        2,
        cv2.LINE_AA,
    )
    return img


def create_handwritten_line_image() -> np.ndarray:
    img = np.full((40, 300, 3), 255, dtype=np.uint8)
    # Simulate irregular handwritten script with bezier-like curves
    pts = np.array(
        [[10, 20], [25, 32], [40, 15], [55, 30], [70, 18], [90, 35], [110, 20]],
        np.int32,
    )
    cv2.polylines(img, [pts], False, (0, 0, 0), 2)
    return img


def test_handwritten_classifier():
    printed = create_printed_line_image()
    # Classifier returns bool
    res_printed = is_line_handwritten(printed)
    assert isinstance(res_printed, (bool, np.bool_))


def test_perform_ocr_with_mock_engines():
    # Inject mocked OCR models for deterministic testing
    mock_printed = lambda img: ("Tab Lipitor 20mg OD pc", 0.96)
    mock_hw = lambda img: ("Cap Augmentin 625mg TDS", 0.88)

    set_custom_ocr_engines(mock_printed, mock_hw)

    try:
        line1 = TextLine(0, BoundingBox(0, 0, 300, 40), create_printed_line_image())
        line2 = TextLine(1, BoundingBox(0, 45, 300, 40), create_handwritten_line_image())

        doc_ocr = perform_ocr_on_lines([line1, line2])

        assert isinstance(doc_ocr, DocumentOcrResult)
        assert len(doc_ocr.lines) == 2
        assert "Lipitor" in doc_ocr.full_text or "Augmentin" in doc_ocr.full_text
        assert 0.80 <= doc_ocr.overall_confidence <= 1.0

        for line_res in doc_ocr.lines:
            assert isinstance(line_res, LineOcrResult)
            assert line_res.confidence >= 0.0
            assert line_res.text != ""
    finally:
        set_custom_ocr_engines(None, None)
