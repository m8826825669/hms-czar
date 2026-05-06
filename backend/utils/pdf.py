"""PDF generation via WeasyPrint (HTML → PDF).

Used for:
  - OPD prescription
  - Tax invoice
  - Discharge summary
  - Lab report
  - Payslip
  - GRN, PO

Templates live in `templates/pdf/<name>.html`. They can include a Bootstrap-like
inline CSS or pull from `static/`.
"""
from __future__ import annotations
from io import BytesIO
from django.template.loader import render_to_string


def render_pdf(template_name: str, context: dict, *, base_url: str | None = None) -> bytes:
    """Renders a Django template to PDF bytes.

    `base_url` is used by WeasyPrint to resolve <img>, <link>, etc. - usually the
    project root or MEDIA_ROOT.
    """
    try:
        from weasyprint import HTML  # type: ignore
    except ImportError as e:
        raise RuntimeError("weasyprint not installed") from e

    html_str = render_to_string(template_name, context)
    buf = BytesIO()
    HTML(string=html_str, base_url=base_url).write_pdf(target=buf)
    return buf.getvalue()
