
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


# --------------------------------------------------
# 1. Project paths
# --------------------------------------------------

PROJECT_DIR = Path(__file__).resolve().parent.parent

DATA_PATH = PROJECT_DIR / "dataset" / "cleaned_dataset.csv"
MODEL_DIR = PROJECT_DIR / "models"
RESULTS_DIR = PROJECT_DIR / "results"

MODEL_PATH = MODEL_DIR / "phishing_model.joblib"
COMPARISON_PATH = RESULTS_DIR / "model_comparison.csv"
REPORT_PATH = RESULTS_DIR / "evaluation.json"
CONFUSION_PATH = RESULTS_DIR / "confusion_matrix.png"


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # --------------------------------------------------
    # 2. Load and validate data
    # --------------------------------------------------

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Cleaned dataset not found: {DATA_PATH}\n"
            "Run python src/prepare_dataset.py first."
        )

    df = pd.read_csv(DATA_PATH)

    if not {"url", "label"}.issubset(df.columns):
        raise ValueError(
            "Dataset must contain 'url' and 'label' columns."
        )

    # The URL is retained for reference but is not an
    # input feature. The label is the prediction target.
    feature_cols = [
        column for column in df.columns
        if column not in {"url", "label"}
    ]

    X = df[feature_cols].apply(pd.to_numeric, errors="raise")
    y = df["label"].astype(int)

    if set(y.unique()) != {0, 1}:
        raise ValueError(
            "Expected labels 0 (legitimate) and 1 (phishing)."
        )

    if X.isna().any().any():
        raise ValueError("Missing feature values detected.")

    if not np.isfinite(X.to_numpy(dtype=float)).all():
        raise ValueError("Infinite feature values detected.")

    if len(feature_cols) == 0:
        raise ValueError("No feature columns were found.")

    print("=" * 55)
    print("PHISHING URL DETECTION - MODEL TRAINING")
    print("=" * 55)
    print("Dataset rows:", len(df))
    print("Feature count:", len(feature_cols))
    print("Legitimate:", int((y == 0).sum()))
    print("Phishing:", int((y == 1).sum()))

    # --------------------------------------------------
    # 3. Create training, validation and test sets
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
    # 4. Define candidate models
    # --------------------------------------------------

    models = {
        "Random Forest": RandomForestClassifier(
            n_estimators=250,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        ),

        "Extra Trees": ExtraTreesClassifier(
            n_estimators=250,
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
                max_iter=150,
                learning_rate=0.1,
                l2_regularization=1.0,
                random_state=42,
            ),
    }

    # --------------------------------------------------
    # 5. Train on training data and compare on validation
    # --------------------------------------------------

    validation_results = []
    fitted_models = {}

    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(X_train, y_train)

        val_predictions = model.predict(X_val)

        val_accuracy = accuracy_score(y_val, val_predictions)
        val_precision = precision_score(
            y_val, val_predictions, zero_division=0
        )
        val_recall = recall_score(
            y_val, val_predictions, zero_division=0
        )
        val_f1 = f1_score(
            y_val, val_predictions, zero_division=0
        )

        validation_results.append({
            "model": name,
            "validation_accuracy": val_accuracy,
            "validation_precision_phishing": val_precision,
            "validation_recall_phishing": val_recall,
            "validation_f1_phishing": val_f1,
        })

        fitted_models[name] = model

        print(f"Validation accuracy: {val_accuracy:.2%}")
        print(f"Phishing precision:  {val_precision:.2%}")
        print(f"Phishing recall:     {val_recall:.2%}")
        print(f"Phishing F1-score:   {val_f1:.2%}")

    # Select using validation results, not test results.
    validation_results.sort(
        key=lambda row: (
            row["validation_f1_phishing"],
            row["validation_accuracy"],
        ),
        reverse=True,
    )

    comparison_df = pd.DataFrame(validation_results)
    comparison_df.to_csv(COMPARISON_PATH, index=False)

    print("\n" + "=" * 55)
    print("VALIDATION MODEL COMPARISON")
    print("=" * 55)
    print(
        comparison_df.to_string(
            index=False,
            formatters={
                column: "{:.4f}".format
                for column in comparison_df.select_dtypes(
                    include="number"
                ).columns
            },
        )
    )

    best_name = validation_results[0]["model"]
    best_model = fitted_models[best_name]

    print("\nSelected model:", best_name)
    print("Selection criterion: validation phishing F1-score")

    # --------------------------------------------------
    # 6. Refit selected model on training + validation
    # --------------------------------------------------

    X_train_val = pd.concat([X_train, X_val], axis=0)
    y_train_val = pd.concat([y_train, y_val], axis=0)

    print("\nRefitting selected model on training + validation...")
    best_model.fit(X_train_val, y_train_val)

    # --------------------------------------------------
    # 7. Evaluate ONCE on the held-out test set
    # --------------------------------------------------

    test_predictions = best_model.predict(X_test)

    test_accuracy = accuracy_score(y_test, test_predictions)
    test_precision = precision_score(
        y_test, test_predictions, zero_division=0
    )
    test_recall = recall_score(
        y_test, test_predictions, zero_division=0
    )
    test_f1 = f1_score(
        y_test, test_predictions, zero_division=0
    )

    print("\n" + "=" * 55)
    print("FINAL HELD-OUT TEST RESULTS")
    print("=" * 55)
    print(f"Test accuracy:       {test_accuracy:.2%}")
    print(f"Phishing precision:  {test_precision:.2%}")
    print(f"Phishing recall:     {test_recall:.2%}")
    print(f"Phishing F1-score:   {test_f1:.2%}")

    report_text = classification_report(
        y_test,
        test_predictions,
        labels=[0, 1],
        target_names=["legitimate", "phishing"],
        digits=4,
        zero_division=0,
    )

    print("\nClassification report:")
    print(report_text)

    # --------------------------------------------------
    # 8. Save the confusion matrix
    # --------------------------------------------------

    matrix = confusion_matrix(
        y_test, test_predictions, labels=[0, 1]
    )

    display = ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=["Legitimate", "Phishing"],
    )

    display.plot(values_format="d")
    plt.title("Phishing Detection - Held-out Test Set")
    plt.tight_layout()
    plt.savefig(CONFUSION_PATH, dpi=150)
    plt.close()

    # --------------------------------------------------
    # 9. Save the model and feature schema
    # --------------------------------------------------

    bundle = {
        "model": best_model,
        "feature_names": feature_cols,
        "label_mapping": {
            0: "legitimate",
            1: "phishing",
        },
        "selected_model": best_name,
    }

    joblib.dump(bundle, MODEL_PATH)

    # Store measured evaluation results.
    evaluation = {
        "dataset_rows": int(len(df)),
        "feature_count": int(len(feature_cols)),
        "selected_model": best_name,
        "selection_metric": "validation_f1_phishing",
        "validation_comparison": validation_results,
        "test_metrics": {
            "accuracy": float(test_accuracy),
            "precision_phishing": float(test_precision),
            "recall_phishing": float(test_recall),
            "f1_phishing": float(test_f1),
        },
        "classification_report": classification_report(
            y_test,
            test_predictions,
            labels=[0, 1],
            target_names=["legitimate", "phishing"],
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": matrix.tolist(),
        "test_set_size": int(len(X_test)),
        "random_state": 42,
        "feature_names": feature_cols,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as file:
        json.dump(evaluation, file, indent=2)

    # --------------------------------------------------
    # 10. Final summary
    # --------------------------------------------------

    print("\n" + "=" * 55)
    print("TRAINING COMPLETED")
    print("=" * 55)
    print("Selected model:", best_name)
    print(f"Final test accuracy: {test_accuracy:.2%}")
    print("Saved model:", MODEL_PATH)
    print("Saved comparison:", COMPARISON_PATH)
    print("Saved report:", REPORT_PATH)
    print("Saved confusion matrix:", CONFUSION_PATH)

    if test_accuracy >= 0.90:
        print("\nTARGET ACHIEVED: Test accuracy is at least 90%.")
    else:
        print(
            "\nTARGET NOT YET ACHIEVED: Test accuracy is below 90%. "
            "Review results before making improvements."
        )

    print(
        "\nNote: this model expects the complete saved feature set. "
        "A URL-only live prediction service will need matching "
        "feature extraction or enrichment."
    )


if __name__ == "__main__":
    main()
