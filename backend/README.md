# LinkLens Backend — Phishing URL Detection & Explainability API

High-performance, production-ready FastAPI backend serving the pre-trained machine learning model (`phishing_url_only_model.joblib`) for real-time URL classification, feature attribution explainability, scan persistence, and rate-limiting.

Built to integrate seamlessly with the **LinkLens Next.js** frontend.

---

## 1. Features

- **Fast & Asynchronous**: Built with FastAPI and Uvicorn.
- **Strict Contract Compliance**: Matches the frontend's TypeScript interfaces and Zod runtime schemas (`src/types/api.ts` & `src/lib/schemas.ts`).
- **Real-Time ML Inference**: Loads `HistGradientBoostingClassifier` with `predict_proba` for calibrated risk estimation.
- **Feature Attribution Explainability**: Generates user-friendly `ScanFeature` signals with impact scores (-1.0 protective to +1.0 risky) and plain-language descriptions.
- **SQLite History Persistence**: Stores past scans with automatic schema migration and fast indexed queries.
- **Abuse & Rate Limiting**: Sliding window rate limiter returning `429 Too Many Requests` with `Retry-After: 30` header.
- **Interactive Documentation**: Auto-generated Swagger UI (`/docs`) and ReDoc (`/redoc`).

---

## 2. API Contract

### `POST /api/scan`
Submits a URL to be scanned.

**Request:**
```json
{
  "url": "https://example.com/login"
}
```

**Response (`200 OK`):**
```json
{
  "id": "scan_8f1a2b3c4d5e",
  "url": "https://example.com/login",
  "verdict": "safe",
  "confidence": 92.5,
  "scannedAt": "2026-11-24T08:30:00.000Z",
  "features": [
    {
      "name": "Established domain",
      "value": "example.com",
      "impact": -0.85,
      "description": "The domain is widely recognised and long-lived..."
    },
    {
      "name": "HTTPS",
      "value": "Present",
      "impact": -0.30,
      "description": "The connection is encrypted..."
    }
  ]
}
```

### `GET /api/history`
Returns past scan records, most recent first (up to 1000 items).

### `GET /api/history/{scan_id}`
Returns details for a specific past scan.

### `GET /api/stats`
Returns aggregated scan statistics (total scans, safe/suspicious/phishing counts, safe percentage, average confidence).

### `GET /api/health` or `/health`
Returns system and model readiness status.

---

## 3. Installation & Setup

### Prerequisites
- Python 3.10+ (tested with Python 3.13)
- pip

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run the Backend
```bash
python run.py
```
Or directly with Uvicorn:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Server endpoints:
- Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- API Health: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- API Scan: [http://localhost:8000/api/scan](http://localhost:8000/api/scan)
- API History: [http://localhost:8000/api/history](http://localhost:8000/api/history)

---

## 4. Connecting Frontend to this Backend

To connect the Next.js frontend to this backend:

1. Navigate to the `frontend` folder:
   ```bash
   cd ../frontend
   ```

2. Create `.env.local` containing:
   ```env
   NEXT_PUBLIC_USE_MOCK=false
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. Restart or build the frontend:
   ```bash
   npm run dev
   ```

The frontend will now make real calls to `http://localhost:8000/api/scan` and `http://localhost:8000/api/history`, and the "Demo mode" watermark will disappear automatically.

---

## 5. Running Tests

Run the test suite:
```bash
python -m pytest tests/ -v
```
Or run the built-in test runner:
```bash
python tests/test_api.py
```
