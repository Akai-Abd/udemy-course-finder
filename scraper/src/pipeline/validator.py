"""
Udemy Course Finder — Pipeline: Validator

Validates ScrapedCourse records for required fields and URL well-formedness.
"""

import logging
import re
from urllib.parse import urlparse

from src.models import ScrapedCourse

logger = logging.getLogger(__name__)

_URL_PATTERN = re.compile(
    r"^https?://"
    r"[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?"
    r"(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*"
    r"(:\d+)?"
    r"(/[^\s]*)?$"
)


def _is_valid_url(url: str) -> bool:
    """Check if a string is a well-formed HTTP/HTTPS URL."""
    if not url:
        return False
    try:
        parsed = urlparse(url)
        return bool(parsed.scheme in ("http", "https") and parsed.netloc)
    except Exception:
        return False


def validate_course(course: ScrapedCourse) -> tuple[bool, str | None]:
    """
    Validate a single ScrapedCourse.

    Returns (is_valid, rejection_reason).
    """
    # ─── Required fields ───
    if not course.title or not course.title.strip():
        return False, "missing_title"

    if len(course.title.strip()) < 5:
        return False, "title_too_short"

    if not course.udemy_url and not course.coupon_url:
        return False, "missing_url"

    # ─── URL validation ───
    if course.udemy_url and not _is_valid_url(course.udemy_url):
        return False, "invalid_udemy_url"

    if course.coupon_url and not _is_valid_url(course.coupon_url):
        return False, "invalid_coupon_url"

    # ─── Must be a Udemy course ───
    urls_to_check = [course.udemy_url, course.coupon_url]
    has_udemy_url = any(
        url and "udemy.com" in urlparse(url).netloc
        for url in urls_to_check
        if url
    )
    if not has_udemy_url:
        return False, "not_udemy_url"

    # ─── Must be free ───
    if not course.is_free:
        return False, "not_free"

    return True, None


def validate_batch(courses: list[ScrapedCourse]) -> tuple[list[ScrapedCourse], list[tuple[ScrapedCourse, str]]]:
    """
    Validate a batch of courses.

    Returns (valid_courses, rejected_courses_with_reasons).
    """
    valid = []
    rejected = []

    for course in courses:
        is_valid, reason = validate_course(course)
        if is_valid:
            valid.append(course)
        else:
            rejected.append((course, reason or "unknown"))
            logger.debug(
                f"Rejected '{course.title[:50]}' from {course.provider_name}: {reason}"
            )

    if rejected:
        # Summarize rejection reasons
        reasons = {}
        for _, reason in rejected:
            reasons[reason] = reasons.get(reason, 0) + 1
        logger.info(
            f"Validation: {len(valid)} passed, {len(rejected)} rejected — "
            + ", ".join(f"{r}: {c}" for r, c in reasons.items())
        )

    return valid, rejected
