"""Discharge summary PDF generator.

Produces an A4 PDF with:
  - Hospital header
  - Patient + admission demographics
  - Final diagnosis (highlighted)
  - Course in hospital
  - Procedures + treatment given
  - Investigations summary
  - Condition at discharge
  - Discharge medications + advice + follow-up
  - Attending doctor sign-off
"""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether)
from reportlab.lib.enums import TA_CENTER


PRIMARY = colors.HexColor("#0c4a6e")
SUBTLE = colors.HexColor("#475569")
HEADER_BG = colors.HexColor("#e0f2fe")
GREY_BORDER = colors.HexColor("#cbd5e1")
DIAGNOSIS_BG = colors.HexColor("#fef3c7")  # soft amber
DIAGNOSIS_BORDER = colors.HexColor("#f59e0b")


def generate_discharge_summary_pdf(admission):
    """Generate a discharge summary PDF. Requires admission.discharge_summary."""
    summary = admission.discharge_summary

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=12 * mm, bottomMargin=15 * mm,
        title=f"Discharge Summary — {admission.code}",
    )

    styles = getSampleStyleSheet()
    style_h1 = ParagraphStyle("h1", parent=styles["Heading1"],
        fontSize=18, textColor=PRIMARY, spaceAfter=2, leading=22)
    style_addr = ParagraphStyle("addr", parent=styles["Normal"],
        fontSize=9, textColor=SUBTLE, leading=11)
    style_section = ParagraphStyle("section", parent=styles["Heading2"],
        fontSize=12, textColor=PRIMARY, spaceAfter=4, spaceBefore=10, leading=15)
    style_label = ParagraphStyle("label", parent=styles["Normal"],
        fontSize=9, textColor=SUBTLE, leading=11)
    style_val = ParagraphStyle("val", parent=styles["Normal"],
        fontSize=10, leading=13)
    style_body = ParagraphStyle("body", parent=styles["Normal"],
        fontSize=10, leading=14)
    style_footer = ParagraphStyle("footer", parent=styles["Normal"],
        fontSize=8, textColor=SUBTLE, alignment=TA_CENTER, leading=10)

    story = []

    # ── Hospital header ───────────────────────────────────────────────────────
    h = admission.hospital
    h_name = getattr(h, "name", "Hospital")
    h_addr = ", ".join(p for p in [
        getattr(h, "address_line", "") or getattr(h, "address", ""),
        getattr(h, "city", ""), getattr(h, "state", ""),
        getattr(h, "pincode", ""),
    ] if p)
    h_phone = getattr(h, "phone", "")

    story.append(Paragraph(h_name, style_h1))
    if h_addr:
        story.append(Paragraph(h_addr, style_addr))
    if h_phone:
        story.append(Paragraph(h_phone, style_addr))

    story.append(Spacer(1, 6))
    title_table = Table(
        [[Paragraph("<b>DISCHARGE SUMMARY</b>", ParagraphStyle(
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

    # ── Patient + admission demographics ──────────────────────────────────────
    p = admission.patient
    p_age = getattr(p, "age", "")
    p_gender = getattr(p, "gender", "")

    attending_name = ""
    if admission.attending_doctor and admission.attending_doctor.user:
        attending_name = "Dr. " + (
            admission.attending_doctor.user.get_full_name() or "")

    info_rows = [
        [Paragraph("<b>Patient</b>", style_label),
         Paragraph(getattr(p, "full_name", "") or str(p), style_val),
         Paragraph("<b>IPD #</b>", style_label),
         Paragraph(admission.code, style_val)],
        [Paragraph("<b>MRN</b>", style_label),
         Paragraph(getattr(p, "mrn", ""), style_val),
         Paragraph("<b>Bed</b>", style_label),
         Paragraph(admission.bed.display_code, style_val)],
        [Paragraph("<b>Age / Gender</b>", style_label),
         Paragraph(f"{p_age} / {p_gender}", style_val),
         Paragraph("<b>Admission Date</b>", style_label),
         Paragraph(admission.admitted_at.strftime("%d %b %Y, %H:%M"),
                   style_val)],
        [Paragraph("<b>Phone</b>", style_label),
         Paragraph(getattr(p, "phone", ""), style_val),
         Paragraph("<b>Discharge Date</b>", style_label),
         Paragraph(
             admission.discharged_at.strftime("%d %b %Y, %H:%M")
             if admission.discharged_at else "—", style_val)],
        [Paragraph("<b>Attending Doctor</b>", style_label),
         Paragraph(attending_name, style_val),
         Paragraph("<b>Stay (days)</b>", style_label),
         Paragraph(str(admission.stay_days), style_val)],
    ]
    info_table = Table(info_rows, colWidths=[
        doc.width * 0.18, doc.width * 0.32,
        doc.width * 0.18, doc.width * 0.32,
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
    story.append(Spacer(1, 10))

    # ── Final diagnosis (boxed/highlighted) ───────────────────────────────────
    diag_table = Table([
        [Paragraph("<b>FINAL DIAGNOSIS</b>",
                   ParagraphStyle("diag_label", parent=styles["Normal"],
                                  fontSize=9, textColor=PRIMARY))],
        [Paragraph(summary.final_diagnosis or "—", style_body)],
    ], colWidths=[doc.width])
    diag_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DIAGNOSIS_BG),
        ("BOX", (0, 0), (-1, -1), 1.2, DIAGNOSIS_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(diag_table)

    # ── Sections ──────────────────────────────────────────────────────────────
    def section(title, body):
        if not body:
            return
        story.append(Paragraph(title, style_section))
        story.append(Paragraph(body.replace("\n", "<br/>"), style_body))

    section("Chief Complaint", admission.chief_complaint or "—")
    section("Admission Diagnosis", admission.admission_diagnosis)
    section("Course in Hospital", summary.course_in_hospital)
    section("Procedures Done", summary.procedures_done)
    section("Treatment Given", summary.treatment_given)
    section("Investigations Summary", summary.investigations_summary)
    section("Condition at Discharge", summary.condition_at_discharge)
    section("Medications on Discharge", summary.medications_on_discharge)
    section("Discharge Advice", summary.discharge_advice)
    if summary.follow_up_advice:
        section("Follow-up", summary.follow_up_advice)

    # ── Sign-off ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    signoff = Table([[
        Paragraph(f"<b>{attending_name}</b><br/>"
                  f"<font size=8 color='#64748b'>Attending Doctor</font>",
                  style_body),
        "",
        Paragraph(
            "<b>" + (
                summary.finalized_at.strftime("%d %b %Y, %H:%M")
                if summary.finalized_at else "DRAFT — Not signed"
            ) + "</b><br/><font size=8 color='#64748b'>Sign-off date</font>",
            style_body,
        ),
    ]], colWidths=[doc.width * 0.4, doc.width * 0.2, doc.width * 0.4])
    signoff.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
    ]))
    story.append(signoff)

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<i>This summary is computer-generated and may be reproduced for "
        "the patient and referring physician. Please contact the hospital "
        "for any clarification.</i>",
        style_footer,
    ))

    doc.build(story)
    return buffer.getvalue()
