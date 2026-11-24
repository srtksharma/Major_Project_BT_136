"""Integration tests for LinkLens API endpoints using pure ASGI invocation."""

import sys
import json
import asyncio
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app
from app.core.database import clear_history, init_db
from app.ml.predictor import predictor_service


async def asgi_request(app, method: str, path: str, headers: dict = None, body: any = None):
    """Zero-dependency ASGI test caller that exercises the full middleware + route stack."""
    headers = headers or {}
    raw_headers = [
        (k.lower().encode("latin1"), v.encode("latin1"))
        for k, v in headers.items()
    ]
    if isinstance(body, dict):
        body_bytes = json.dumps(body).encode("utf-8")
        if not any(k == b"content-type" for k, _ in raw_headers):
            raw_headers.append((b"content-type", b"application/json"))
    elif isinstance(body, bytes):
        body_bytes = body
    elif isinstance(body, str):
        body_bytes = body.encode("utf-8")
    else:
        body_bytes = b""

    # Parse path and query
    if "?" in path:
        path_part, query_part = path.split("?", 1)
    else:
        path_part, query_part = path, ""

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method.upper(),
        "path": path_part,
        "raw_path": path_part.encode("latin1"),
        "query_string": query_part.encode("latin1"),
        "headers": raw_headers,
        "client": ("127.0.0.1", 54321),
        "server": ("127.0.0.1", 8000),
    }

    response_messages = []
    has_sent_body = False

    async def receive():
        nonlocal has_sent_body
        if not has_sent_body:
            has_sent_body = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        response_messages.append(message)

    await app(scope, receive, send)

    status_code = None
    res_headers = {}
    res_body = b""

    for msg in response_messages:
        if msg["type"] == "http.response.start":
            status_code = msg["status"]
            res_headers = {
                k.decode("latin1").lower(): v.decode("latin1")
                for k, v in msg.get("headers", [])
            }
        elif msg["type"] == "http.response.body":
            res_body += msg.get("body", b"")

    try:
        json_data = json.loads(res_body.decode("utf-8")) if res_body else None
    except Exception:
        json_data = None

    return status_code, res_headers, json_data


def run_async(coro):
    return asyncio.run(coro)


def setup():
    init_db()
    predictor_service.load_model()
    clear_history()


def test_health_endpoints():
    print("Testing /health and /api/health...")
    status, headers, data = run_async(asgi_request(app, "GET", "/health"))
    assert status == 200, f"Expected 200, got {status}"
    assert data["status"] == "ok"
    assert data["model_ready"] is True

    status, headers, data = run_async(asgi_request(app, "GET", "/api/health"))
    assert status == 200, f"Expected 200, got {status}"
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert data["feature_count"] == 26
    print("[OK] Health endpoints verified.")


def test_post_scan_safe_url():
    print("Testing POST /api/scan with safe URL...")
    status, headers, data = run_async(
        asgi_request(app, "POST", "/api/scan", body={"url": "https://www.google.com"})
    )
    assert status == 200, f"Expected 200, got {status}: {data}"
    assert data["id"].startswith("scan_")
    assert data["url"] == "https://www.google.com"
    assert data["verdict"] == "safe"
    assert 0 <= data["confidence"] <= 100
    assert "scannedAt" in data
    assert isinstance(data["features"], list)
    assert len(data["features"]) > 0

    # Validate feature contract
    for feat in data["features"]:
        assert "name" in feat
        assert "value" in feat
        assert -1.0 <= feat["impact"] <= 1.0
        assert "description" in feat
    print("[OK] Safe URL scan verified.")


def test_post_scan_phishing_url():
    print("Testing POST /api/scan with phishing URL...")
    phishing_url = "http://secure-login-verify-free-prize.xyz/account/update"
    status, headers, data = run_async(
        asgi_request(app, "POST", "/api/scan", body={"url": phishing_url})
    )
    assert status == 200, f"Expected 200, got {status}: {data}"
    assert data["verdict"] == "phishing"
    assert data["confidence"] >= 70.0
    print("[OK] Phishing URL scan verified.")


def test_post_scan_validation_errors():
    print("Testing input validation...")
    # Empty URL
    status, _, _ = run_async(asgi_request(app, "POST", "/api/scan", body={"url": ""}))
    assert status in (400, 422), f"Expected 400/422, got {status}"

    # Whitespace in URL
    status, _, _ = run_async(asgi_request(app, "POST", "/api/scan", body={"url": "https://foo bar.com"}))
    assert status in (400, 422), f"Expected 400/422, got {status}"

    # Unsupported protocol
    status, _, _ = run_async(asgi_request(app, "POST", "/api/scan", body={"url": "ftp://files.com"}))
    assert status in (400, 422), f"Expected 400/422, got {status}"
    print("[OK] Input validation verified.")


def test_scan_history_persistence():
    print("Testing scan history persistence...")
    clear_history()

    # Initial history is empty
    status, _, data = run_async(asgi_request(app, "GET", "/api/history"))
    assert status == 200
    assert data == []

    # Perform scans
    _, _, scan1 = run_async(asgi_request(app, "POST", "/api/scan", body={"url": "https://www.google.com"}))
    _, _, scan2 = run_async(asgi_request(app, "POST", "/api/scan", body={"url": "http://suspicious-bank-verify.top"}))

    # Fetch history
    status, _, history = run_async(asgi_request(app, "GET", "/api/history"))
    assert status == 200
    assert len(history) == 2
    # Most recent first
    assert history[0]["id"] == scan2["id"]
    assert history[1]["id"] == scan1["id"]

    # Fetch by ID
    status, _, single = run_async(asgi_request(app, "GET", f"/api/history/{scan1['id']}"))
    assert status == 200
    assert single["url"] == "https://www.google.com"

    # Non-existent ID returns 404
    status, _, _ = run_async(asgi_request(app, "GET", "/api/history/scan_nonexistent123"))
    assert status == 404
    print("[OK] Scan history persistence verified.")


def test_dashboard_stats():
    print("Testing /api/stats...")
    status, _, stats = run_async(asgi_request(app, "GET", "/api/stats"))
    assert status == 200
    assert stats["total_scans"] >= 2
    assert "safe_count" in stats
    assert "phishing_count" in stats
    assert "avg_confidence" in stats
    print("[OK] Dashboard stats verified.")


def test_cors_preflight():
    print("Testing CORS preflight...")
    status, headers, _ = run_async(
        asgi_request(
            app,
            "OPTIONS",
            "/api/scan",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            }
        )
    )
    assert status == 200
    assert headers.get("access-control-allow-origin") == "*"
    assert "post" in headers.get("access-control-allow-methods", "").lower()
    print("[OK] CORS preflight verified.")


def test_rate_limiting():
    print("Testing rate limiting and 429 Retry-After...")
    from app.core.rate_limiter import SlidingWindowRateLimiter
    from fastapi import FastAPI
    from starlette.responses import PlainTextResponse

    dummy_app = FastAPI()
    dummy_app.add_middleware(SlidingWindowRateLimiter, max_requests=2, window_seconds=10)

    @dummy_app.get("/test-limit")
    async def limited_endpoint():
        return PlainTextResponse("ok")

    # Request 1 & 2 succeed
    s1, _, _ = run_async(asgi_request(dummy_app, "GET", "/test-limit"))
    s2, _, _ = run_async(asgi_request(dummy_app, "GET", "/test-limit"))
    assert s1 == 200
    assert s2 == 200

    # Request 3 should be blocked with 429 and Retry-After
    s3, headers, data = run_async(asgi_request(dummy_app, "GET", "/test-limit"))
    assert s3 == 429
    assert "retry-after" in headers
    assert int(headers["retry-after"]) > 0
    print("[OK] Rate limiting (429 + Retry-After) verified.")


def main():
    setup()
    test_health_endpoints()
    test_post_scan_safe_url()
    test_post_scan_phishing_url()
    test_post_scan_validation_errors()
    test_scan_history_persistence()
    test_dashboard_stats()
    test_cors_preflight()
    test_rate_limiting()
    print("\n" + "=" * 55)
    print("ALL API INTEGRATION TESTS PASSED (100% SUCCESS)!")
    print("=" * 55)


if __name__ == "__main__":
    main()
