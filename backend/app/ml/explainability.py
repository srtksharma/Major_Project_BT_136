"""Explainability and feature attribution engine.

Generates human-readable ScanFeature signals with impact scores (-1.0 to +1.0)
and plain-language descriptions that match the LinkLens frontend expectations.
"""

from typing import List, Dict, Any, Tuple
import re
from urllib.parse import urlsplit
from app.schemas.scan import ScanFeature

SUSPICIOUS_TLDS = {
    "xyz", "top", "click", "buzz", "club", "gq", "tk", "ml", "cf",
    "work", "zip", "mov", "icu", "rest", "quest", "best", "fun",
    "monster", "cam", "fit", "surf", "live", "link"
}

SUSPICIOUS_KEYWORDS = [
    "secure", "login", "signin", "verify", "free", "prize", "account",
    "update", "confirm", "bank", "wallet", "bonus", "claim", "password",
    "credential", "suspended", "urgent", "winner", "banking", "billing",
    "security", "support", "service", "ebay", "paypal", "apple", "netflix"
]

ESTABLISHED_DOMAINS = [
    "google.com", "microsoft.com", "apple.com", "amazon.com",
    "amazon.in", "github.com", "wikipedia.org", "youtube.com",
    "linkedin.com", "netflix.com", "openai.com", "mozilla.org",
    "cloudflare.com", "facebook.com", "twitter.com", "x.com",
    "instagram.com", "gov.in", "gov.uk", "gov", "edu"
]

SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl",
    "is.gd", "buff.ly", "ow.ly", "cutt.ly"
}

IPV4_PATTERN = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")


def clamp(value: float, min_val: float = -1.0, max_val: float = 1.0) -> float:
    return max(min_val, min(max_val, value))


def generate_feature_explanations(
    raw_url: str,
    raw_features: Dict[str, Any],
    phishing_prob: float
) -> List[ScanFeature]:
    """Analyze URL and ML features to produce user-facing ScanFeature objects."""
    signals: List[ScanFeature] = []

    try:
        parsed = urlsplit(raw_url if "://" in raw_url else f"https://{raw_url}")
        host = (parsed.hostname or "").lower()
        url_lower = raw_url.lower()
        scheme = parsed.scheme.lower()
    except Exception:
        host = ""
        url_lower = raw_url.lower()
        scheme = "https"

    is_ip = bool(IPV4_PATTERN.match(host))
    host_labels = [p for p in host.split(".") if p]
    tld = host_labels[-1] if host_labels and not is_ip else ""
    subdomain_count = max(0, len(host_labels) - 2) if not is_ip else 0
    hyphen_count = host.count("-")
    digit_count = sum(ch.isdigit() for ch in host)

    # 1. Established Domain check
    is_established = any(
        host == domain or host.endswith("." + domain)
        for domain in ESTABLISHED_DOMAINS
    )
    if is_established:
        signals.append(ScanFeature(
            name="Established domain",
            value=host,
            impact=-0.85,
            description="The domain is widely recognised and long-lived, and it matches the brand it claims to be."
        ))

    # 2. IP Host check
    if is_ip:
        signals.append(ScanFeature(
            name="IP address as host",
            value=host,
            impact=0.85,
            description="Legitimate services almost always use a domain name. A raw IP host hides who operates the site."
        ))

    # 3. HTTPS Encryption
    if scheme == "https":
        signals.append(ScanFeature(
            name="HTTPS",
            value="Present",
            impact=-0.30,
            description="The connection is encrypted. That protects data in transit, but says nothing about who owns the site."
        ))
    else:
        signals.append(ScanFeature(
            name="HTTPS",
            value="Not present (plain HTTP)",
            impact=0.62,
            description="Anything typed on this page - including passwords - travels unencrypted. A strong risk signal."
        ))

    # 4. '@' symbol in URL
    if "@" in raw_url:
        signals.append(ScanFeature(
            name="'@' symbol in URL",
            value="Present",
            impact=0.78,
            description="Browsers ignore everything before '@', so the real destination is whatever follows it - a classic disguise trick."
        ))

    # 5. Suspicious Keywords
    found_keywords = [word for word in SUSPICIOUS_KEYWORDS if word in url_lower]
    if len(found_keywords) >= 3:
        signals.append(ScanFeature(
            name="Suspicious keywords",
            value=", ".join(found_keywords[:5]),
            impact=0.85,
            description="Multiple urgency and credential-harvesting keywords - a pattern typical of phishing campaigns."
        ))
    elif len(found_keywords) > 0:
        impact = 0.50 if len(found_keywords) == 2 else 0.30
        signals.append(ScanFeature(
            name="Suspicious keywords",
            value=", ".join(found_keywords),
            impact=impact,
            description="Words like these are common in phishing URLs that imitate account and login flows."
        ))

    # 6. Suspicious TLD
    if tld and tld in SUSPICIOUS_TLDS:
        signals.append(ScanFeature(
            name="Top-level domain",
            value=f".{tld}",
            impact=0.66,
            description="Very cheap or disposable TLDs are disproportionately used for short-lived phishing sites."
        ))

    # 7. URL Length
    url_len = len(raw_url)
    if url_len > 75:
        signals.append(ScanFeature(
            name="URL length",
            value=url_len,
            impact=0.55,
            description="Unusually long URLs are often used to bury the real destination under misleading words and sub-paths."
        ))
    elif url_len > 54:
        signals.append(ScanFeature(
            name="URL length",
            value=url_len,
            impact=0.35,
            description="Longer than a typical service URL - length is often used to hide the real destination."
        ))
    elif url_len < 30:
        signals.append(ScanFeature(
            name="URL length",
            value=url_len,
            impact=-0.18,
            description="A short, clean URL with no room for obfuscation tricks."
        ))

    # 8. Subdomain Depth
    if not is_ip:
        if subdomain_count >= 3:
            signals.append(ScanFeature(
                name="Subdomain depth",
                value=subdomain_count,
                impact=0.50,
                description="Deep subdomains let a lookalike brand name appear inside an unrelated root domain."
            ))
        elif subdomain_count == 2:
            signals.append(ScanFeature(
                name="Subdomain depth",
                value=subdomain_count,
                impact=0.25,
                description="More subdomains than a typical service URL uses."
            ))
        elif subdomain_count <= 1:
            signals.append(ScanFeature(
                name="Subdomain depth",
                value=subdomain_count,
                impact=-0.12,
                description="A simple host structure, like most established services."
            ))

    # 9. Hyphens in domain
    if hyphen_count >= 3:
        signals.append(ScanFeature(
            name="Hyphens in domain",
            value=hyphen_count,
            impact=0.45,
            description="Chains of hyphenated words are a common way to stuff brand and urgency keywords into a domain name."
        ))
    elif hyphen_count > 0:
        signals.append(ScanFeature(
            name="Hyphens in domain",
            value=hyphen_count,
            impact=0.18,
            description="Some hyphens are normal, but they are also used to build lookalike domains."
        ))

    # 10. Digits in domain
    if digit_count >= 4 and not is_ip:
        signals.append(ScanFeature(
            name="Digits in domain",
            value=digit_count,
            impact=0.40,
            description="Heavy digit use in a domain often signals a generated or lookalike name."
        ))

    # 11. Punycode
    if "xn--" in host:
        signals.append(ScanFeature(
            name="Punycode domain",
            value="xn-- present",
            impact=0.50,
            description="Punycode can render characters that look identical to a trusted brand's letters while being a different domain."
        ))

    # 12. Non-standard port
    if parsed.port and parsed.port not in (80, 443):
        signals.append(ScanFeature(
            name="Non-standard port",
            value=parsed.port,
            impact=0.45,
            description="Established web services use standard ports. Explicit non-standard ports are a common evasion indicator."
        ))

    # 13. URL Shortener
    is_shortener = any(
        host == s or host.endswith("." + s) for s in SHORTENER_DOMAINS
    )
    if is_shortener:
        signals.append(ScanFeature(
            name="URL Shortener",
            value=host,
            impact=0.45,
            description="URL shorteners obscure the real destination until followed, hiding potentially malicious domains."
        ))

    # 14. ML Classifier statistical contribution
    # Positive if model leans phishing, negative if model leans legitimate
    ml_impact = round((phishing_prob - 0.5) * 1.6, 2)
    ml_impact = clamp(ml_impact, -0.95, 0.95)
    ml_desc = (
        f"Histogram Gradient Boosting classifier assigned a {phishing_prob*100:.1f}% phishing probability based on 26 URL features."
        if phishing_prob >= 0.5
        else f"Histogram Gradient Boosting classifier identified legitimate URL structural characteristics ({(1-phishing_prob)*100:.1f}% legitimacy confidence)."
    )
    signals.append(ScanFeature(
        name="Machine Learning Model",
        value=f"{phishing_prob*100:.1f}% risk score",
        impact=ml_impact,
        description=ml_desc
    ))

    # Sort signals by absolute impact descending so the strongest drivers are first
    signals.sort(key=lambda s: abs(s.impact), reverse=True)
    # Frontend caps features at 50, we return top 8-12 for clean UI presentation
    return signals[:15]
