"""SQLite database persistence layer for LinkLens scan history."""

import sqlite3
import json
from typing import List, Optional, Dict, Any
from pathlib import Path
from contextlib import contextmanager

from app.config import DATABASE_PATH, MAX_HISTORY_LIMIT
from app.schemas.scan import ScanResult, ScanFeature, Verdict, ScanStats


@contextmanager
def get_db():
    """Context manager for SQLite database connection."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables and indices."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                verdict TEXT NOT NULL,
                confidence REAL NOT NULL,
                scanned_at TEXT NOT NULL,
                features_json TEXT NOT NULL,
                client_ip TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_scans_scanned_at 
            ON scans(scanned_at DESC)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_scans_verdict 
            ON scans(verdict)
        """)
        conn.commit()


def row_to_scan_result(row: sqlite3.Row) -> ScanResult:
    """Convert an SQLite row to a ScanResult Pydantic model."""
    raw_features = json.loads(row["features_json"])
    features = [
        ScanFeature(
            name=f["name"],
            value=f["value"],
            impact=float(f["impact"]),
            description=f["description"]
        )
        for f in raw_features
    ]
    return ScanResult(
        id=row["id"],
        url=row["url"],
        verdict=Verdict(row["verdict"]),
        confidence=float(row["confidence"]),
        scannedAt=row["scanned_at"],
        features=features
    )


def save_scan(result: ScanResult, client_ip: str = "") -> ScanResult:
    """Save a scan result to the database."""
    features_json = json.dumps([f.model_dump() for f in result.features])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scans (id, url, verdict, confidence, scanned_at, features_json, client_ip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            result.id,
            result.url,
            result.verdict.value,
            result.confidence,
            result.scannedAt,
            features_json,
            client_ip
        ))
        conn.commit()
    return result


def get_history(limit: int = MAX_HISTORY_LIMIT) -> List[ScanResult]:
    """Retrieve scan history, most recent first (up to limit)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, url, verdict, confidence, scanned_at, features_json
            FROM scans
            ORDER BY scanned_at DESC, created_at DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [row_to_scan_result(r) for r in rows]


def get_scan_by_id(scan_id: str) -> Optional[ScanResult]:
    """Retrieve a single scan result by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, url, verdict, confidence, scanned_at, features_json
            FROM scans
            WHERE id = ?
        """, (scan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_scan_result(row)


def get_stats() -> ScanStats:
    """Compute aggregated scan metrics for the dashboard."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN verdict = 'safe' THEN 1 ELSE 0 END) as safe_c,
                SUM(CASE WHEN verdict = 'suspicious' THEN 1 ELSE 0 END) as susp_c,
                SUM(CASE WHEN verdict = 'phishing' THEN 1 ELSE 0 END) as phish_c,
                AVG(confidence) as avg_conf
            FROM scans
        """)
        row = cursor.fetchone()
        total = row["total"] or 0
        safe = row["safe_c"] or 0
        susp = row["susp_c"] or 0
        phish = row["phish_c"] or 0
        avg_c = round(row["avg_conf"] or 0.0, 1)

        safe_pct = round((safe / total * 100), 1) if total > 0 else 0.0
        phish_pct = round((phish / total * 100), 1) if total > 0 else 0.0

        return ScanStats(
            total_scans=total,
            safe_count=safe,
            suspicious_count=susp,
            phishing_count=phish,
            safe_percentage=safe_pct,
            phishing_percentage=phish_pct,
            avg_confidence=avg_c
        )


def clear_history() -> int:
    """Clear all stored scan history and return count of deleted records."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM scans")
        count = cursor.fetchone()[0]
        cursor.execute("DELETE FROM scans")
        conn.commit()
        return count
