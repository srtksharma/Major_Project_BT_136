from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = PROJECT_DIR / "dataset" / "dataset_phishing.csv"


def main():
    df = pd.read_csv(DATASET_PATH)
    df.columns = df.columns.str.strip()

    print("\n===== DATASET SUMMARY =====")
    print("Rows:", len(df))
    print("Columns:", len(df.columns))

    if not {"url", "status"}.issubset(df.columns):
        raise ValueError("Expected url and status columns.")

    # The URL identifies each record; status is the target.
    feature_cols = [
        col for col in df.columns
        if col not in {"url", "status"}
    ]

    print("\n===== TARGET LABELS =====")
    print(df["status"].astype(str).str.strip().str.lower()
          .value_counts(dropna=False).to_string())

    print("\n===== FEATURE COUNT =====")
    print("Candidate features:", len(feature_cols))

    print("\n===== NON-NUMERIC FEATURES =====")
    non_numeric = [
        col for col in feature_cols
        if not pd.api.types.is_numeric_dtype(df[col])
    ]
    print(non_numeric if non_numeric else "None found")

    # Check values that cannot be converted to numbers.
    numeric = df[feature_cols].apply(
        pd.to_numeric, errors="coerce"
    )

    invalid_counts = {}
    for col in feature_cols:
        invalid = numeric[col].isna() & df[col].notna()
        if invalid.any():
            invalid_counts[col] = int(invalid.sum())

    print("\n===== INVALID NUMERIC VALUES =====")
    print(invalid_counts if invalid_counts else "None found")

    # Missing values and infinite values.
    print("\n===== MISSING VALUES =====")
    missing = df[feature_cols].isna().sum()
    print(missing[missing > 0].to_string()
          if missing.any() else "None found")

    print("\n===== INFINITE VALUES =====")
    numeric_array = numeric.to_numpy(dtype=float)
    print(int(np.isinf(numeric_array).sum()))

    # Constant features cannot help distinguish examples.
    constant_cols = [
        col for col in feature_cols
        if df[col].nunique(dropna=False) <= 1
    ]
    print("\n===== CONSTANT FEATURES =====")
    print(constant_cols if constant_cols else "None found")

    # Inspect exact duplicate records and repeated URLs.
    print("\n===== DUPLICATE CHECKS =====")
    print("Exact duplicate rows:", int(df.duplicated().sum()))
    print("Repeated URLs:", int(df["url"].duplicated().sum()))

    normalized_status = (
        df["status"].astype(str).str.strip().str.lower()
    )
    label_counts = (
        pd.DataFrame({
            "url": df["url"],
            "status": normalized_status
        })
        .groupby("url")["status"]
        .nunique()
    )
    print(
        "URLs with conflicting labels:",
        int((label_counts > 1).sum())
    )

    # Identical feature columns can indicate redundancy.
    duplicate_feature_cols = (
        df[feature_cols].T.duplicated()
    )
    duplicate_names = list(
        duplicate_feature_cols[duplicate_feature_cols].index
    )

    print("\n===== IDENTICAL FEATURE COLUMNS =====")
    print(duplicate_names if duplicate_names else "None found")

    print("\n===== AUDIT FINISHED =====")
    print("Original dataset has not been modified.")


if __name__ == "__main__":
    main()