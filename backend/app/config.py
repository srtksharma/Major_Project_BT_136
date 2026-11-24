"""Configuration settings for LinkLens Backend."""

from pathlib import Path
import os

# Base directory for backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
# Main project directory (parent of backend, containing models, frontend, dataset, src)
PROJECT_DIR = BACKEND_DIR.parent

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

# CORS configuration
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

# Database path
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "linklens.db"
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB_PATH)))

# Machine Learning model path
DEFAULT_MODEL_PATH = PROJECT_DIR / "models" / "phishing_url_only_model.joblib"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH)))

# Rate limiting
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_RETRY_AFTER = int(os.getenv("RATE_LIMIT_RETRY_AFTER", "30"))

# Max history entries to return
MAX_HISTORY_LIMIT = int(os.getenv("MAX_HISTORY_LIMIT", "1000"))
