from pathlib import Path

import joblib
import pandas as pd

from feature_extraction import extract_features


PROJECT_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    PROJECT_DIR / "models" / "phishing_url_only_model.joblib"
)


def predict_url(url):
    # Load the saved URL-only model.
    bundle = joblib.load(MODEL_PATH)

    model = bundle["model"]
    feature_names = bundle["feature_names"]

    # Calculate numerical features from the submitted URL.
    features = extract_features(url)

    # Use exactly the features and order expected by the model.
    missing = [
        name for name in feature_names
        if name not in features
    ]

    if missing:
        raise ValueError(
            f"Feature extractor is missing: {missing}"
        )

    input_data = pd.DataFrame(
        [[features[name] for name in feature_names]],
        columns=feature_names,
    )

    prediction = int(model.predict(input_data)[0])

    result = {
        0: "Legitimate",
        1: "Phishing",
    }[prediction]

    return result


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"URL-only model not found: {MODEL_PATH}"
        )

    url = input("Enter a URL to check: ").strip()

    if not url:
        print("Please enter a URL.")
        return

    try:
        result = predict_url(url)

        print("\n========== PREDICTION ==========")
        print("URL:", url)
        print("Result:", result)
        print("================================")

    except Exception as exc:
        print("Prediction failed:", exc)


if __name__ == "__main__":
    main()