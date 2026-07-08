"""
PDF scorecard generation using ReportLab. Only ever called from the admin
router - candidates never see this.
"""
from io import BytesIO
from datetime import datetime, timedelta, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

from app import models


def _safe_score(value) -> float:
    return float(value) if value is not None else 0.0


def _safe_text(value, fallback: str = "N/A") -> str:
    return value if value not in (None, "") else fallback


def generate_report_pdf(session: models.InterviewSession) -> bytes:
    candidate = session.user
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleCustom", parent=styles["Title"], textColor=colors.HexColor("#1a1a2e"))
    h2_style = ParagraphStyle("H2Custom", parent=styles["Heading2"], textColor=colors.HexColor("#16213e"))
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#555555"))
    feedback_style = ParagraphStyle("Feedback", parent=styles["Normal"], fontSize=10, spaceAfter=4)
    missed_style = ParagraphStyle("Missed", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#a4133c"))

    elements = []

    elements.append(Paragraph("AI Technical Interview Report", title_style))
    elements.append(Paragraph(f"Generated: {_ist_now().strftime('%Y-%m-%d %H:%M IST')}", small))
    elements.append(Spacer(1, 14))

    if isinstance(candidate.skills, (list, tuple, set)):
        skills_values = [str(item) for item in candidate.skills if item not in (None, "")]
    elif candidate.skills not in (None, ""):
        skills_values = [str(candidate.skills)]
    else:
        skills_values = []
    skills_str = ", ".join(skills_values) if skills_values else "N/A"

    elements.append(Paragraph(f"<b>Candidate:</b> {_safe_text(candidate.name, 'Unknown')}", normal))
    elements.append(Paragraph(f"<b>Email:</b> {_safe_text(candidate.email, 'N/A')}", normal))
    elements.append(Paragraph(f"<b>Experience:</b> {candidate.experience_years or 0} years", normal))
    elements.append(Paragraph(f"<b>Skills:</b> {skills_str}", normal))
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Overall Summary", h2_style))
    summary_data = [
        ["Overall Score", f"{_safe_score(session.overall_score):.1f} / 10"],
        ["Average Technical Score", f"{_safe_score(session.avg_technical_score):.1f} / 10"],
        ["Average Communication Score", f"{_safe_score(session.avg_communication_score):.1f} / 10"],
        ["Verdict", _safe_text(session.verdict, "Pending")],
    ]
    summary_table = Table(summary_data, colWidths=[220, 220])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef1ff")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))

    elements.append(Paragraph("Question-by-Question Breakdown", h2_style))
    elements.append(Spacer(1, 8))

    sorted_answers = sorted(session.answers, key=lambda a: a.session_question.question_index)

    for ans in sorted_answers:
        q = ans.session_question
        elements.append(Paragraph(f"<b>Q{q.question_index + 1} ({q.topic}). {q.question_text}</b>", normal))
        elements.append(Paragraph(
            f"Technical: {_safe_score(ans.technical_score):.1f}/10 &nbsp;|&nbsp; "
            f"Communication: {_safe_score(ans.communication_score):.1f}/10 &nbsp;|&nbsp; "
            f"Time: {ans.time_taken_seconds or 0}s &nbsp;|&nbsp; "
            f"Speaking rate: {ans.words_per_minute or 0} wpm &nbsp;|&nbsp; "
            f"Filler words: {ans.filler_word_count or 0}",
            small,
        ))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(f"<b>Feedback:</b> {_safe_text(ans.feedback, 'No feedback provided')}", feedback_style))
        if ans.missed_concepts:
            elements.append(Paragraph(f"<b>Missed:</b> {'; '.join(ans.missed_concepts)}", missed_style))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(f"<i>Transcript:</i> \"{_safe_text(ans.transcript, 'No transcript available')}\"", small))
        elements.append(Spacer(1, 8))
        elements.append(HRFlowable(width="100%", color=colors.HexColor("#dddddd")))
        elements.append(Spacer(1, 10))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


def _ist_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).replace(tzinfo=None)
