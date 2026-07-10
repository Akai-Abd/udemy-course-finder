"""
Udemy Course Finder — Pipeline: Language Filter

Filters out non-English courses using explicit language fields and langdetect.
"""

import logging
from typing import Optional

from src.models import ScrapedCourse

logger = logging.getLogger(__name__)

# Lazy-load langdetect to avoid import-time side effects
_langdetect_loaded = False


def _ensure_langdetect():
    """Lazy-load langdetect and set seed for reproducibility."""
    global _langdetect_loaded
    if not _langdetect_loaded:
        try:
            from langdetect import DetectorFactory
            DetectorFactory.seed = 0  # Reproducible results
            _langdetect_loaded = True
        except ImportError:
            logger.warning("langdetect not installed — falling back to explicit language only")


def _detect_language(text: str) -> str | None:
    """
    Detect the language of a text using langdetect.
    Returns the ISO 639-1 code (e.g., 'en') or None on failure.
    """
    if not text or len(text.strip()) < 10:
        return None

    _ensure_langdetect()

    try:
        from langdetect import detect
        return detect(text)
    except Exception:
        return None


def _is_english(course: ScrapedCourse) -> tuple[bool, str]:
    """
    Determine if a course is English.

    Strategy:
    1. If language field is explicitly set → use it
    2. Otherwise, detect from title + description via langdetect
    3. If detection fails or is ambiguous → assume English (fail-open)

    Returns (is_english, detection_method).
    """
    # Check explicit language field
    if course.language:
        lang = course.language.strip().lower()
        if lang in ("english", "en", "eng"):
            return True, "explicit"
        if lang not in ("", "unknown", "n/a"):
            return False, f"explicit:{lang}"

    # Build text for detection
    text_parts = []
    if course.title:
        text_parts.append(course.title)
    if course.description:
        text_parts.append(course.description)

    combined_text = " ".join(text_parts)

    # Need sufficient text for reliable detection
    if len(combined_text) < 20:
        # Not enough text — assume English (fail-open)
        return True, "insufficient_text"

    detected = _detect_language(combined_text)

    if detected is None:
        return True, "detection_failed"

    if detected == "en":
        return True, "detected"

    # Non-English detected
    return False, f"detected:{detected}"


def filter_english(courses: list[ScrapedCourse]) -> tuple[list[ScrapedCourse], list[tuple[ScrapedCourse, str]]]:
    """
    Filter a batch of courses to English-only.

    Returns (english_courses, rejected_courses_with_reasons).
    """
    english = []
    rejected = []

    for course in courses:
        is_eng, method = _is_english(course)
        if is_eng:
            course.language = "English"  # Normalize to consistent value
            english.append(course)
        else:
            rejected.append((course, f"non_english ({method})"))
            logger.debug(
                f"Filtered non-English '{course.title[:50]}': {method}"
            )

    if rejected:
        logger.info(
            f"Language filter: {len(english)} English, {len(rejected)} non-English rejected"
        )

    return english, rejected
