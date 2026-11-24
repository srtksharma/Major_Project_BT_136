"""Main FastAPI Application for LinkLens Phishing URL Detection."""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import (
    CORS_ORIGINS,
    MODEL_PATH,
    DATABASE_PATH,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS
)
from app.core.database import init_db
from app.core.rate_limiter import SlidingWindowRateLimiter
from app.ml.predictor import predictor_service
from app.api.routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("linklens-backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    logger.info("Initializing LinkLens Backend...")

    # 1. Initialize SQLite Database
    logger.info("Initializing SQLite database at: %s", DATABASE_PATH)
    init_db()

    # 2. Preload Machine Learning Model
    logger.info("Loading ML model from: %s", MODEL_PATH)
    try:
        predictor_service.load_model()
        logger.info(
            "Model loaded successfully: '%s' (%d features)",
            predictor_service.model_name,
            len(predictor_service.feature_names)
        )
    except Exception as exc:
        logger.error("Failed to load ML model: %s", exc)

    logger.info("LinkLens Backend is ready to accept requests.")
    yield
    logger.info("Shutting down LinkLens Backend.")


# Create FastAPI application
app = FastAPI(
    title="LinkLens Phishing URL Detection API",
    description="Real-time ML-powered Phishing URL Detection and Explainability Engine.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 1. Rate Limiting Middleware
app.add_middleware(
    SlidingWindowRateLimiter,
    max_requests=RATE_LIMIT_REQUESTS,
    window_seconds=RATE_LIMIT_WINDOW_SECONDS
)

# 2. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],
)

# 3. Include API Routes
app.include_router(api_router)


@app.get("/health", tags=["Monitoring"], summary="Root health check")
async def root_health():
    """Root health probe for monitoring agents and container orchestrators."""
    return {
        "status": "ok",
        "service": "LinkLens Phishing Detection API",
        "model_ready": predictor_service.is_ready,
        "model_name": predictor_service.model_name
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
