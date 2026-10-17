from dataclasses import dataclass
from typing import List, Tuple
import cv2
import numpy as np


@dataclass
class BoundingBox:
    x: int
    y: int
    width: int
    height: int

    @property
    def x2(self) -> int:
        return self.x + self.width

    @property
    def y2(self) -> int:
        return self.y + self.height

    def to_tuple(self) -> Tuple[int, int, int, int]:
        return (self.x, self.y, self.width, self.height)


@dataclass
class LayoutZones:
    header: BoundingBox
    patient_info: BoundingBox
    rx_body: BoundingBox
    footer: BoundingBox


@dataclass
class TextLine:
    line_index: int
    bbox: BoundingBox
    image: np.ndarray


def segment_layout(image: np.ndarray) -> LayoutZones:
    """
    Segments the prescription into 4 vertical zones:
    1. Header (clinic/hospital details)
    2. Patient Info (patient demographics, date, vitals)
    3. Rx Body (medication prescriptions)
    4. Footer (doctor's signature, license, date)
    Uses horizontal projection profile and document geometry heuristics.
    """
    h, w = image.shape[:2]

    # Baseline proportional cuts
    # Header: top 18%
    # Patient Info: 18% to 32%
    # Rx Body: 32% to 82%
    # Footer: 82% to bottom
    y_header_end = int(h * 0.18)
    y_patient_end = int(h * 0.32)
    y_rx_end = int(h * 0.82)

    # Convert to grayscale for horizontal line detection (dividers)
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Detect horizontal lines using morphological operations
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 3
    )
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (int(w * 0.25), 1))
    horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel)

    # Find line contours
    contours, _ = cv2.findContours(horizontal_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    divider_ys = []
    for cnt in contours:
        x, y, line_w, line_h = cv2.boundingRect(cnt)
        if line_w > w * 0.3:
            divider_ys.append(y + line_h // 2)

    divider_ys.sort()

    # Refine boundaries if divider lines exist
    if len(divider_ys) >= 2:
        # First divider often separates header/patient info from Rx body
        first_div = [y for y in divider_ys if 0.15 * h < y < 0.40 * h]
        if first_div:
            y_patient_end = first_div[0]
        # Last divider often separates Rx body from footer
        last_div = [y for y in divider_ys if 0.70 * h < y < 0.90 * h]
        if last_div:
            y_rx_end = last_div[-1]

    header_box = BoundingBox(x=0, y=0, width=w, height=y_header_end)
    patient_box = BoundingBox(x=0, y=y_header_end, width=w, height=y_patient_end - y_header_end)
    rx_body_box = BoundingBox(x=0, y=y_patient_end, width=w, height=y_rx_end - y_patient_end)
    footer_box = BoundingBox(x=0, y=y_rx_end, width=w, height=h - y_rx_end)

    return LayoutZones(
        header=header_box,
        patient_info=patient_box,
        rx_body=rx_body_box,
        footer=footer_box,
    )


def crop_rx_body(image: np.ndarray, layout: LayoutZones) -> np.ndarray:
    """Crops the Rx body section from the image."""
    box = layout.rx_body
    return image[box.y : box.y2, box.x : box.x2].copy()


def crop_text_lines(rx_body_image: np.ndarray, min_line_height: int = 12) -> List[TextLine]:
    """
    Segments the Rx body region into horizontal text lines using projection profiles
    and morphological grouping.
    """
    if len(rx_body_image.shape) == 3:
        gray = cv2.cvtColor(rx_body_image, cv2.COLOR_BGR2GRAY)
    else:
        gray = rx_body_image.copy()

    h, w = gray.shape

    # Binary inverse: text is white (255), background is black (0)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 3
    )

    # Compute horizontal projection profile (sum of white pixels across each row)
    projection = np.sum(thresh, axis=1) / 255.0

    # Smooth the projection profile with a moving average
    kernel_size = 7
    kernel = np.ones(kernel_size) / kernel_size
    smoothed = np.convolve(projection, kernel, mode="same")

    # Threshold to identify active text rows (at least 1% of width contains ink)
    threshold_value = max(1.0, w * 0.01)
    is_text = smoothed > threshold_value

    lines_coords: List[Tuple[int, int]] = []
    in_line = False
    start_y = 0

    for y in range(h):
        if is_text[y] and not in_line:
            in_line = True
            start_y = max(0, y - 2)
        elif not is_text[y] and in_line:
            in_line = False
            end_y = min(h, y + 2)
            if (end_y - start_y) >= min_line_height:
                lines_coords.append((start_y, end_y))

    if in_line and (h - start_y) >= min_line_height:
        lines_coords.append((start_y, h))

    # If projection profile found no distinct lines (e.g. low contrast), fallback to connected components
    if not lines_coords:
        # Morphological dilation to connect words horizontally
        rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
        dilated = cv2.dilate(thresh, rect_kernel, iterations=1)
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        boxes = []
        for c in contours:
            bx, by, bw, bh = cv2.boundingRect(c)
            if bh >= min_line_height and bw > 30:
                boxes.append((by, by + bh))
        boxes.sort(key=lambda b: b[0])
        lines_coords = boxes

    # If still empty, return the entire body as a single line
    if not lines_coords:
        lines_coords = [(0, h)]

    # Merge overlapping or very close lines (< 5px gap)
    merged_coords: List[Tuple[int, int]] = []
    for cur_start, cur_end in lines_coords:
        if not merged_coords:
            merged_coords.append((cur_start, cur_end))
        else:
            prev_start, prev_end = merged_coords[-1]
            if cur_start <= prev_end + 6:
                merged_coords[-1] = (prev_start, max(prev_end, cur_end))
            else:
                merged_coords.append((cur_start, cur_end))

    text_lines: List[TextLine] = []
    for idx, (ly1, ly2) in enumerate(merged_coords):
        line_crop = rx_body_image[ly1:ly2, 0:w].copy()
        bbox = BoundingBox(x=0, y=ly1, width=w, height=ly2 - ly1)
        text_lines.append(TextLine(line_index=idx, bbox=bbox, image=line_crop))

    return text_lines
