
from pathlib import Path

import joblib
import pandas as pd

PROJECT_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = PROJECT_DIR / "models" / "phishing_model.joblib"
DATA_PATH = PROJECT_DIR / "dataset" / "cleaned_dataset.csv"


def main():
    print("Loading saved model...")

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

    bundle = joblib.load(MODEL_PATH)
    df = pd.read_csv(DATA_PATH)

    model = bundle["model"]
    feature_names = bundle["feature_names"]

    missing = [c for c in feature_names if c not in df.columns]

    if missing:
        raise ValueError(f"Required features missing: {missing}")

    # Use one dataset row to verify that the saved artifact
    # accepts the expected feature schema and returns a prediction.
    sample = df[feature_names].iloc[[0]]
    actual_label = int(df["label"].iloc[0])

    prediction = int(model.predict(sample)[0])

    labels = {
        0: "Legitimate",
        1: "Phishing",
    }

    print("\nMODEL VERIFICATION SUCCESSFUL")
    print("Selected algorithm:", bundle["selected_model"])
    print("Expected feature count:", len(feature_names))
    print("Sample URL:", df["url"].iloc[0])
    print("Dataset label:", labels[actual_label])
    print("Model prediction:", labels[prediction])

    print(
        "\nThis is an inference smoke test, not a new accuracy "
        "measurement. The sample may have been used during training."
    )


if __name__ == "__main__":
    main()
