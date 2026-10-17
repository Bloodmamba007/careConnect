"""
CareConnect Prescription Image Retention & Encryption Storage
Implements:
1. Zero Retention Mode ("delete" - default): Raw image bytes and temporary uploads
   are purged immediately following layout parsing and text line extraction.
2. Encrypted Archive Mode ("encrypt"): Raw images required for compliance or clinical auditing
   are encrypted at rest using AES-256-GCM before writing to storage.
"""

import hashlib
import os
from pathlib import Path
from typing import Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

STORAGE_DIR = Path(os.getenv("PRESCRIPTION_STORAGE_DIR", Path(__file__).resolve().parent.parent / "storage" / "encrypted"))

def _get_encryption_key() -> bytes:
    raw_key = os.getenv("PRESCRIPTION_ENCRYPTION_KEY", "careconnect-prescription-key-32b-secure")
    return hashlib.sha256(raw_key.encode("utf-8")).digest()


def get_retention_mode() -> str:
    """Returns the active retention mode: 'delete' or 'encrypt'."""
    raw = os.getenv("PRESCRIPTION_IMAGE_RETENTION", "delete").lower().strip()
    return "encrypt" if raw == "encrypt" else "delete"


def handle_image_retention(prescription_id: str, image_bytes: bytes) -> Tuple[str, Optional[str]]:
    """
    Applies the configured retention policy to raw prescription image bytes.
    
    Returns:
        Tuple of (retention_mode_applied, stored_file_path_or_none)
    """
    mode = get_retention_mode()

    if mode == "delete":
        # Zero Retention: Discard raw image bytes, do not write to persistent storage.
        # Only the cropped medication region is held in memory for pharmacist verification.
        return "delete", None

    # Encrypted Archive Mode: AES-256-GCM at rest
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    out_path = STORAGE_DIR / f"{prescription_id}.enc"

    aesgcm = AESGCM(_get_encryption_key())
    nonce = os.urandom(12)  # 96-bit nonce
    # Encrypt raw image bytes
    ciphertext = aesgcm.encrypt(nonce, image_bytes, prescription_id.encode("utf-8"))

    # Write nonce + ciphertext to file
    with open(out_path, "wb") as f:
        f.write(nonce + ciphertext)

    return "encrypt", str(out_path)


def decrypt_prescription_image(prescription_id: str) -> Optional[bytes]:
    """
    Decrypts an archived prescription image for authorized pharmacist review.
    Returns decrypted image bytes or None if not found or corrupted.
    """
    target = STORAGE_DIR / f"{prescription_id}.enc"
    if not target.exists():
        return None

    try:
        with open(target, "rb") as f:
            data = f.read()

        nonce = data[:12]
        ciphertext = data[12:]
        aesgcm = AESGCM(_get_encryption_key())
        decrypted = aesgcm.decrypt(nonce, ciphertext, prescription_id.encode("utf-8"))
        return decrypted
    except Exception:
        return None
