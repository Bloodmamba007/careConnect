"""
CareConnect Prescription Quality Checker
Checks for:
1. Blur detection using Variance of the Laplacian.
2. Low resolution check (minimum width & height).
3. Low brightness / too dark check (mean grayscale pixel intensity).

If poor quality is detected, returns passed=False with plain-language tips.
"""

from dataclasses import dataclass
from typing import List
import cv2
import numpy as np


@dataclass
class QualityCheckResult:
    passed: bool
    blur_score: float
    brightness: float
    width: int
    height: int
    tip: str
    reasons: List[str]


# Thresholds:
# Variance of Laplacian < 60 is typically blurry/out-of-focus for documents
LAPLACIAN_BLUR_THRESHOLD = 60.0
# Minimum dimensions for readable prescription document
MIN_WIDTH = 300
MIN_HEIGHT = 300
# Mean intensity < 40 is considered underexposed / too dark to reliably read
MIN_BRIGHTNESS = 40.0


def check_image_quality(
    image: np.ndarray,
    blur_threshold: float = LAPLACIAN_BLUR_THRESHOLD,
    min_width: int = MIN_WIDTH,
    min_height: int = MIN_HEIGHT,
    min_brightness: float = MIN_BRIGHTNESS,
) -> QualityCheckResult:
    """
    Evaluates image quality prior to OCR:
    - Calculates variance of Laplacian on grayscale image to detect blur.
    - Measures resolution (width, height).
    - Measures average grayscale brightness.
    """
    if image is None or image.size == 0:
        return QualityCheckResult(
            passed=False,
            blur_score=0.0,
            brightness=0.0,
            width=0,
            height=0,
            tip="Hold the phone steady and use good light",
            reasons=["Image is empty or could not be decoded."],
        )

    # Convert to grayscale if 3-channel
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    height, width = gray.shape[:2]
    brightness = float(np.mean(gray))

    # Variance of Laplacian for blur detection
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    blur_score = float(laplacian.var())

    reasons: List[str] = []

    if blur_score < blur_threshold:
        reasons.append(f"Image is blurry (Laplacian variance {blur_score:.1f} < {blur_threshold:.1f}).")

    if width < min_width or height < min_height:
        reasons.append(f"Image resolution too low ({width}x{height} < {min_width}x{min_height}).")

    if brightness < min_brightness:
        reasons.append(f"Image is too dark (average brightness {brightness:.1f} < {min_brightness:.1f}).")

    passed = len(reasons) == 0
    tip = ""
    if not passed:
        tip = "Hold the phone steady and use good light"

    return QualityCheckResult(
        passed=passed,
        blur_score=blur_score,
        brightness=brightness,
        width=width,
        height=height,
        tip=tip,
        reasons=reasons,
    )
