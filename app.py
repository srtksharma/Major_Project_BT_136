
from pathlib import Path
from urllib.parse import urlsplit

import joblib
import pandas as pd
from flask import Flask, jsonify, request

from src.feature_extraction import extract_features


# --------------------------------------------------
# Paths and model loading
# --------------------------------------------------

PROJECT_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    PROJECT_DIR / "models" / "phishing_url_only_model.joblib"
)

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Trained URL-only model not found: {MODEL_PATH}"
    )

# Load the model once when the server starts.
bundle = joblib.load(MODEL_PATH)

model = bundle["model"]
feature_names = bundle["feature_names"]
model_name = bundle["selected_model"]

app = Flask(__name__)


def validate_and_normalize_url(raw_url):
    """Validate basic URL syntax without opening the website."""

    if not isinstance(raw_url, str) or not raw_url.strip():
        raise ValueError("Please provide a non-empty URL.")

    url = raw_url.strip()

    if any(char.isspace() for char in url):
        raise ValueError("The URL must not contain whitespace.")

    # Accept a domain supplied without a scheme.
    candidate = (
        url if "://" in url else f"https://{url}"
    )

    try:
        parsed = urlsplit(candidate)

        if parsed.scheme.lower() not in {"http", "https"}:
            raise ValueError("Only HTTP and HTTPS URLs are supported.")

        if not parsed.hostname:
            raise ValueError("The URL must contain a hostname.")

        # Accessing .port checks whether the port is syntactically valid.
        _ = parsed.port

    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid URL: {exc}") from exc

    return candidate


@app.get("/health")
def health():
    """Check whether the API and model are available."""

    return jsonify({
        "status": "ok",
        "model": model_name,
        "feature_count": len(feature_names),
    })


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    """Return a prediction for a submitted URL."""

    if request.method == "OPTIONS":
        return "", 204

    if not request.is_json:
        return jsonify({
            "error": "Send the request as application/json."
        }), 415

    payload = request.get_json(silent=True)

    if not isinstance(payload, dict):
        return jsonify({
            "error": "The JSON body must be an object."
        }), 400

    try:
        url = validate_and_normalize_url(payload.get("url"))

        # Generate the same feature set used during training.
        features = extract_features(url)

        missing = [
            name for name in feature_names
            if name not in features
        ]

        if missing:
            raise RuntimeError(
                f"Feature extractor is missing: {missing}"
            )

        # Preserve the exact feature order expected by the model.
        input_data = pd.DataFrame(
            [[features[name] for name in feature_names]],
            columns=feature_names,
        )

        prediction = int(model.predict(input_data)[0])

        result = {
            0: "Legitimate",
            1: "Phishing",
        }[prediction]

        return jsonify({
            "url": url,
            "prediction": result,
            "label": prediction,
            "model": model_name,
            "note": (
                "This is a machine-learning prediction, "
                "not a guarantee that the URL is safe."
            ),
        })

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    except Exception:
        app.logger.exception("Prediction failed")

        return jsonify({
            "error": "Prediction failed. Check the server logs."
        }), 500


@app.after_request
def add_local_development_cors(response):
    # Convenient for local React/Vite development.
    # Restrict this to trusted frontend origins before deployment.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"

    return response


if __name__ == "__main__":
    print("Phishing URL Detection API")
    print("Model:", model_name)
    print("Features:", len(feature_names))
    print("Health endpoint: http://127.0.0.1:5000/health")
    print("Prediction endpoint: http://127.0.0.1:5000/predict")

    app.run(host="127.0.0.1", port=5000, debug=False)
