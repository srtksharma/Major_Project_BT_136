"""URL validation, normalization, and sanitization utilities."""

from urllib.parse import urlsplit


def validate_and_normalize_url(raw_url: str) -> str:
    """Validate and normalize a URL safely.
    
    Accepts domains supplied without scheme (defaulting to https://).
    Verifies that the scheme is http or https and a valid hostname exists.
    """
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise ValueError("Please provide a non-empty URL.")

    url = raw_url.strip()

    if any(char.isspace() for char in url):
        raise ValueError("The URL must not contain whitespace.")

    if len(url) > 8192:
        raise ValueError("URL exceeds maximum length of 8192 characters.")

    # Accept a domain supplied without a scheme
    candidate = url if "://" in url else f"https://{url}"

    try:
        parsed = urlsplit(candidate)

        if parsed.scheme.lower() not in {"http", "https"}:
            raise ValueError("Only HTTP and HTTPS URLs are supported.")

        if not parsed.hostname:
            raise ValueError("The URL must contain a valid hostname.")

        # Accessing .port validates whether the port is syntactically a valid integer
        _ = parsed.port

    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid URL structure: {exc}") from exc

    return candidate
