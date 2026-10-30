
from pathlib import Path
import pandas as pd

# Find the project folder automatically.
PROJECT_DIR = Path(__file__).resolve().parent.parent

# Locate the dataset.
DATASET_PATH = PROJECT_DIR / "dataset" / "dataset_phishing.csv"


def main():
    # Check that the dataset file exists.
    if not DATASET_PATH.exists():
        print(f"ERROR: Dataset not found at:\n{DATASET_PATH}")
        return

    # Read the CSV file.
    df = pd.read_csv(DATASET_PATH)

    print("\n========== DATASET OVERVIEW ==========")
    print(f"Number of rows: {df.shape[0]}")
    print(f"Number of columns: {df.shape[1]}")

    print("\n========== COLUMN NAMES ==========")
    for column in df.columns:
        print(column)

    print("\n========== FIRST 5 ROWS ==========")
    print(df.head().to_string())

    print("\n========== DATA TYPES ==========")
    print(df.dtypes.to_string())

    print("\n========== MISSING VALUES ==========")
    missing = df.isnull().sum()
    missing = missing[missing > 0]

    if missing.empty:
        print("No missing values found.")
    else:
        print(missing.to_string())

    print("\n========== DUPLICATE ROWS ==========")
    print(f"Duplicate rows: {df.duplicated().sum()}")

    print("\n========== POSSIBLE LABEL COLUMNS ==========")
    candidates = [
        column for column in df.columns
        if any(word in column.lower()
               for word in ["status", "label", "class", "target", "result"])
    ]

    if not candidates:
        print("No obvious label column found. Review the column names.")
    else:
        for column in candidates:
            print(f"\nColumn: {column}")
            print(df[column].value_counts(dropna=False).to_string())


if __name__ == "__main__":
    main()
