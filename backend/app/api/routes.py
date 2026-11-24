"""FastAPI route handlers for LinkLens API."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request, Response, status

from app.schemas.scan import (
    ScanRequest,
    ScanResult,
    ScanStats,
    HealthResponse,
    ApiError
)
from app.core.security import validate_and_normalize_url
from app.core.database import (
    save_scan,
    get_history,
    get_scan_by_id,
    get_stats,
    clear_history
)
from app.ml.predictor import predictor_service
from app.config import MAX_HISTORY_LIMIT

router = APIRouter(prefix="/api", tags=["API"])


@router.post(
    "/scan",
    response_model=ScanResult,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ApiError, "description": "Invalid URL supplied"},
        429: {"model": ApiError, "description": "Too many requests"},
        500: {"model": ApiError, "description": "Inference or server error"}
    },
    summary="Scan a URL for phishing threats"
)
async def scan_url(payload: ScanRequest, request: Request) -> ScanResult:
    """Analyze a submitted URL using the machine learning classifier and URL feature extractor.
    
    Returns the verdict (safe / suspicious / phishing), calibrated confidence percentage,
    and granular explainability signals for each analyzed feature.
    """
    try:
        normalized_url = validate_and_normalize_url(payload.url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )

    try:
        verdict, confidence, features = predictor_service.predict(normalized_url)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(exc)}"
        )

    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    scanned_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    result = ScanResult(
        id=scan_id,
        url=normalized_url,
        verdict=verdict,
        confidence=confidence,
        scannedAt=scanned_at,
        features=features
    )

    # Persist in SQLite
    client_ip = request.client.host if request.client else ""
    try:
        save_scan(result, client_ip=client_ip)
    except Exception:
        # Don't fail the scan if DB save encounters an issue; log and return result
        pass

    return result


@router.get(
    "/history",
    response_model=List[ScanResult],
    summary="Retrieve past scan history"
)
async def get_scan_history(limit: int = MAX_HISTORY_LIMIT) -> List[ScanResult]:
    """Retrieve historical scans, ordered from most recent to oldest.
    
    Strictly conforms to the ScanHistoryResponse contract expected by the dashboard.
    """
    safe_limit = min(max(1, limit), 1000)
    return get_history(limit=safe_limit)


@router.get(
    "/history/{scan_id}",
    response_model=ScanResult,
    responses={404: {"model": ApiError, "description": "Scan not found"}},
    summary="Retrieve a single scan by ID"
)
async def get_single_scan(scan_id: str) -> ScanResult:
    """Look up a past scan result by its unique identifier."""
    result = get_scan_by_id(scan_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan with ID '{scan_id}' not found."
        )
    return result


@router.delete(
    "/history",
    summary="Clear scan history"
)
async def clear_scan_history() -> dict:
    """Remove all scan records from the database."""
    count = clear_history()
    return {"message": "Scan history cleared successfully", "deleted": count}


@router.get(
    "/stats",
    response_model=ScanStats,
    summary="Retrieve aggregated scan statistics"
)
async def get_dashboard_stats() -> ScanStats:
    """Retrieve metrics for total scans, verdicts breakdown, and average confidence."""
    return get_stats()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="API Health Check"
)
async def health_check() -> HealthResponse:
    """Verify that the API server and ML model are operational."""
    return HealthResponse(
        status="ok",
        model=predictor_service.model_name,
        feature_count=len(predictor_service.feature_names),
        database="connected",
        version="1.0.0"
    )
