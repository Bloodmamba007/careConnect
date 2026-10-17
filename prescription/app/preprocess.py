import cv2
import numpy as np
from dataclasses import dataclass
from typing import Tuple


@dataclass
class PreprocessResult:
    deskewed: np.ndarray
    filtered: np.ndarray
    thresholded: np.ndarray
    skew_angle: float


def compute_skew_angle(image: np.ndarray) -> float:
    """Computes the skew angle of the text in an image in degrees."""
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Invert image: text becomes white on black background
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]

    # Find coordinates of all white pixels
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 10:
        return 0.0

    # cv2.minAreaRect returns ((center_x, center_y), (width, height), angle)
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]

    # Normalize angle from minAreaRect conventions
    if angle < -45:
        angle = -(90 + angle)
    elif angle > 45:
        angle = 90 - angle
    else:
        angle = -angle

    # Guard against extreme rotations on non-skewed rectangular pages
    if abs(angle) > 45:
        return 0.0

    return float(angle)


def deskew(image: np.ndarray) -> Tuple[np.ndarray, float]:
    """Deskews the image by computing skew angle and rotating."""
    angle = compute_skew_angle(image)
    if abs(angle) < 0.1:
        return image.copy(), 0.0

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        m,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255) if len(image.shape) == 3 else 255,
    )
    return rotated, angle


def apply_bilateral_filter(
    image: np.ndarray,
    d: int = 9,
    sigma_color: float = 75.0,
    sigma_space: float = 75.0,
) -> np.ndarray:
    """Applies bilateral filtering to smooth textures while preserving sharp text edges."""
    return cv2.bilateralFilter(image, d, sigma_color, sigma_space)


def apply_adaptive_threshold(
    image: np.ndarray,
    block_size: int = 15,
    c: int = 5,
) -> np.ndarray:
    """Applies Gaussian adaptive thresholding to produce high-contrast binary text."""
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Ensure block_size is odd and >= 3
    if block_size % 2 == 0:
        block_size += 1
    if block_size < 3:
        block_size = 3

    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        c,
    )


def preprocess_prescription(image: np.ndarray) -> PreprocessResult:
    """
    Executes full preprocessing pipeline:
    1. Deskew
    2. Bilateral filtering
    3. Adaptive thresholding
    """
    deskewed, skew_angle = deskew(image)
    filtered = apply_bilateral_filter(deskewed)
    thresholded = apply_adaptive_threshold(filtered)

    return PreprocessResult(
        deskewed=deskewed,
        filtered=filtered,
        thresholded=thresholded,
        skew_angle=skew_angle,
    )
