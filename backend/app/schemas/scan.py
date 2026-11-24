"""Pydantic schemas matching the LinkLens Frontend API Contract."""

from enum import Enum
from typing import List, Union, Optional
from pydantic import BaseModel, Field, field_validator


class Verdict(str, Enum):
    SAFE = "safe"
    SUSPICIOUS = "suspicious"
    PHISHING = "phishing"


class ScanRequest(BaseModel):
    """Request payload sent to POST /api/scan."""
    url: str = Field(..., min_length=1, max_length=8192, description="The URL to be scanned.")

    @field_validator("url")
    @classmethod
    def validate_url_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("URL cannot be empty or only whitespace.")
        return trimmed


class ScanFeature(BaseModel):
    """One analyzed signal contributing to the verdict."""
    name: str = Field(..., min_length=1, max_length=200, description="Signal name")
    value: Union[str, int, float] = Field(..., description="Observed feature value")
    impact: float = Field(..., ge=-1.0, le=1.0, description="Impact from -1 (protective) to +1 (risky)")
    description: str = Field(..., max_length=1000, description="Plain-language explanation")

    @field_validator("value")
    @classmethod
    def validate_value_length(cls, value: Union[str, int, float]) -> Union[str, int, float]:
        if isinstance(value, str) and len(value) > 500:
            return value[:497] + "..."
        return value


class ScanResult(BaseModel):
    """A single scan result matching the frontend schema."""
    id: str = Field(..., min_length=1, max_length=200, description="Unique scan ID")
    url: str = Field(..., min_length=1, max_length=8192, description="Echoed scanned URL")
    verdict: Verdict = Field(..., description="Classification verdict")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Model confidence 0-100")
    scannedAt: str = Field(..., min_length=1, max_length=100, description="ISO 8601 UTC timestamp")
    features: List[ScanFeature] = Field(default_factory=list, max_length=50, description="Feature signals")


class ApiError(BaseModel):
    """Standard error response format."""
    message: str = Field(..., description="Error message")
    status: Optional[int] = Field(None, description="HTTP status code")


class ScanStats(BaseModel):
    """Aggregated scan statistics for the dashboard."""
    total_scans: int
    safe_count: int
    suspicious_count: int
    phishing_count: int
    safe_percentage: float
    phishing_percentage: float
    avg_confidence: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model: str
    feature_count: int
    database: str
    version: str
