"""Sliding window rate limiter middleware with Retry-After support."""

import time
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import (
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    RATE_LIMIT_RETRY_AFTER
)


class SlidingWindowRateLimiter(BaseHTTPMiddleware):
    """In-memory sliding window rate limiter.
    
    Tracks request timestamps per client IP. If a client exceeds the limit,
    returns 429 Too Many Requests with the required 'Retry-After' header.
    """

    def __init__(self, app, max_requests: int = RATE_LIMIT_REQUESTS, window_seconds: int = RATE_LIMIT_WINDOW_SECONDS):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = {}

    def get_client_ip(self, request: Request) -> str:
        """Extract client IP, respecting X-Forwarded-For if present."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "127.0.0.1"

    async def dispatch(self, request: Request, call_next):
        # Exempt preflight OPTIONS and health checks from rate limiting
        if request.method == "OPTIONS" or request.url.path in ("/health", "/api/health"):
            return await call_next(request)

        client_ip = self.get_client_ip(request)
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean timestamps older than the window
        timestamps = [ts for ts in self.requests.get(client_ip, []) if ts > cutoff]

        if len(timestamps) >= self.max_requests:
            retry_after = RATE_LIMIT_RETRY_AFTER
            headers = {
                "Retry-After": str(retry_after),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Retry-After"
            }
            return JSONResponse(
                status_code=429,
                content={
                    "message": f"Too many requests — the scan service is busy. Please try again in {retry_after} seconds."
                },
                headers=headers
            )

        timestamps.append(now)
        self.requests[client_ip] = timestamps

        response = await call_next(request)
        return response
