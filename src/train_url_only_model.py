
from pathlib import Path
import json

import joblib
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.ensemble import (
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from feature_extraction import extract_features


# --------------------------------------------------
# 1. Paths
# --------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent

DATA_PATH = ROOT / "dataset" / "dataset_phishing.csv"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "results"

MODEL_PATH = MODEL_DIR / "phishing_url_only_model.joblib"
METRICS_PATH = RESULTS_DIR / "url_only_evaluation.json"
COMPARISON_PATH = RESULTS_DIR / "url_only_model_comparison.csv"
MATRIX_PATH = RESULTS_DIR / "url_only_confusion_matrix.png"


def main():
    MODEL_DIR.mkdir(exist_ok=True)
    RESULTS_DIR.mkdir(exist_ok=True)

    # --------------------------------------------------
    # 2. Load original URL and label columns
    # --------------------------------------------------

    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    df.columns = df.columns.str.strip()

    if not {"url", "status"}.issubset(df.columns):
        raise ValueError("The dataset must contain url and status.")

    df["url"] = df["url"].astype("string").str.strip()
    df["status"] = (
        df["status"].astype("string").str.strip().str.lower()
    )

    df = df.dropna(subset=["url", "status"]).copy()
    df = df[df["url"] != ""].copy()

    label_map = {"legitimate": 0, "phishing": 1}

    unknown_labels = set(df["status"].unique()) - set(label_map)

    if unknown_labels:
        raise ValueError(f"Unexpected labels: {unknown_labels}")

    df["label"] = df["status"].map(label_map).astype(int)

    # Remove URLs with contradictory labels.
    label_counts = df.groupby("url")["label"].nunique()
    conflicting_urls = label_counts[label_counts > 1].index

    if len(conflicting_urls):
        df = df[~df["url"].isin(conflicting_urls)].copy()

    # Keep one example of each exact URL.
    df = df.drop_duplicates(subset=["url"]).reset_index(drop=True)

    print("=" * 55)
    print("URL-ONLY PHISHING DETECTION")
    print("=" * 55)
    print("Dataset records:", len(df))
    print("Legitimate:", int((df["label"] == 0).sum()))
    print("Phishing:", int((df["label"] == 1).sum()))

    # --------------------------------------------------
    # 3. Extract features from each URL
    # --------------------------------------------------

    print("\nExtracting features directly from URLs...")

    feature_records = []

    for index, url in enumerate(df["url"], start=1):
        feature_records.append(extract_features(url))

        if index % 2000 == 0:
            print(f"Processed {index} URLs...")

    X = pd.DataFrame(feature_records)
    y = df["label"].reset_index(drop=True)

    if X.empty or X.isna().any().any():
        raise ValueError("Feature extraction produced empty or missing data.")

    if not np.isfinite(X.to_numpy(dtype=float)).all():
        raise ValueError("Feature extraction produced infinite values.")

    feature_names = X.columns.tolist()

    print("URL-derived feature count:", len(feature_names))
    print("Feature extraction completed.")

    # --------------------------------------------------
    # 4. Split into training, validation and test data
    # --------------------------------------------------

    X_train, X_temp, y_train, y_temp = train_test_split(
        X,
        y,
        test_size=0.30,
        random_state=42,
        stratify=y,
    )

    X_val, X_test, y_val, y_test = train_test_split(
        X_temp,
        y_temp,
        test_size=0.50,
        random_state=42,
        stratify=y_temp,
    )

    print("\nData split:")
    print("Training:", len(X_train))
    print("Validation:", len(X_val))
    print("Testing:", len(X_test))

    # --------------------------------------------------
    # 5. Train and compare models
    # --------------------------------------------------

    candidates = {
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        ),

        "Extra Trees": ExtraTreesClassifier(
            n_estimators=200,
            max_features="sqrt",
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),

        "Logistic Regression": make_pipeline(
            StandardScaler(),
            LogisticRegression(
                max_iter=2000,
                class_weight="balanced",
                random_state=42,
            ),
        ),

        "Histogram Gradient Boosting":
            HistGradientBoostingClassifier(
                max_iter=120,
                learning_rate=0.1,
                l2_regularization=1.0,
                random_state=42,
            ),
    }

    fitted_models = {}
    results = []

    for name, model in candidates.items():
        print(f"\nTraining {name}...")
        model.fit(X_train, y_train)

        predictions = model.predict(X_val)

        accuracy = accuracy_score(y_val, predictions)
        precision = precision_score(
            y_val, predictions, zero_division=0
        )
        recall = recall_score(
            y_val, predictions, zero_division=0
        )
        f1 = f1_score(
            y_val, predictions, zero_division=0
        )

        results.append({
            "model": name,
            "validation_accuracy": accuracy,
            "phishing_precision": precision,
            "phishing_recall": recall,
            "phishing_f1": f1,
        })

        fitted_models[name] = model

        print(f"Validation accuracy: {accuracy:.2%}")
        print(f"Phishing precision: {precision:.2%}")
        print(f"Phishing recall: {recall:.2%}")
        print(f"Phishing F1-score: {f1:.2%}")

    results.sort(
        key=lambda item: (
            item["phishing_f1"],
            item["validation_accuracy"],
        ),
        reverse=True,
    )

    pd.DataFrame(results).to_csv(COMPARISON_PATH, index=False)

    print("\n===== VALIDATION COMPARISON =====")
    print(pd.DataFrame(results).to_string(index=False))

    best_name = results[0]["model"]
    best_model = fitted_models[best_name]

    print("\nSelected model:", best_name)

    # Refit without using the held-out test set.
    X_train_val = pd.concat([X_train, X_val])
    y_train_val = pd.concat([y_train, y_val])

    print("\nRefitting selected model...")
    best_model.fit(X_train_val, y_train_val)

    # --------------------------------------------------
    # 6. Final evaluation on the held-out test set
    # --------------------------------------------------

    test_predictions = best_model.predict(X_test)

    accuracy = accuracy_score(y_test, test_predictions)
    precision = precision_score(
        y_test, test_predictions, zero_division=0
    )
    recall = recall_score(
        y_test, test_predictions, zero_division=0
    )
    f1 = f1_score(
        y_test, test_predictions, zero_division=0
    )

    print("\n===== FINAL TEST RESULTS =====")
    print(f"Test accuracy: {accuracy:.2%}")
    print(f"Phishing precision: {precision:.2%}")
    print(f"Phishing recall: {recall:.2%}")
    print(f"Phishing F1-score: {f1:.2%}")

    print("\nClassification report:")
    print(classification_report(
        y_test,
        test_predictions,
        labels=[0, 1],
        target_names=["legitimate", "phishing"],
        digits=4,
        zero_division=0,
    ))

    # --------------------------------------------------
    # 7. Save confusion matrix
    # --------------------------------------------------

    cm = confusion_matrix(y_test, test_predictions, labels=[0, 1])

    display = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=["Legitimate", "Phishing"],
    )

    display.plot(values_format="d")
    plt.title("URL-Only Model: Held-Out Test Results")
    plt.tight_layout()
    plt.savefig(MATRIX_PATH, dpi=150)
    plt.close()

    # --------------------------------------------------
    # 8. Save model and feature names
    # --------------------------------------------------

    bundle = {
        "model": best_model,
        "feature_names": feature_names,
        "label_mapping": {
            0: "legitimate",
            1: "phishing",
        },
        "selected_model": best_name,
        "input_mode": "url_only",
    }

    joblib.dump(bundle, MODEL_PATH)

    metrics = {
        "selected_model": best_name,
        "feature_count": len(feature_names),
        "dataset_rows": len(df),
        "test_set_size": len(X_test),
        "test_accuracy": float(accuracy),
        "phishing_precision": float(precision),
        "phishing_recall": float(recall),
        "phishing_f1": float(f1),
        "confusion_matrix": cm.tolist(),
        "feature_names": feature_names,
        "validation_comparison": results,
    }

    with open(METRICS_PATH, "w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)

    print("\n===== SAVED OUTPUTS =====")
    print("Model:", MODEL_PATH)
    print("Metrics:", METRICS_PATH)
    print("Comparison:", COMPARISON_PATH)
    print("Confusion matrix:", MATRIX_PATH)

    if accuracy >= 0.90:
        print("\nURL-ONLY TEST ACCURACY TARGET ACHIEVED.")
    else:
        print(
            "\nURL-ONLY TEST ACCURACY IS BELOW 90%. "
            "Review the results before changing the model."
        )

    print(
        "\nEvaluation uses a stratified random split. "
        "Performance on entirely new domains may differ."
    )


if __name__ == "__main__":
    main()
