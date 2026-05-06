"""Barcode & QR code generation helpers.

Use cases in HMS:
  * Patient wristband (Code128 of MRN)
  * Sample tube labels (Code128 + small QR)
  * Prescription QR (encodes prescription URL/ID)
  * Drug batch labels (Code128)
  * Bed/asset tags (QR)
"""
from __future__ import annotations
import io
from typing import Literal

import barcode
from barcode.writer import ImageWriter
import qrcode
from qrcode.constants import ERROR_CORRECT_M


def generate_barcode(
    value: str,
    symbology: Literal["code128", "code39", "ean13"] = "code128",
    *,
    write_text: bool = True,
    module_width: float = 0.25,
    module_height: float = 12.0,
) -> bytes:
    """Returns PNG bytes for the barcode.

    >>> png = generate_barcode("MRN00012345")
    >>> open("wristband.png", "wb").write(png)
    """
    cls = barcode.get_barcode_class(symbology)
    options = {
        "write_text": write_text,
        "module_width": module_width,
        "module_height": module_height,
        "font_size": 8,
        "text_distance": 3,
        "quiet_zone": 2,
    }
    buf = io.BytesIO()
    cls(value, writer=ImageWriter()).write(buf, options=options)
    return buf.getvalue()


def generate_qr(
    data: str,
    *,
    box_size: int = 6,
    border: int = 2,
    error_correction=ERROR_CORRECT_M,
) -> bytes:
    """Returns PNG bytes for the QR code."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=error_correction,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def patient_wristband_payload(patient) -> dict:
    """Compact data for embedding in patient QR (wristband / discharge slip)."""
    return {
        "mrn": patient.mrn,
        "name": patient.full_name,
        "dob": patient.dob.isoformat() if patient.dob else None,
        "blood": patient.blood_group,
        "gender": patient.gender,
    }


def prescription_qr_url(prescription_id: int, base_url: str) -> str:
    """Stable URL the QR encodes - patient can scan to view prescription on their phone."""
    return f"{base_url.rstrip('/')}/p/rx/{prescription_id}"
