"""
Udemy Course Finder — URL Parser

Extracts Udemy course IDs and normalizes URLs from various formats
found across the 9 coupon aggregator sites.
"""

import re
import logging
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse, unquote

logger = logging.getLogger(__name__)

# Patterns to extract the course slug from Udemy URLs
_UDEMY_COURSE_PATTERNS = [
    # Standard: https://www.udemy.com/course/course-slug/
    re.compile(r"udemy\.com/course/([a-zA-Z0-9_-]+)"),
    # Old format: https://www.udemy.com/course-slug/
    re.compile(r"udemy\.com/([a-zA-Z0-9_-]+)/?(?:\?|$)"),
]

# Tracking/affiliate params to strip from URLs
_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "ref", "referralCode", "deal_id", "aff_code", "aff_id",
    "ranMID", "ranEAID", "ranSiteID", "LSNPUBID",
    "siteID", "couponCode",  # we keep coupon code separately
}


def extract_course_id(url: str) -> str | None:
    """
    Extract the Udemy course slug/ID from a URL.

    Handles various URL formats:
    - https://www.udemy.com/course/python-bootcamp/
    - https://www.udemy.com/course/python-bootcamp/?couponCode=FREE
    - https://www.udemy.com/python-bootcamp/
    - Redirect URLs from coupon sites

    Returns the course slug (e.g., 'python-bootcamp') or None.
    """
    if not url:
        return None

    # Unquote URL to handle URL-encoded redirect links (e.g. u=https%3A%2F%2Fwww.udemy.com...)
    url = unquote(url)

    for pattern in _UDEMY_COURSE_PATTERNS:
        match = pattern.search(url)
        if match:
            slug = match.group(1).strip("/")
            # Filter out known non-course slugs
            if slug in ("course", "cart", "user", "topic", "share", "home"):
                continue
            return slug

    return None


def extract_coupon_code(url: str) -> str | None:
    """Extract the coupon code from a Udemy URL query parameter (supporting nested parameters)."""
    if not url:
        return None

    # Unquote URL to handle URL-encoded nested parameters
    url = unquote(url)

    try:
        # First try regular expression to handle nested query parameters (e.g., inside trk.udemy.com?url=...)
        match = re.search(r"couponCode=([a-zA-Z0-9_-]+)", url, re.IGNORECASE)
        if match:
            return match.group(1)

        # Fallback to standard URL query parsing
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        coupon = params.get("couponCode", [None])
        return coupon[0] if coupon and coupon[0] else None
    except Exception:
        return None


def normalize_udemy_url(url: str) -> str:
    """
    Normalize a Udemy URL to canonical form.

    Strips tracking params, ensures consistent format:
    https://www.udemy.com/course/{slug}/
    """
    if not url:
        return url

    try:
        parsed = urlparse(url)

        # Only normalize udemy.com URLs
        if "udemy.com" not in (parsed.hostname or ""):
            return url

        # Extract course slug
        course_id = extract_course_id(url)
        if not course_id:
            return url

        # Extract coupon code if present
        coupon_code = extract_coupon_code(url)

        # Build canonical URL
        canonical = f"https://www.udemy.com/course/{course_id}/"
        if coupon_code:
            canonical += f"?couponCode={coupon_code}"

        return canonical

    except Exception:
        return url


def build_coupon_url(course_slug: str, coupon_code: str) -> str:
    """Build a Udemy coupon URL from a course slug and coupon code."""
    return f"https://www.udemy.com/course/{course_slug}/?couponCode={coupon_code}"


def is_udemy_url(url: str) -> bool:
    """Check if a URL is a Udemy course URL."""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        return "udemy.com" in (parsed.hostname or "")
    except Exception:
        return False


def clean_url(url: str) -> str:
    """Remove tracking/affiliate parameters from any URL."""
    if not url:
        return url

    try:
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        # Remove tracking params
        cleaned_params = {
            k: v for k, v in params.items()
            if k.lower() not in _TRACKING_PARAMS
        }

        # Rebuild URL
        new_query = urlencode(cleaned_params, doseq=True)
        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            "",  # drop fragment
        ))
    except Exception:
        return url


def resolve_redirect_url(url: str) -> str:
    """
    Resolve tracking/redirect URLs (like trk.udemy.com, bit.ly, etc.)
    to the final destination or extract nested Udemy URLs from parameters.
    """
    if not url:
        return url

    # 1. Quick check: if the URL already contains a nested 'u=' or 'url=' parameter pointing to a course
    try:
        parsed = urlparse(url)
        params = parse_qs(parsed.query)
        for param_key in ['u', 'url', 'return']:
            val = params.get(param_key, [None])[0]
            if val:
                val_unquoted = unquote(val)
                if "udemy.com/course" in val_unquoted:
                    return val_unquoted
                # Recursive check
                nested = resolve_redirect_url(val_unquoted)
                if "udemy.com/course" in nested:
                    return nested
    except Exception:
        pass

    # 2. If it's a known redirect domain or doesn't have course slug directly
    is_redirect_domain = any(domain in url for domain in ["trk.udemy.com", "bit.ly", "tinyurl.com", "click.linksynergy.com", "/out/"])
    
    path = urlparse(url).path.strip('/')
    is_short_code = path and len(path) <= 10 and '-' not in path
    
    if is_redirect_domain or is_short_code:
        try:
            import requests
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
            }
            current_url = url
            for _ in range(3):
                try:
                    response = requests.head(current_url, headers=headers, allow_redirects=False, timeout=5)
                except Exception:
                    response = requests.get(current_url, headers=headers, allow_redirects=False, timeout=5)
                
                location = response.headers.get("Location")
                if not location:
                    break
                
                location = unquote(location)
                if "udemy.com/course" in location:
                    return location
                
                parsed_loc = urlparse(location)
                params_loc = parse_qs(parsed_loc.query)
                for param_key in ['u', 'url', 'return']:
                    val = params_loc.get(param_key, [None])[0]
                    if val:
                        val_unquoted = unquote(val)
                        if "udemy.com/course" in val_unquoted:
                            return val_unquoted
                        
                current_url = location
        except Exception as e:
            logger.debug(f"Failed to resolve redirect for {url}: {e}")

    return url

