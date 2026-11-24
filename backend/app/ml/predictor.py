"""Machine Learning Predictor & Inference Service."""

from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import os
import re
from urllib.parse import urlsplit
from ipaddress import ip_address
import joblib
import pandas as pd
import numpy as np

from app.schemas.scan import Verdict, ScanFeature
from app.ml.explainability import generate_feature_explanations, ESTABLISHED_DOMAINS
from app.config import MODEL_PATH


SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl",
    "is.gd", "buff.ly", "ow.ly", "cutt.ly"
}

SUSPICIOUS_KEYWORDS = {
    "login", "verify", "update", "secure", "account",
    "password", "signin", "confirm", "wallet", "banking",
}


def _is_ip_address(hostname: str) -> bool:
    try:
        ip_address(hostname)
        return True
    except (ValueError, TypeError):
        return False


def extract_features(raw_url: str) -> Dict[str, Any]:
    """Extract the exact 26 numerical features expected by the trained model."""
    url = str(raw_url).strip()
    candidate = url if "://" in url else "//" + url

    try:
        parsed = urlsplit(candidate)
        hostname = (parsed.hostname or "").lower()
        path = (parsed.path or "").lower()
        query = (parsed.query or "").lower()
        fragment = parsed.fragment or ""
        scheme = (parsed.scheme or "").lower()
    except ValueError:
        hostname = ""
        path = ""
        query = ""
        fragment = ""
        scheme = ""

    host_is_ip = int(bool(hostname) and _is_ip_address(hostname))

    host_parts = [p for p in hostname.split(".") if p]
    if host_parts and host_parts[0] == "www":
        host_parts = host_parts[1:]

    subdomain_count = max(len(host_parts) - 2, 0)

    uses_shortener = int(any(
        hostname == domain or hostname.endswith("." + domain)
        for domain in SHORTENER_DOMAINS
    ))

    digits = sum(ch.isdigit() for ch in url)
    words = re.findall(r"[a-z0-9]+", url.lower())
    keyword_count = sum(word in SUSPICIOUS_KEYWORDS for word in words)

    try:
        port = parsed.port
        has_port = int(port is not None)
    except (ValueError, UnboundLocalError):
        has_port = 0

    return {
        "url_length": len(url),
        "hostname_length": len(hostname),
        "path_length": len(path),
        "query_length": len(query),
        "dot_count": url.count("."),
        "hyphen_count": url.count("-"),
        "at_count": url.count("@"),
        "question_mark_count": url.count("?"),
        "ampersand_count": url.count("&"),
        "equals_count": url.count("="),
        "underscore_count": url.count("_"),
        "percent_count": url.count("%"),
        "slash_count": url.count("/"),
        "colon_count": url.count(":"),
        "digit_count": digits,
        "digit_ratio": digits / max(len(url), 1),
        "uses_https": int(scheme == "https"),
        "host_is_ip": host_is_ip,
        "has_port": has_port,
        "approximate_subdomain_count": subdomain_count,
        "has_punycode": int("xn--" in hostname),
        "suspicious_keyword_count": keyword_count,
        "uses_shortener": uses_shortener,
        "http_token_in_path": int("http" in path),
        "has_query": int(bool(query)),
        "has_fragment": int(bool(fragment)),
    }


class PredictorService:
    """Manages model loading and inference."""

    def __init__(self, model_file_path: Optional[Path] = None):
        self.model_path = model_file_path or MODEL_PATH
        self.model = None
        self.feature_names = []
        self.model_name = "Not Loaded"
        self.is_ready = False

    def load_model(self) -> None:
        """Load the trained joblib model bundle."""
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model file not found at {self.model_path}")

        bundle = joblib.load(self.model_path)
        self.model = bundle["model"]
        self.feature_names = bundle["feature_names"]
        self.model_name = bundle.get("selected_model", "Histogram Gradient Boosting")
        self.is_ready = True

    def predict(self, url: str) -> Tuple[Verdict, float, List[ScanFeature]]:
        """Run ML prediction on a URL and return verdict, confidence, and explainability features."""
        if not self.is_ready:
            self.load_model()

        # 1. Feature extraction
        raw_features = extract_features(url)
        df_input = pd.DataFrame(
            [[raw_features[col] for col in self.feature_names]],
            columns=self.feature_names
        )

        # 2. Probability estimation
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(df_input)[0]
            # Classes are [0, 1] -> [legitimate, phishing]
            prob_legit = float(probs[0])
            prob_phish = float(probs[1])
        else:
            pred = int(self.model.predict(df_input)[0])
            prob_phish = 1.0 if pred == 1 else 0.0
            prob_legit = 1.0 - prob_phish

        # 3. Established domain heuristic guardrail
        try:
            parsed = urlsplit(url if "://" in url else f"https://{url}")
            host = (parsed.hostname or "").lower()
            is_established = any(
                host == domain or host.endswith("." + domain)
                for domain in ESTABLISHED_DOMAINS
            )
        except Exception:
            is_established = False

        if is_established and prob_phish < 0.85:
            # Established domains with no extreme anomaly are safe
            prob_phish = min(prob_phish * 0.1, 0.10)
            prob_legit = 1.0 - prob_phish

        # 4. Map probability to Verdict and Confidence
        if prob_phish >= 0.65:
            verdict = Verdict.PHISHING
            # Confidence in phishing: 70% to 99%
            confidence = round(min(99.0, max(70.0, prob_phish * 100.0)), 1)
        elif prob_phish >= 0.35:
            verdict = Verdict.SUSPICIOUS
            # Suspicious confidence: between 68% and 84%
            risk_deviation = abs(prob_phish - 0.5)
            confidence = round(max(68.0, 84.0 - risk_deviation * 60.0), 1)
        else:
            verdict = Verdict.SAFE
            # Confidence in safe: 70% to 99%
            confidence = round(min(99.0, max(70.0, prob_legit * 100.0)), 1)

        # 5. Feature explainability signals
        features = generate_feature_explanations(url, raw_features, prob_phish)

        return verdict, confidence, features


# Global singleton predictor instance
predictor_service = PredictorService()
