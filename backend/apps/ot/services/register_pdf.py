"""
OT Register PDF — formal surgical record.

Generates a multi-section ReportLab PDF with hospital header, patient details,
procedure/team table, all clinical narrative sections, instruments + implants,
and surgeon sign-off.
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)


# Brand palette
PRIMARY = colors.HexColor("#0c4a6e")
ACCENT_BG = colors.HexColor("#fef3c7")
ACCENT_BORDER = colors.HexColor("#f59e0b")
SUBTLE = colors.HexColor("#f1f5f9")
TEXT_MUTED = colors.HexColor("#64748b")


def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle(
        name="OTTitle", fontSize=18, textColor=PRIMARY,
        spaceAfter=2, fontName="Helvetica-Bold",
    ))
    s.add(ParagraphStyle(
        name="OTSubtitle", fontSize=10, textColor=TEXT_MUTED,
        spaceAfter=8,
    ))
    s.add(ParagraphStyle(
        name="OTSection", fontSize=11, textColor=PRIMARY,
        fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4,
    ))
    s.add(ParagraphStyle(
        name="OTBody", fontSize=10, textColor=colors.black, leading=13,
        spaceAfter=4,
    ))
    s.add(ParagraphStyle(
        name="OTLabel", fontSize=8, textColor=TEXT_MUTED,
        fontName="Helvetica-Bold",
    ))
    return s


def generate_ot_register_pdf(booking):
    """Generate a PDF for the surgery booking. Returns bytes."""
    register = getattr(booking, "ot_register", None)
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
    )
    s = _styles()
    elements = []

    hospital = booking.hospital
    patient = booking.patient
    procedure = booking.procedure

    # Header
    elements.append(Paragraph(hospital.name if hospital else "Hospital", s["OTTitle"]))
    addr_parts = [getattr(hospital, "address", ""), getattr(hospital, "phone", "")]
    addr = " · ".join([p for p in addr_parts if p])
    if addr:
        elements.append(Paragraph(addr, s["OTSubtitle"]))

    elements.append(Paragraph("OPERATION THEATRE REGISTER", s["OTSection"]))
    elements.append(Spacer(1, 4))

    # Booking + patient table
    age = getattr(patient, "age", None) or "—"
    gender = getattr(patient, "gender", "") or "—"
    full_name = (patient.full_name if hasattr(patient, "full_name")
                 else f"{patient.first_name} {patient.last_name}")
    rows = [
        [
            Paragraph("OT Code", s["OTLabel"]),
            Paragraph(booking.code, s["OTBody"]),
            Paragraph("Theatre", s["OTLabel"]),
            Paragraph(f"{booking.theatre.code} ({booking.theatre.name})", s["OTBody"]),
        ],
        [
            Paragraph("Patient", s["OTLabel"]),
            Paragraph(full_name, s["OTBody"]),
            Paragraph("MRN", s["OTLabel"]),
            Paragraph(getattr(patient, "mrn", "—"), s["OTBody"]),
        ],
        [
            Paragraph("Age / Gender", s["OTLabel"]),
            Paragraph(f"{age} / {gender}", s["OTBody"]),
            Paragraph("Urgency", s["OTLabel"]),
            Paragraph(booking.get_urgency_display(), s["OTBody"]),
        ],
        [
            Paragraph("Procedure", s["OTLabel"]),
            Paragraph(procedure.name, s["OTBody"]),
            Paragraph("Category", s["OTLabel"]),
            Paragraph(procedure.get_category_display(), s["OTBody"]),
        ],
        [
            Paragraph("Scheduled", s["OTLabel"]),
            Paragraph(
                booking.scheduled_start.strftime("%d %b %Y, %H:%M") + " — "
                + booking.scheduled_end.strftime("%H:%M"),
                s["OTBody"],
            ),
            Paragraph("Actual", s["OTLabel"]),
            Paragraph(
                (booking.actual_start.strftime("%H:%M") + " — "
                 + booking.actual_end.strftime("%H:%M"))
                if booking.actual_start and booking.actual_end else "—",
                s["OTBody"],
            ),
        ],
    ]
    t = Table(rows, colWidths=[28 * mm, 60 * mm, 28 * mm, 58 * mm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (0, -1), SUBTLE),
        ("BACKGROUND", (2, 0), (2, -1), SUBTLE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)

    # Pre-op diagnosis (highlighted)
    if booking.pre_op_diagnosis:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(
            f"<b>Pre-op Diagnosis:</b> {booking.pre_op_diagnosis}",
            ParagraphStyle(
                name="diag", parent=s["OTBody"],
                backColor=ACCENT_BG, borderColor=ACCENT_BORDER,
                borderWidth=1, borderPadding=6, leading=14,
            ),
        ))

    # Team
    elements.append(Paragraph("Surgical Team", s["OTSection"]))
    team_rows = [["Role", "Member", "Notes"]]
    for tm in booking.team.all():
        team_rows.append([tm.get_role_display(), tm.display_name, tm.notes or "—"])
    if len(team_rows) == 1:
        team_rows.append(["—", "No team members recorded", ""])
    team_t = Table(team_rows, colWidths=[40 * mm, 80 * mm, 54 * mm])
    team_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(team_t)

    # Clinical narrative sections
    if register:
        sections = [
            ("Pre-op Findings", register.pre_op_findings),
            ("Surgical Steps", register.surgical_steps),
            ("Intra-op Findings", register.intra_op_findings),
            ("Complications", register.complications or "Nil"),
            ("Anaesthesia", _format_anaesthesia(register)),
            ("Blood Loss / Transfusion",
                f"Estimated blood loss: {register.blood_loss_ml} ml"
                + (f"; transfused: {register.blood_transfused_units} units"
                   if register.blood_transfused_units else "")),
            ("Instruments Used", register.instruments_used),
            ("Implants Used", register.implants_used),
            ("Specimens Sent", register.specimens_sent),
            ("Post-op Orders", register.post_op_orders),
            ("Condition on Shifting", register.condition_on_shifting),
        ]
        for label, text in sections:
            if not text:
                continue
            elements.append(Paragraph(label, s["OTSection"]))
            elements.append(Paragraph(_escape(text).replace("\n", "<br/>"), s["OTBody"]))
    else:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(
            "<i>OT Register has not been prepared yet.</i>", s["OTBody"],
        ))

    # Consumables
    consumables = list(booking.consumables.all())
    if consumables:
        elements.append(Paragraph("Consumables Used", s["OTSection"]))
        cons_rows = [["Item", "Qty", "Unit Price", "Total"]]
        for c in consumables:
            cons_rows.append([
                c.item_name,
                f"{c.quantity} {c.unit}",
                f"₹{c.unit_price}",
                f"₹{c.total}",
            ])
        cons_t = Table(cons_rows, colWidths=[80 * mm, 25 * mm, 30 * mm, 30 * mm])
        cons_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(cons_t)

    # Sign-off
    elements.append(Spacer(1, 18))
    if register and register.prepared_by:
        prep_name = (register.prepared_by.user.get_full_name()
                     or register.prepared_by.user.username)
        sign_text = (
            f"Prepared by: <b>Dr. {prep_name}</b> "
            f"(Reg: {register.prepared_by.registration_number})<br/>"
            f"At: {register.prepared_at.strftime('%d %b %Y, %H:%M')}"
        )
    else:
        sign_text = (
            f"Primary Surgeon: <b>Dr. "
            f"{booking.primary_surgeon.user.get_full_name()}</b><br/>"
            f"Signature: __________________________"
        )
    elements.append(Paragraph(sign_text, s["OTBody"]))

    if register and register.is_finalized:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(
            f"<i>Finalized at {register.finalized_at.strftime('%d %b %Y, %H:%M')}</i>",
            s["OTSubtitle"],
        ))

    doc.build(elements)
    pdf = buf.getvalue()
    buf.close()
    return pdf


def _format_anaesthesia(register):
    parts = []
    if register.anaesthesia_type:
        parts.append(f"Type: {register.anaesthesia_type}")
    if register.anaesthesia_notes:
        parts.append(register.anaesthesia_notes)
    return " — ".join(parts) if parts else ""


def _escape(text):
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
