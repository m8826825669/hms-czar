"""Thermal printer PDF generator (80mm width).

Generates a narrow PDF receipt suitable for ESC/POS thermal printers via
`lp` (Linux/Mac) or directly via Windows print spooler. The PDF is also
fine for downloading/emailing.

Uses ReportLab. Layout dimensions tuned for 80mm thermal paper (~227pt wide).
For 58mm paper, swap PAGE_WIDTH = 58 * mm.
"""
import io
from decimal import Decimal
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

PAGE_WIDTH = 80 * mm  # Standard thermal width
PADDING_X = 4 * mm
LINE_HEIGHT = 4 * mm
HEADER_FONT = ("Helvetica-Bold", 9)
BODY_FONT = ("Helvetica", 8)
SMALL_FONT = ("Helvetica", 7)


def _truncate(text, max_chars):
    text = str(text or "")
    return text[: max_chars - 1] + "…" if len(text) > max_chars else text


def generate_invoice_pdf(invoice) -> bytes:
    """Render an Invoice as a thermal-format PDF and return bytes.

    Args:
        invoice: an apps.billing.models.Invoice instance with .items prefetched

    Returns:
        bytes of the PDF
    """
    items = list(invoice.items.all())

    # Estimate page height dynamically based on item count
    base_height = 90 * mm
    per_item = 7 * mm
    page_height = base_height + per_item * max(len(items), 1) + 40 * mm

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_WIDTH, page_height))
    y = page_height - 5 * mm

    # ─── Hospital header ─────
    hospital = invoice.hospital
    c.setFont(*HEADER_FONT)
    c.drawCentredString(PAGE_WIDTH / 2, y, _truncate(hospital.name, 32))
    y -= LINE_HEIGHT

    c.setFont(*SMALL_FONT)
    if getattr(hospital, "address_line1", ""):
        c.drawCentredString(PAGE_WIDTH / 2, y, _truncate(hospital.address_line1, 40))
        y -= LINE_HEIGHT - 1
    if getattr(hospital, "city", ""):
        addr2 = f"{hospital.city}, {getattr(hospital, 'state', '')}"
        c.drawCentredString(PAGE_WIDTH / 2, y, _truncate(addr2, 40))
        y -= LINE_HEIGHT - 1
    if getattr(hospital, "phone", ""):
        c.drawCentredString(PAGE_WIDTH / 2, y, f"Ph: {hospital.phone}")
        y -= LINE_HEIGHT - 1
    if getattr(hospital, "gstin", ""):
        c.drawCentredString(PAGE_WIDTH / 2, y, f"GSTIN: {hospital.gstin}")
        y -= LINE_HEIGHT

    y -= 1 * mm
    _hr(c, y); y -= LINE_HEIGHT

    # ─── Invoice meta ─────
    c.setFont(*HEADER_FONT)
    c.drawCentredString(PAGE_WIDTH / 2, y, "TAX INVOICE")
    y -= LINE_HEIGHT

    c.setFont(*BODY_FONT)
    c.drawString(PADDING_X, y, f"Bill: {invoice.code}")
    c.drawRightString(PAGE_WIDTH - PADDING_X, y,
                      invoice.bill_date.strftime("%d-%b-%Y"))
    y -= LINE_HEIGHT

    c.drawString(PADDING_X, y, f"Patient: {_truncate(invoice.patient.full_name, 26)}")
    y -= LINE_HEIGHT
    c.drawString(PADDING_X, y, f"MRN: {invoice.patient.mrn}")
    if invoice.patient.phone:
        c.drawRightString(PAGE_WIDTH - PADDING_X, y, invoice.patient.phone)
    y -= LINE_HEIGHT

    _hr(c, y); y -= LINE_HEIGHT

    # ─── Items table ─────
    c.setFont("Helvetica-Bold", 7)
    c.drawString(PADDING_X, y, "Item")
    c.drawRightString(PAGE_WIDTH - 18 * mm, y, "Qty")
    c.drawRightString(PAGE_WIDTH - 4 * mm, y, "Total")
    y -= LINE_HEIGHT - 1
    _hr(c, y); y -= LINE_HEIGHT - 1

    c.setFont(*BODY_FONT)
    for item in items:
        # Item name (may wrap)
        c.drawString(PADDING_X, y, _truncate(item.service_name, 28))
        c.drawRightString(PAGE_WIDTH - 18 * mm, y, str(item.quantity).rstrip("0").rstrip("."))
        c.drawRightString(PAGE_WIDTH - 4 * mm, y, f"{item.total:.2f}")
        y -= LINE_HEIGHT - 1
        # Sub-line: rate × qty + GST %
        c.setFont(*SMALL_FONT)
        sub = f"  @{item.unit_price:.2f}"
        if item.gst_rate and item.gst_rate > 0:
            sub += f"  GST {item.gst_rate}%"
        if item.discount_pct and item.discount_pct > 0:
            sub += f"  -{item.discount_pct}%"
        c.drawString(PADDING_X, y, sub)
        y -= LINE_HEIGHT - 1
        c.setFont(*BODY_FONT)

    _hr(c, y); y -= LINE_HEIGHT

    # ─── Totals ─────
    c.setFont(*BODY_FONT)
    c.drawString(PADDING_X, y, "Subtotal")
    c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"{invoice.subtotal:.2f}")
    y -= LINE_HEIGHT

    if invoice.discount_amount and invoice.discount_amount > 0:
        c.drawString(PADDING_X, y, f"Discount")
        c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"-{invoice.discount_amount:.2f}")
        y -= LINE_HEIGHT

    if invoice.cgst_amount and invoice.cgst_amount > 0:
        c.drawString(PADDING_X, y, "CGST")
        c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"{invoice.cgst_amount:.2f}")
        y -= LINE_HEIGHT
    if invoice.sgst_amount and invoice.sgst_amount > 0:
        c.drawString(PADDING_X, y, "SGST")
        c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"{invoice.sgst_amount:.2f}")
        y -= LINE_HEIGHT
    if invoice.igst_amount and invoice.igst_amount > 0:
        c.drawString(PADDING_X, y, "IGST")
        c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"{invoice.igst_amount:.2f}")
        y -= LINE_HEIGHT

    _hr(c, y); y -= LINE_HEIGHT

    c.setFont("Helvetica-Bold", 10)
    c.drawString(PADDING_X, y, "TOTAL")
    c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"INR {invoice.total_amount:.2f}")
    y -= LINE_HEIGHT + 1

    c.setFont(*BODY_FONT)
    c.drawString(PADDING_X, y, "Paid")
    c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"{invoice.amount_paid:.2f}")
    y -= LINE_HEIGHT
    if invoice.amount_due > 0:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(PADDING_X, y, "DUE")
        c.drawRightString(PAGE_WIDTH - PADDING_X, y, f"{invoice.amount_due:.2f}")
        y -= LINE_HEIGHT

    # Payment list
    payments = invoice.payments.filter(status="SUCCESS")
    if payments.exists():
        y -= 1 * mm
        _hr(c, y); y -= LINE_HEIGHT
        c.setFont(*SMALL_FONT)
        c.drawString(PADDING_X, y, "Payments:")
        y -= LINE_HEIGHT - 1
        for p in payments:
            line = f"  {p.received_at.strftime('%d-%b %H:%M')}  {p.get_method_display()}  ₹{p.amount:.2f}"
            c.drawString(PADDING_X, y, _truncate(line, 44))
            y -= LINE_HEIGHT - 1

    # Footer
    y -= 2 * mm
    _hr(c, y); y -= LINE_HEIGHT
    c.setFont(*SMALL_FONT)
    c.drawCentredString(PAGE_WIDTH / 2, y, "Thank you. Get well soon!")
    y -= LINE_HEIGHT - 1
    c.drawCentredString(PAGE_WIDTH / 2, y, "This is a computer-generated bill.")

    c.showPage()
    c.save()
    return buf.getvalue()


def _hr(c, y):
    c.setLineWidth(0.4)
    c.line(PADDING_X, y, PAGE_WIDTH - PADDING_X, y)
