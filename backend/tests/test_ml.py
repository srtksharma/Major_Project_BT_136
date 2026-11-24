"""Unit tests for ML feature extraction, inference, and explainability."""

import sys
from pathlib import Path

# Setup paths
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.ml.predictor import extract_features, predictor_service
from app.ml.explainability import generate_feature_explanations
from app.schemas.scan import Verdict, ScanFeature


def test_extract_features_structure():
    """Verify feature extractor returns all 26 required features."""
    url = "https://example.com/login?token=abc"
    features = extract_features(url)
    assert isinstance(features, dict)
    assert len(features) == 26
    assert "url_length" in features
    assert "hostname_length" in features
    assert "uses_https" in features
    assert features["uses_https"] == 1
    assert features["has_query"] == 1


def test_predictor_model_loading():
    """Verify that predictor loads the model bundle cleanly."""
    predictor_service.load_model()
    assert predictor_service.is_ready is True
    assert len(predictor_service.feature_names) == 26
    assert predictor_service.model is not None


def test_predict_safe_url():
    """Verify safe verdict for an established domain."""
    predictor_service.load_model()
    verdict, confidence, features = predictor_service.predict("https://www.google.com")
    assert verdict == Verdict.SAFE
    assert 70.0 <= confidence <= 100.0
    assert len(features) > 0
    # Check that established domain or https is present in features
    feature_names = [f.name for f in features]
    assert any("domain" in name.lower() or "https" in name.lower() for name in feature_names)


def test_predict_phishing_url():
    """Verify phishing verdict for deceptive URL."""
    predictor_service.load_model()
    phishing_url = "http://secure-login-verify-free-prize.xyz/account/update"
    verdict, confidence, features = predictor_service.predict(phishing_url)
    assert verdict == Verdict.PHISHING
    assert 70.0 <= confidence <= 100.0
    assert len(features) > 0
    # Check impacts are within [-1.0, 1.0]
    for feat in features:
        assert -1.0 <= feat.impact <= 1.0
        assert len(feat.description) <= 1000


def test_predict_ip_host():
    """Verify raw IP host is flagged as risky/suspicious/phishing."""
    predictor_service.load_model()
    ip_url = "https://192.168.1.10/login"
    verdict, confidence, features = predictor_service.predict(ip_url)
    assert verdict in (Verdict.PHISHING, Verdict.SUSPICIOUS)
    # Check IP signal is in explainability
    ip_signal = next((f for f in features if "ip" in f.name.lower()), None)
    assert ip_signal is not None
    assert ip_signal.impact > 0


if __name__ == "__main__":
    test_extract_features_structure()
    test_predictor_model_loading()
    test_predict_safe_url()
    test_predict_phishing_url()
    test_predict_ip_host()
    print("All ML tests passed successfully!")
