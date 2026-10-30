from pathlib import Path
import pandas as pd

PROJECT_DIR = Path(__file__).resolve().parent.parent

INPUT_PATH = PROJECT_DIR / "dataset" / "dataset_phishing.csv"
OUTPUT_PATH = PROJECT_DIR / "dataset" / "cleaned_dataset.csv"


def main():
    print("Loading dataset...")

    df = pd.read_csv(INPUT_PATH)
    df.columns = df.columns.str.strip()

    # Validate essential columns.
    if not {"url", "status"}.issubset(df.columns):
        raise ValueError("The dataset must contain url and status.")

    original_rows = len(df)

    # Normalize URLs and labels.
    df["url"] = df["url"].astype("string").str.strip()
    df["status"] = (
        df["status"].astype("string").str.strip().str.lower()
    )

    # Remove rows without a usable URL or label.
    df = df.dropna(subset=["url", "status"]).copy()
    df = df[df["url"] != ""].copy()

    label_map = {
        "legitimate": 0,
        "phishing": 1,
    }

    unknown_labels = set(df["status"].unique()) - set(label_map)

    if unknown_labels:
        raise ValueError(f"Unexpected labels: {unknown_labels}")

    # Identify contradictory labels for the same URL.
    label_counts = df.groupby("url")["status"].nunique()
    conflicting_urls = label_counts[label_counts > 1].index

    print("URLs with conflicting labels:", len(conflicting_urls))

    # Do not guess the labels of contradictory examples.
    if len(conflicting_urls):
        df = df[~df["url"].isin(conflicting_urls)].copy()

    # Remove repeated URLs to reduce train/test contamination.
    repeated_urls = int(df.duplicated(subset=["url"]).sum())
    df = df.drop_duplicates(subset=["url"], keep="first").copy()

    print("Repeated URL records removed:", repeated_urls)

    df["label"] = df["status"].map(label_map).astype("int64")

    # URL and status are not model input features.
    feature_cols = [
        c for c in df.columns
        if c not in {"url", "status", "label"}
    ]

    # All candidate features must be numerical.
    for col in feature_cols:
        df[col] = pd.to_numeric(df[col], errors="raise")

    # Remove features that have the same value for every row.
    constant_cols = [
        c for c in feature_cols
        if df[c].nunique(dropna=False) <= 1
    ]

    df = df.drop(columns=constant_cols)
    feature_cols = [c for c in feature_cols if c not in constant_cols]

    # Remove any remaining identical feature columns.
    duplicate_mask = df[feature_cols].T.duplicated()
    duplicate_cols = duplicate_mask[duplicate_mask].index.tolist()

    df = df.drop(columns=duplicate_cols)
    feature_cols = [c for c in feature_cols if c not in duplicate_cols]

    # Retain original URLs for reference, features for training,
    # and numerical labels as the prediction target.
    df = df[["url"] + feature_cols + ["label"]].copy()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print("\n========== FINAL DATASET REPORT ==========")
    print("Original rows:", original_rows)
    print("Final rows:", len(df))
    print("Features retained:", len(feature_cols))
    print("Constant features removed:", constant_cols)
    print("Duplicate feature columns removed:", duplicate_cols)
    print("Missing values remaining:", int(df.isnull().sum().sum()))

    print("\nLabel distribution:")
    print(df["label"].value_counts().sort_index().rename(
        index={0: "legitimate", 1: "phishing"}
    ).to_string())

    print("\nSaved dataset to:")
    print(OUTPUT_PATH)
    print("\nDATASET PREPARATION COMPLETED")


if __name__ == "__main__":
    main()