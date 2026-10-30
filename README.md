import pypandoc

readme = r"""# Lightweight Phishing URL Detection Using Machine Learning for Real-Time Prediction

A machine-learning-based system that analyzes URL characteristics and predicts whether a given URL is **Legitimate** or **Phishing**. The project focuses on lightweight, URL-based feature extraction, allowing predictions without visiting the target website.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [System Architecture](#system-architecture)
- [Project Workflow](#project-workflow)
- [Dataset](#dataset)
- [Data Preprocessing](#data-preprocessing)
- [Feature Extraction](#feature-extraction)
- [Machine Learning Algorithms](#machine-learning-algorithms)
- [Model Evaluation](#model-evaluation)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Installation and Setup](#installation-and-setup)
- [How to Run](#how-to-run)
- [Example Prediction](#example-prediction)
- [Results and Evaluation](#results-and-evaluation)
- [Limitations](#limitations)
- [Future Enhancements](#future-enhancements)
- [Contributors](#contributors)

---

## Overview

Phishing is a cybersecurity attack in which attackers create deceptive URLs and websites to trick users into sharing sensitive information, including passwords, banking credentials, and personal data.

This project aims to develop a lightweight phishing URL detection system using machine learning. The system extracts numerical features directly from a submitted URL and uses a trained machine-learning classifier to determine whether the URL is legitimate or potentially malicious.

Unlike approaches that require opening or crawling a website, the URL-only prediction pipeline performs feature extraction directly from the URL string.

### Key Highlights

- Machine-learning-based phishing URL classification.
- Automated URL feature extraction.
- Prediction without visiting the target website.
- Comparison of multiple machine-learning algorithms.
- Saved model for reusable predictions.
- Command-line-based prediction interface.
- Separate evaluation of full-feature and URL-only models.

## Problem Statement

Users often struggle to distinguish legitimate URLs from phishing URLs because attackers use misleading domain names, suspicious paths, unusual characters, and deceptive URL structures.

The objective is to develop a machine-learning-based solution that analyzes URL characteristics and identifies potentially phishing URLs before users interact with them.

## Objectives

1. Collect and analyze a labeled phishing URL dataset.
2. Clean and preprocess the dataset.
3. Extract meaningful numerical features from URLs.
4. Train and compare multiple machine-learning algorithms.
5. Evaluate model performance using classification metrics.
6. Develop a lightweight URL-only prediction pipeline.
7. Save and reuse the trained model for future predictions.

## System Architecture

The project consists of two major phases.

### 1. Model Development Phase (Offline)

- Dataset collection and inspection.
- Data cleaning and preprocessing.
- Feature preparation.
- Training multiple machine-learning algorithms.
- Model evaluation and comparison.
- Saving the selected trained model.

### 2. Real-Time Prediction Phase (Online)

- User submits a URL.
- Python application receives the URL.
- Feature extraction module analyzes URL characteristics.
- Extracted features are passed to the saved model.
- The model predicts whether the URL is legitimate or phishing.
- Prediction is displayed to the user.

## Project Workflow

```text
             DATASET
                |
                v
       Data Preprocessing
                |
                v
       Feature Preparation
                |
                v
       Train ML Algorithms
                |
                v
       Model Evaluation
                |
                v
       Select Best Model
                |
                v
       Save Trained Model
                |
                v
          USER INPUT
                |
                v
       Enter URL to Check
                |
                v
       URL Feature Extraction
                |
                v
       Load Saved ML Model
                |
                v
        URL Classification
                |
          +-----+-----+
          |           |
          v           v
      Legitimate    Phishing
        URL           URL
```

## Dataset

The project uses a publicly available Kaggle phishing URL dataset.

| Attribute | Details |
|---|---|
| Original records | 11,430 |
| Original columns | 89 |
| Legitimate URLs | 5,715 |
| Phishing URLs | 5,715 |
| Target column | `status` |
| URL column | `url` |
| Classification type | Binary classification |

The original dataset contains the URL, its classification label, and pre-extracted URL/website-related features.

After preprocessing and removing the repeated URL, the cleaned dataset contains 11,429 records.

**Target labels:**

- `0` – Legitimate
- `1` – Phishing

## Data Preprocessing

The following preprocessing operations were performed:

- Inspected dataset dimensions and data types.
- Checked for missing values.
- Identified duplicate records and repeated URLs.
- Identified constant and redundant features.
- Checked numerical features for invalid values.
- Converted target labels into binary numerical values.
- Prepared cleaned data for model training.

The cleaned dataset contains 81 numerical feature columns, along with the URL reference and target label.

## Feature Extraction

A separate URL-only feature extraction module was developed to make prediction possible using only the submitted URL.

The module extracts numerical characteristics from the URL string without visiting the website.

Examples include:

- URL length.
- Hostname and domain length.
- Path and query length.
- Number of dots and hyphens.
- Number of digits and special characters.
- HTTPS usage.
- IP-address-based hostname detection.
- Suspicious keyword detection.
- URL entropy.
- URL structure and subdomain characteristics.

The extracted features are arranged in the same order expected by the saved URL-only model.

**Main file:** `src/feature_extraction.py`

## Machine Learning Algorithms

The following algorithms were implemented and compared:

| Algorithm | Description |
|---|---|
| Random Forest | Ensemble learning using multiple decision trees |
| Extra Trees | Randomized tree-based ensemble algorithm |
| Logistic Regression | Linear classification algorithm |
| Histogram Gradient Boosting | Gradient boosting using histogram-based learning |

The model selection process uses validation performance, with phishing-class F1-score as the selection criterion. The selected model is then evaluated on a separate test dataset.

## Model Evaluation

Two different model configurations were developed.

### 1. Full-Feature Model

The full-feature model uses the pre-extracted numerical features available in the original dataset.

- Selected algorithm: Histogram Gradient Boosting.
- Reported test accuracy: **97.43%**.

This model is useful for experimentation with the complete dataset feature set. It is not the model used for direct raw-URL prediction because some features require information beyond the URL string.

### 2. URL-Only Model

The URL-only model uses numerical characteristics extracted directly from a submitted URL.

- Selected algorithm in the earlier experiment: Histogram Gradient Boosting.
- Earlier reported test accuracy: **87.06%**.

This model is the primary model used by the command-line URL prediction script.

**Note:** The 87.06% result is from an earlier training run. Refer to `results/url_only_evaluation.json` for the latest verified evaluation metrics.

## Technologies Used

| Category | Technologies |
|---|---|
| Programming Language | Python |
| Data Processing | Pandas, NumPy |
| Machine Learning | Scikit-learn |
| Visualization | Matplotlib, Seaborn |
| Model Persistence | Joblib |
| Development Environment | Visual Studio Code |
| Version Control | Git and GitHub |

## Project Structure

```text
phishing-url-detection/
│
├── dataset/
│   ├── dataset_phishing.csv
│   └── cleaned_dataset.csv
│
├── models/
│   ├── phishing_model.joblib
│   └── phishing_url_only_model.joblib
│
├── results/
│   ├── model_comparison.csv
│   ├── evaluation.json
│   ├── confusion_matrix.png
│   ├── url_only_evaluation.json
│   ├── url_only_model_comparison.csv
│   └── url_only_confusion_matrix.png
│
├── src/
│   ├── inspect_dataset.py
│   ├── audit_dataset.py
│   ├── prepare_dataset.py
│   ├── feature_extraction.py
│   ├── train_model.py
│   ├── verify_saved_model.py
│   ├── train_url_only_model.py
│   └── predict_url.py
│
├── .gitignore
├── requirements.txt
├── README.md
└── app.py
```

*Note: Include `app.py` only if it has actually been implemented. Adjust the file list to match the repository.*

## Installation and Setup

### Prerequisites

- Python 3.10 or later.
- pip (Python package manager).
- Git.
- Visual Studio Code (recommended).

### Step 1: Clone the Repository

```bash
git clone https://github.com/srtksharma/Major_Project_BT_136.git
```

### Step 2: Navigate to the Project Directory

```bash
cd Major_Project_BT_136
```

### Step 3: Create a Virtual Environment

**Windows:**

```powershell
python -m venv .venv
```

### Step 4: Activate the Virtual Environment

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

### Step 5: Install Dependencies

```bash
pip install -r requirements.txt
```

## How to Run

### Run the URL-Only Prediction System

After activating the virtual environment and installing dependencies, execute:

```bash
python src/predict_url.py
```

Enter the URL when prompted. The system extracts URL features, loads the saved model, and displays the classification result.

### Retrain the URL-Only Model

```bash
python src/train_url_only_model.py
```

The script generates the trained model and evaluation results.

### Train the Full-Feature Model

```bash
python src/train_model.py
```

## Example Prediction

**Command:**

```bash
python src/predict_url.py
```

**Example input:**

```text
Enter a URL to check: https://example.com
```

**Illustrative output:**

```text
========== PREDICTION ==========

URL: https://example.com

Result: Legitimate

================================
```

The prediction is generated by the trained machine-learning model. It is not a guarantee that a URL is safe.

## Results and Evaluation

The project generates evaluation reports and visualizations in the `results/` directory.

| File | Purpose |
|---|---|
| `model_comparison.csv` | Full-feature algorithm comparison |
| `evaluation.json` | Full-feature model evaluation |
| `confusion_matrix.png` | Full-feature confusion matrix |
| `url_only_model_comparison.csv` | URL-only algorithm comparison |
| `url_only_evaluation.json` | URL-only model evaluation |
| `url_only_confusion_matrix.png` | URL-only confusion matrix |

The evaluation considers accuracy, precision, recall, F1-score, and the confusion matrix.

## Limitations

- URL-based features cannot capture every malicious website behavior.
- The model may produce false positives and false negatives.
- New phishing techniques may not be represented in the training dataset.
- Model performance depends on dataset quality and diversity.
- The current command-line implementation is a prototype, not a complete browser-level security solution.
- The full-feature model requires additional information that is not available from a raw URL alone.

## Future Enhancements

1. Improve feature engineering and model performance.
2. Evaluate the system on newer and unseen phishing URLs.
3. Add a Flask-based web interface or REST API.
4. Develop a browser extension for URL checking.
5. Integrate trusted threat-intelligence sources.
6. Improve detection of previously unseen phishing URLs.
7. Add more comprehensive testing and performance monitoring.

## Contributors

**Project:** Lightweight Phishing URL Detection Using Machine Learning for Real-Time Prediction

**Developer:** Bhaskar Singh

**Repository:** [Major_Project_BT_136](https://github.com/srtksharma/Major_Project_BT_136)

## Disclaimer

This project is developed for academic and educational purposes. Its predictions are based on machine-learning patterns learned from the training dataset. It should not be considered a complete cybersecurity solution or a guarantee that a URL is safe.
"""

output_path = "/mnt/data/README.md"
pypandoc.convert_text(readme, "md", format="md", outputfile=output_path, extra_args=["--standalone"])
print(f"Created: {output_path}")
