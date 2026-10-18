"""
CareConnect Document Loader
Handles ingestion and conversion of prescription documents:
- JPG, PNG (direct cv2 / PIL)
- HEIC (converted to JPG via pillow_heif)
- PDF (rendered to images via pdf2image or pypdfium2, max 5 pages)
"""

import io
import logging
from typing import List
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("careconnect.prescription.document_loader")

# Try importing pillow_heif for HEIC support
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIF_AVAILABLE = True
except Exception:
    HEIF_AVAILABLE = False

# Try importing pdf2image and pypdfium2
try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
except Exception:
    PDF2IMAGE_AVAILABLE = False

try:
    import pypdfium2 as pdfium
    PYPDFIUM2_AVAILABLE = True
except Exception:
    PYPDFIUM2_AVAILABLE = False

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "application/pdf",
}

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".heic",
    ".heif",
    ".pdf",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_PDF_PAGES = 5


def pil_to_cv2(pil_img: Image.Image) -> np.ndarray:
    """Converts a PIL Image (RGB/L) to an OpenCV BGR numpy ndarray."""
    rgb_img = pil_img.convert("RGB")
    arr = np.array(rgb_img)
    # Convert RGB to BGR for OpenCV standard
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def load_pdf_pages_to_images(file_bytes: bytes, max_pages: int = MAX_PDF_PAGES) -> List[np.ndarray]:
    """
    Renders up to max_pages pages from a PDF to OpenCV BGR images.
    Tries pdf2image first; falls back to pypdfium2.
    """
    images: List[np.ndarray] = []

    # 1. Try pdf2image
    if PDF2IMAGE_AVAILABLE:
        try:
            pil_pages = convert_from_bytes(
                file_bytes,
                first_page=1,
                last_page=max_pages,
            )
            for page in pil_pages[:max_pages]:
                images.append(pil_to_cv2(page))
            if images:
                return images
        except Exception as e:
            logger.warning(f"pdf2image conversion failed (poppler might be missing): {e}. Attempting pypdfium2 fallback.")

    # 2. Fallback to pypdfium2
    if PYPDFIUM2_AVAILABLE:
        try:
            pdf = pdfium.PdfDocument(file_bytes)
            num_pages = min(len(pdf), max_pages)
            for i in range(num_pages):
                page = pdf[i]
                pil_page = page.render(scale=2.0).to_pil()
                images.append(pil_to_cv2(pil_page))
            if images:
                return images
        except Exception as e:
            logger.error(f"pypdfium2 conversion failed: {e}")

    if not images:
        raise ValueError("Could not render PDF pages to images. Ensure a valid PDF document was uploaded.")
    return images


def load_document_to_images(file_bytes: bytes, filename: str = "", mime_type: str = "") -> List[np.ndarray]:
    """
    Loads raw file bytes into a list of OpenCV BGR images.
    Handles JPG, PNG, HEIC, and PDF.
    """
    fn_lower = filename.lower()
    is_pdf = mime_type == "application/pdf" or fn_lower.endswith(".pdf") or file_bytes[:4] == b"%PDF"

    if is_pdf:
        return load_pdf_pages_to_images(file_bytes, max_pages=MAX_PDF_PAGES)

    is_heic = (
        mime_type in ["image/heic", "image/heif"]
        or fn_lower.endswith(".heic")
        or fn_lower.endswith(".heif")
        or (len(file_bytes) > 12 and file_bytes[4:8] == b"ftyp" and file_bytes[8:12] in [b"heic", b"mif1", b"msf1", b"heix"])
    )

    if is_heic:
        try:
            pil_img = Image.open(io.BytesIO(file_bytes))
            cv2_img = pil_to_cv2(pil_img)
            return [cv2_img]
        except Exception as e:
            raise ValueError(f"Failed to process HEIC/HEIF image: {e}")

    # Standard JPG / PNG / image
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        return [img]

    # Fallback to PIL Image.open in case OpenCV imdecode had format issues
    try:
        pil_img = Image.open(io.BytesIO(file_bytes))
        cv2_img = pil_to_cv2(pil_img)
        return [cv2_img]
    except Exception:
        raise ValueError("Unable to decode uploaded file as a supported image or PDF.")
