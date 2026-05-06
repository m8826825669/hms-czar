"""Thermal printer (ESC/POS) helpers.

Compatible with: TVS RP-3220, Epson TM-T82, Citizen CT-S310, most 80mm/58mm thermal POS
printers used at OPD billing counters and pharmacy.

Three connection modes:
  * Network (LAN/Wi-Fi)         - Network(host, port)
  * USB (most common in India)  - Usb(vendor_id, product_id)
  * Serial (RS-232)             - Serial(devfile)

This module provides convenience wrappers; raw escpos library is also available
for advanced use.
"""
from __future__ import annotations
from contextlib import contextmanager
from typing import Optional

try:
    from escpos.printer import Network, Usb, Serial, Dummy  # type: ignore
except ImportError:  # printer hardware libs are optional in dev
    Network = Usb = Serial = Dummy = None  # type: ignore


@contextmanager
def network_printer(host: str, port: int = 9100, timeout: int = 5):
    """Open a thermal printer over TCP. Used by counter-side print jobs."""
    if Network is None:
        raise RuntimeError("python-escpos not available")
    p = Network(host, port=port, timeout=timeout)
    try:
        yield p
    finally:
        try:
            p.close()
        except Exception:
            pass


@contextmanager
def usb_printer(vendor_id: int, product_id: int):
    if Usb is None:
        raise RuntimeError("python-escpos not available")
    p = Usb(vendor_id, product_id)
    try:
        yield p
    finally:
        try:
            p.close()
        except Exception:
            pass


def print_opd_token(printer, *, token_no: str, patient_name: str, doctor: str,
                    department: str, opd_room: str, dt_str: str, hospital_name: str):
    """Prints a 80mm OPD queue token. Useful at reception."""
    printer.set(align="center", bold=True, double_height=True, double_width=True)
    printer.text(f"{hospital_name}\n")
    printer.set(bold=False, double_height=False, double_width=False)
    printer.text("OPD TOKEN\n")
    printer.text("-" * 32 + "\n")
    printer.set(bold=True, double_height=True, double_width=True)
    printer.text(f"{token_no}\n")
    printer.set(bold=False, double_height=False, double_width=False)
    printer.text("-" * 32 + "\n")
    printer.set(align="left")
    printer.text(f"Patient : {patient_name}\n")
    printer.text(f"Doctor  : {doctor}\n")
    printer.text(f"Dept    : {department}\n")
    printer.text(f"Room    : {opd_room}\n")
    printer.text(f"Time    : {dt_str}\n")
    printer.text("-" * 32 + "\n")
    printer.set(align="center")
    printer.text("Please wait until called.\n")
    printer.cut()


def print_invoice_receipt(printer, *, hospital_name: str, gst_number: str,
                          bill_no: str, patient_name: str, mrn: str,
                          line_items: list[dict], total: float, tax: float,
                          paid: float, balance: float, dt_str: str,
                          footer_msg: str = "Get well soon!"):
    """Standard 80mm thermal invoice. line_items = [{'desc','qty','rate','amount'}]"""
    printer.set(align="center", bold=True, double_width=True)
    printer.text(f"{hospital_name}\n")
    printer.set(double_width=False)
    if gst_number:
        printer.text(f"GSTIN: {gst_number}\n")
    printer.set(bold=False)
    printer.text("TAX INVOICE\n")
    printer.text("-" * 42 + "\n")
    printer.set(align="left")
    printer.text(f"Bill No : {bill_no}\n")
    printer.text(f"Date    : {dt_str}\n")
    printer.text(f"Patient : {patient_name}\n")
    printer.text(f"MRN     : {mrn}\n")
    printer.text("-" * 42 + "\n")
    printer.text(f"{'Item':<22}{'Qty':>4}{'Rate':>8}{'Amt':>8}\n")
    printer.text("-" * 42 + "\n")
    for it in line_items:
        desc = it["desc"][:22]
        printer.text(f"{desc:<22}{it['qty']:>4}{it['rate']:>8.2f}{it['amount']:>8.2f}\n")
    printer.text("-" * 42 + "\n")
    printer.set(bold=True)
    printer.text(f"{'Subtotal':<30}{total - tax:>12.2f}\n")
    printer.text(f"{'Tax (GST)':<30}{tax:>12.2f}\n")
    printer.text(f"{'TOTAL':<30}{total:>12.2f}\n")
    printer.text(f"{'Paid':<30}{paid:>12.2f}\n")
    printer.text(f"{'Balance':<30}{balance:>12.2f}\n")
    printer.set(bold=False)
    printer.text("-" * 42 + "\n")
    printer.set(align="center")
    printer.text(f"{footer_msg}\n")
    printer.cut()


def print_wristband(printer, *, patient_name: str, mrn: str, age: int,
                    gender: str, blood: str, ward: str, bed: str,
                    barcode_value: Optional[str] = None):
    """Compact patient wristband print."""
    printer.set(align="center", bold=True)
    printer.text(f"{patient_name}\n")
    printer.set(bold=False)
    printer.text(f"MRN: {mrn}  ({age}/{gender}/{blood})\n")
    printer.text(f"Ward: {ward}  Bed: {bed}\n")
    if barcode_value:
        printer.barcode(barcode_value, "CODE128", width=2, height=50)
    printer.cut()


def get_dummy_printer():
    """Returns an escpos Dummy printer that buffers output - useful for unit tests
    and previewing what would be sent without hardware."""
    if Dummy is None:
        raise RuntimeError("python-escpos not available")
    return Dummy()
