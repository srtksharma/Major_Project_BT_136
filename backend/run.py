#!/usr/bin/env python
"""LinkLens Backend Server Launcher."""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from app.config import HOST, PORT, DEBUG

if __name__ == "__main__":
    print("=" * 60)
    print("  LinkLens Phishing Detection Backend Server")
    print("=" * 60)
    print(f"  Host: {HOST}")
    print(f"  Port: {PORT}")
    print(f"  Swagger Docs: http://localhost:{PORT}/docs")
    print(f"  API Health:   http://localhost:{PORT}/api/health")
    print(f"  Scan API:     http://localhost:{PORT}/api/scan")
    print(f"  History API:  http://localhost:{PORT}/api/history")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG,
        log_level="info"
    )
