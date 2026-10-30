
import re
from ipaddress import ip_address
from urllib.parse import urlsplit


SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl",
    "is.gd", "buff.ly", "ow.ly", "cutt.ly",
}

SUSPICIOUS_KEYWORDS = {
    "login", "verify", "update", "secure", "account",
    "password", "signin", "confirm", "wallet", "banking",
}


def extract_features(raw_url):
    """Return numerical features calculated directly from a URL."""

    url = str(raw_url).strip()
    candidate = url if "://" in url else "//" + url

    try:
        parsed = urlsplit(candidate)
        hostname = (parsed.hostname or "").lower()
        path = parsed.path.lower()
        query = parsed.query.lower()
        fragment = parsed.fragment
        scheme = parsed.scheme.lower()
    except ValueError:
        hostname = ""
        path = ""
        query = ""
        fragment = ""
        scheme = ""

    try:
        host_is_ip = int(bool(hostname) and
                         _is_ip_address(hostname))
    except ValueError:
        host_is_ip = 0

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
    keyword_count = sum(
        word in SUSPICIOUS_KEYWORDS for word in words
    )

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


def _is_ip_address(hostname):
    ip_address(hostname)
    return True
