import os
import pytest
from app.image_storage import (
    handle_image_retention,
    decrypt_prescription_image,
    get_retention_mode,
)


def test_delete_retention_mode(monkeypatch):
    """Test zero-retention mode does not persist raw image files."""
    monkeypatch.setenv("PRESCRIPTION_IMAGE_RETENTION", "delete")
    fake_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"

    mode, path = handle_image_retention("rx_test_del_01", fake_bytes)
    assert mode == "delete"
    assert path is None


def test_encrypt_retention_mode(monkeypatch, tmp_path):
    """Test encrypted archive mode encrypts image at rest and allows authenticated decryption."""
    monkeypatch.setenv("PRESCRIPTION_IMAGE_RETENTION", "encrypt")
    monkeypatch.setattr("app.image_storage.STORAGE_DIR", tmp_path)

    sample_bytes = b"MOCK_RAW_PRESCRIPTION_IMAGE_DATA_123456789"
    prescription_id = "rx_test_enc_02"

    mode, path = handle_image_retention(prescription_id, sample_bytes)
    assert mode == "encrypt"
    assert path is not None
    assert os.path.exists(path)

    # Verify content at rest is NOT plaintext
    with open(path, "rb") as f:
        stored = f.read()
    assert sample_bytes not in stored

    # Verify decrypts back to original bytes
    decrypted = decrypt_prescription_image(prescription_id)
    assert decrypted == sample_bytes
