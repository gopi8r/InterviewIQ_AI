"""
Admin-only endpoints (require role == admin, enforced by auth.get_current_admin):

  GET  /api/admin/settings                  - view the current question limit
  PUT  /api/admin/settings                  - update the question limit
  GET  /api/admin/candidates                - paginated + searchable list of
                                               interview sessions with scores
  GET  /api/admin/candidates/{id}            - full breakdown for one session
  GET  /api/admin/candidates/{id}/report      - download one PDF scorecard
  GET  /api/admin/candidates/bulk-report      - download a ZIP of every
                                               completed session's PDF within
                                               a given date range
"""
from io import BytesIO
from datetime import datetime, date, timedelta
from zipfile import ZipFile

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.database import get_db
from app import models, schemas, auth
from app.services import pdf_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------- Settings ----------------
@router.get("/settings", response_model=schemas.AdminSettingsOut)
def get_settings(db: Session = Depends(get_db), _admin: models.User = Depends(auth.get_current_admin)):
    row = _get_or_create_settings(db)
    return {"question_limit": row.question_limit}


@router.put("/settings", response_model=schemas.AdminSettingsOut)
def update_settings(
    payload: schemas.AdminSettingsUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.get_current_admin),
):
    row = _get_or_create_settings(db)
    row.question_limit = payload.question_limit
    db.commit()
    db.refresh(row)
    return {"question_limit": row.question_limit}


def _get_or_create_settings(db: Session) -> models.AdminSettings:
    row = db.query(models.AdminSettings).filter(models.AdminSettings.id == 1).first()
    if not row:
        row = models.AdminSettings(id=1, question_limit=5)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ---------------- Candidate results (paginated + searchable) ----------------
@router.get("/candidates", response_model=schemas.PaginatedCandidates)
def list_candidates(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.get_current_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str = Query("", description="Filter by candidate name or email"),
):
    query = db.query(models.InterviewSession).options(joinedload(models.InterviewSession.user))

    if search.strip():
        like = f"%{search.strip()}%"
        query = query.join(models.User).filter(
            or_(models.User.name.ilike(like), models.User.email.ilike(like))
        )

    total = query.count()
    sessions = (
        query.order_by(models.InterviewSession.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_session_to_summary(s) for s in sessions],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/candidates/bulk-report")
def download_bulk_reports(
    start_date: date = Query(..., description="Inclusive start date, YYYY-MM-DD"),
    end_date: date = Query(..., description="Inclusive end date, YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.get_current_admin),
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    # end_date is inclusive, so extend to the very end of that day
    end_datetime = datetime.combine(end_date, datetime.max.time())
    start_datetime = datetime.combine(start_date, datetime.min.time())

    sessions = (
        db.query(models.InterviewSession)
        .options(
            joinedload(models.InterviewSession.user),
            joinedload(models.InterviewSession.answers).joinedload(models.Answer.session_question),
        )
        .filter(
            models.InterviewSession.completed_at.isnot(None),
            models.InterviewSession.overall_score.isnot(None),
            models.InterviewSession.completed_at >= start_datetime,
            models.InterviewSession.completed_at <= end_datetime,
        )
        .order_by(models.InterviewSession.completed_at.asc())
        .all()
    )

    if not sessions:
        raise HTTPException(status_code=404, detail="No completed interviews found in that date range")

    zip_buffer = BytesIO()
    with ZipFile(zip_buffer, "w") as zf:
        used_names = set()
        for session in sessions:
            pdf_bytes = pdf_service.generate_report_pdf(session)
            base_name = f"{session.user.name.replace(' ', '_')}_{session.id}.pdf"
            # guard against duplicate filenames inside the zip
            name = base_name
            counter = 1
            while name in used_names:
                name = f"{session.user.name.replace(' ', '_')}_{session.id}_{counter}.pdf"
                counter += 1
            used_names.add(name)
            zf.writestr(name, pdf_bytes)

    zip_buffer.seek(0)
    filename = f"interview-reports_{start_date}_to_{end_date}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/candidates/{session_id}", response_model=schemas.CandidateSessionDetailOut)
def get_candidate_detail(
    session_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(auth.get_current_admin)
):
    session = _get_session_or_404(db, session_id)
    summary = _session_to_summary(session)
    sorted_answers = sorted(session.answers, key=lambda a: a.session_question.question_index)
    summary["answers"] = [
        {
            "question_index": a.session_question.question_index,
            "question_text": a.session_question.question_text,
            "transcript": a.transcript or "",
            "time_taken_seconds": a.time_taken_seconds or 0,
            "words_per_minute": a.words_per_minute or 0,
            "filler_word_count": a.filler_word_count or 0,
            "technical_score": a.technical_score or 0.0,
            "communication_score": a.communication_score or 0.0,
            "feedback": a.feedback or "",
            "missed_concepts": a.missed_concepts or [],
        }
        for a in sorted_answers
    ]
    return summary


@router.get("/candidates/{session_id}/report")
def download_candidate_report(
    session_id: int, db: Session = Depends(get_db), _admin: models.User = Depends(auth.get_current_admin)
):
    session = _get_session_or_404(db, session_id)
    if session.overall_score is None:
        raise HTTPException(status_code=400, detail="This candidate has not completed evaluation yet")

    pdf_bytes = pdf_service.generate_report_pdf(session)
    filename = f"interview-report-{session.user.name.replace(' ', '_')}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------- helpers ----------------
def _get_session_or_404(db: Session, session_id: int) -> models.InterviewSession:
    session = (
        db.query(models.InterviewSession)
        .options(
            joinedload(models.InterviewSession.user),
            joinedload(models.InterviewSession.answers).joinedload(models.Answer.session_question),
        )
        .filter(models.InterviewSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _session_to_summary(session: models.InterviewSession) -> dict:
    # Defensive: always return numeric 0 instead of None for scores, so the
    # frontend never has to guard against null and never throws trying to
    # call .toFixed() on a missing value (this was the cause of the popup
    # error when a session had not been evaluated yet).
    return {
        "session_id": session.id,
        "candidate_name": session.user.name,
        "candidate_email": session.user.email,
        "experience_years": session.user.experience_years or 0,
        "skills": session.user.skills or [],
        "started_at": session.started_at,
        "completed_at": session.completed_at,
        "overall_score": session.overall_score if session.overall_score is not None else 0.0,
        "avg_technical_score": session.avg_technical_score if session.avg_technical_score is not None else 0.0,
        "avg_communication_score": session.avg_communication_score if session.avg_communication_score is not None else 0.0,
        "verdict": session.verdict or "Pending",
    }
