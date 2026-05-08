"""Lab report PDF generator.

Produces an A4 PDF with:
  - Hospital header (name, address, phone)
  - Patient demographics block
  - Order metadata (LAB code, ordered by, dates)
  - Per-test parameter table (parameter | value | unit | reference | flag)
  - Abnormal values highlighted (LOW=red text, HIGH=red text, CRITICAL=bold red bg)
  - Pathologist sign-off line + verified-at timestamp

Designed to print clean on standard A4 lab printers.
"""
import io
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT


# Color palette
PRIMARY = colors.HexColor("#0c4a6e")     # dark blue
SUBTLE = colors.HexColor("#475569")      # slate
HEADER_BG = colors.HexColor("#e0f2fe")   # light blue
LOW = colors.HexColor("#b45309")         # amber
HIGH = colors.HexColor("#b91c1c")        # red
CRITICAL_BG = colors.HexColor("#fef2f2") # very-light red
CRITICAL_FG = colors.HexColor("#991b1b") # deep red
NORMAL = colors.HexColor("#166534")      # green
GREY_BORDER = colors.HexColor("#cbd5e1")


def _flag_color(flag):
    return {"LOW": LOW, "HIGH": HIGH, "CRITICAL": CRITICAL_FG, "NORMAL": NORMAL}.get(
        flag, colors.black
    )


def generate_lab_report(order):
    """Generate a PDF lab report for the given LabOrder. Returns bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=12 * mm, bottomMargin=15 * mm,
        title=f"Lab Report — {order.code}",
    )

    styles = getSampleStyleSheet()
    style_h1 = ParagraphStyle(
        "h1", parent=styles["Heading1"],
        fontSize=18, textColor=PRIMARY, spaceAfter=2, leading=22,
    )
    style_addr = ParagraphStyle(
        "addr", parent=styles["Normal"],
        fontSize=9, textColor=SUBTLE, leading=11,
    )
    style_h2 = ParagraphStyle(
        "h2", parent=styles["Heading2"],
        fontSize=13, textColor=PRIMARY, spaceAfter=4, spaceBefore=10, leading=16,
    )
    style_sub = ParagraphStyle(
        "sub", parent=styles["Normal"],
        fontSize=9.5, leading=13,
    )
    style_label = ParagraphStyle(
        "label", parent=styles["Normal"],
        fontSize=9, textColor=SUBTLE, leading=11,
    )
    style_val = ParagraphStyle(
        "val", parent=styles["Normal"],
        fontSize=10, leading=12,
    )
    style_footer = ParagraphStyle(
        "footer", parent=styles["Normal"],
        fontSize=8, textColor=SUBTLE, alignment=TA_CENTER, leading=10,
    )

    story = []

    # ── Hospital header ─────────────────────────────────────────────────────────
    h = order.hospital
    h_name = getattr(h, "name", "Hospital")
    h_addr_parts = [
        getattr(h, "address_line", "") or getattr(h, "address", ""),
        getattr(h, "city", ""),
        getattr(h, "state", ""),
        getattr(h, "pincode", ""),
    ]
    h_addr = ", ".join(p for p in h_addr_parts if p)
    h_phone = getattr(h, "phone", "")
    h_email = getattr(h, "email", "")

    story.append(Paragraph(h_name, style_h1))
    if h_addr:
        story.append(Paragraph(h_addr, style_addr))
    contact = " | ".join(p for p in [h_phone, h_email] if p)
    if contact:
        story.append(Paragraph(contact, style_addr))

    # Title bar
    story.append(Spacer(1, 6))
    title_table = Table(
        [[Paragraph("<b>LABORATORY REPORT</b>", ParagraphStyle(
            "title_bar", parent=styles["Heading2"],
            fontSize=12, textColor=colors.white, alignment=TA_CENTER,
        ))]],
        colWidths=[doc.width],
    )
    title_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(title_table)
    story.append(Spacer(1, 8))

    # ── Patient + Order block ───────────────────────────────────────────────────
    p = order.patient
    p_name = getattr(p, "full_name", "") or str(p)
    p_age = getattr(p, "age", "")
    p_gender = getattr(p, "gender", "")
    p_mrn = getattr(p, "mrn", "")
    p_phone = getattr(p, "phone", "")

    ordered_by = ""
    if order.ordered_by and order.ordered_by.user:
        ordered_by = "Dr. " + (order.ordered_by.user.get_full_name() or "")

    info_data = [
        [Paragraph("<b>Patient Name</b>", style_label),
         Paragraph(p_name, style_val),
         Paragraph("<b>Lab Order #</b>", style_label),
         Paragraph(order.code, style_val)],
        [Paragraph("<b>MRN</b>", style_label),
         Paragraph(p_mrn, style_val),
         Paragraph("<b>Order Date</b>", style_label),
         Paragraph(order.order_date.strftime("%d %b %Y"), style_val)],
        [Paragraph("<b>Age / Gender</b>", style_label),
         Paragraph(f"{p_age} / {p_gender}", style_val),
         Paragraph("<b>Collected At</b>", style_label),
         Paragraph(
             order.sample_collected_at.strftime("%d %b %Y, %H:%M")
             if order.sample_collected_at else "—", style_val,
         )],
        [Paragraph("<b>Phone</b>", style_label),
         Paragraph(p_phone, style_val),
         Paragraph("<b>Reported At</b>", style_label),
         Paragraph(
             order.reported_at.strftime("%d %b %Y, %H:%M")
             if order.reported_at else "—", style_val,
         )],
        [Paragraph("<b>Referred By</b>", style_label),
         Paragraph(ordered_by, style_val),
         Paragraph("<b>Priority</b>", style_label),
         Paragraph(order.get_priority_display(), style_val)],
    ]
    info_table = Table(info_data, colWidths=[
        doc.width * 0.18, doc.width * 0.32, doc.width * 0.18, doc.width * 0.32,
    ])
    info_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, GREY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GREY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6))

    if order.clinical_notes:
        story.append(Paragraph(
            f"<b>Clinical Notes:</b> {order.clinical_notes}", style_sub,
        ))
        story.append(Spacer(1, 4))

    # ── Tests + Results ─────────────────────────────────────────────────────────
    has_any_results = False
    for item in order.items.all().order_by("order_index"):
        results = list(item.results.all().order_by("sort_order"))
        if not results:
            continue
        has_any_results = True

        section = []
        section.append(Paragraph(f"{item.test_name}  <font size=8 color='#64748b'>"
                                  f"({item.test_code})</font>", style_h2))

        # Header row + result rows
        rows = [["Parameter", "Result", "Unit", "Reference", "Flag"]]
        styles_for_rows = []
        for ridx, r in enumerate(results, start=1):
            flag_label = r.flag if r.flag != "NORMAL" else ""
            value_paragraph = Paragraph(
                f"<b>{r.value}</b>", ParagraphStyle(
                    f"v{r.id}", parent=styles["Normal"],
                    fontSize=10, leading=12,
                    textColor=_flag_color(r.flag) if r.flag != "NORMAL" else colors.black,
                ),
            )
            flag_paragraph = Paragraph(
                f"<b>{flag_label}</b>" if flag_label else "—",
                ParagraphStyle(
                    f"f{r.id}", parent=styles["Normal"],
                    fontSize=9, leading=11,
                    textColor=_flag_color(r.flag),
                ),
            )
            rows.append([
                Paragraph(r.parameter_name, style_val),
                value_paragraph,
                Paragraph(r.parameter_unit or "—", style_val),
                Paragraph(r.parameter_ref or "—", style_val),
                flag_paragraph,
            ])
            if r.flag == "CRITICAL":
                styles_for_rows.append(("BACKGROUND", (0, ridx), (-1, ridx), CRITICAL_BG))

        result_table = Table(rows, colWidths=[
            doc.width * 0.32, doc.width * 0.22, doc.width * 0.12,
            doc.width * 0.22, doc.width * 0.12,
        ], repeatRows=1)
        ts = [
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("TEXTCOLOR", (0, 0), (-1, 0), PRIMARY),
            ("BOX", (0, 0), (-1, -1), 0.6, GREY_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, GREY_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ] + styles_for_rows
        result_table.setStyle(TableStyle(ts))
        section.append(result_table)

        # Interpretations
        interps = [r for r in results if r.interpretation]
        if interps:
            for r in interps:
                section.append(Spacer(1, 2))
                section.append(Paragraph(
                    f"<i>{r.parameter_name}:</i> {r.interpretation}",
                    style_sub,
                ))
        section.append(Spacer(1, 6))
        story.append(KeepTogether(section))

    if not has_any_results:
        story.append(Paragraph("<i>Results pending.</i>", style_sub))

    # ── Sign-off ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    reported_by_name = ""
    if order.reported_by and order.reported_by.user:
        reported_by_name = "Dr. " + (order.reported_by.user.get_full_name() or "")

    signoff_data = [
        [
            Paragraph("<b>_________________________</b>", style_sub),
            "",
            Paragraph("<b>_________________________</b>", style_sub),
        ],
        [
            Paragraph("Lab Technician", style_label),
            "",
            Paragraph(reported_by_name or "Pathologist", style_label),
        ],
    ]
    signoff_table = Table(signoff_data, colWidths=[
        doc.width * 0.4, doc.width * 0.2, doc.width * 0.4,
    ])
    signoff_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    story.append(signoff_table)
    story.append(Spacer(1, 6))

    # Footer
    story.append(Paragraph(
        "<i>This is a computer-generated report. Results should be correlated "
        "clinically. Please contact the lab for any clarification.</i>",
        style_footer,
    ))

    doc.build(story)
    return buffer.getvalue()
