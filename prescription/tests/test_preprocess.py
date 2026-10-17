import numpy as np
import cv2
from app.preprocess import (
    deskew,
    compute_skew_angle,
    apply_bilateral_filter,
    apply_adaptive_threshold,
    preprocess_prescription,
)


def create_test_image_with_angle(angle_deg: float = 0.0) -> np.ndarray:
    """Helper to generate a synthetic document image with text-like stripes at an angle."""
    img = np.full((300, 400, 3), 255, dtype=np.uint8)
    # Draw horizontal text lines
    for y in range(60, 240, 30):
        cv2.line(img, (50, y), (350, y), (0, 0, 0), 4)
        cv2.putText(
            img,
            "Rx Med 100mg Once Daily",
            (60, y - 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 0),
            1,
        )

    if abs(angle_deg) > 0.1:
        center = (200, 150)
        m = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
        img = cv2.warpAffine(img, m, (400, 300), borderValue=(255, 255, 255))
    return img


def test_bilateral_filter():
    img = create_test_image_with_angle(0.0)
    filtered = apply_bilateral_filter(img)
    assert filtered.shape == img.shape
    assert filtered.dtype == np.uint8


def test_adaptive_threshold():
    img = create_test_image_with_angle(0.0)
    thresh = apply_adaptive_threshold(img)
    assert len(thresh.shape) == 2
    assert set(np.unique(thresh)).issubset({0, 255})


def test_deskew_straight_image():
    img = create_test_image_with_angle(0.0)
    deskewed_img, angle = deskew(img)
    assert abs(angle) < 1.0
    assert deskewed_img.shape == img.shape


def test_deskew_rotated_image():
    # Rotated by 5 degrees
    rotated = create_test_image_with_angle(5.0)
    deskewed_img, angle = deskew(rotated)
    # Deskew should detect angle close to 5 degrees
    assert abs(angle) > 1.0
    assert deskewed_img.shape == rotated.shape


def test_full_preprocess_pipeline():
    img = create_test_image_with_angle(3.0)
    res = preprocess_prescription(img)
    assert res.deskewed.shape == img.shape
    assert res.filtered.shape == img.shape
    assert len(res.thresholded.shape) == 2
    assert isinstance(res.skew_angle, float)
