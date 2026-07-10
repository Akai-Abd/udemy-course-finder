"""
Udemy Course Finder — Pipeline: Normalizer

Normalizes raw scraper output into clean, consistent ScrapedCourse records.
"""

import re
import logging
from typing import Optional

from src.models import ScrapedCourse
from src.utils.url_parser import (
    normalize_udemy_url,
    extract_course_id,
    extract_coupon_code,
    build_coupon_url,
    clean_url,
    resolve_redirect_url,
)

logger = logging.getLogger(__name__)

# Prefixes/suffixes commonly added by coupon sites that aren't part of the real title
_TITLE_NOISE_PATTERNS = [
    re.compile(r"^\[(?:FREE|UDEMY|100%\s*OFF|COUPON|NEW)\]\s*", re.IGNORECASE),
    re.compile(r"\[(?:FREE|UDEMY|100%\s*OFF|COUPON|NEW)\]\s*$", re.IGNORECASE),
    re.compile(r"^(?:FREE|Udemy)\s*[-–—:]\s*", re.IGNORECASE),
    re.compile(r"\s*[-–—]\s*(?:FREE|Free Udemy|Udemy Free|100% Off)\s*$", re.IGNORECASE),
    re.compile(r"\s*\((?:FREE|100%\s*OFF|Udemy\s*Coupon)\)\s*$", re.IGNORECASE),
]

# Category mapping: fuzzy match source categories to seeded slugs
_CATEGORY_MAP: dict[str, str] = {
    # Development
    "development": "development",
    "programming": "development",
    "web development": "development",
    "mobile development": "development",
    "software development": "development",
    "game development": "development",
    "data science": "development",
    "database": "development",
    "software testing": "development",
    "software engineering": "development",
    # Business
    "business": "business",
    "entrepreneurship": "business",
    "management": "business",
    "sales": "business",
    "project management": "business",
    "e-commerce": "business",
    # Finance
    "finance": "finance-accounting",
    "finance & accounting": "finance-accounting",
    "accounting": "finance-accounting",
    "investing": "finance-accounting",
    "cryptocurrency": "finance-accounting",
    # IT & Software
    "it & software": "it-software",
    "it": "it-software",
    "network & security": "it-software",
    "operating systems": "it-software",
    "cloud computing": "it-software",
    "devops": "it-software",
    # Office Productivity
    "office productivity": "office-productivity",
    "microsoft": "office-productivity",
    "google": "office-productivity",
    # Personal Development
    "personal development": "personal-development",
    "leadership": "personal-development",
    "productivity": "personal-development",
    "career development": "personal-development",
    # Design
    "design": "design",
    "graphic design": "design",
    "ui/ux": "design",
    "web design": "design",
    "3d & animation": "design",
    # Marketing
    "marketing": "marketing",
    "digital marketing": "marketing",
    "social media marketing": "marketing",
    "seo": "marketing",
    "content marketing": "marketing",
    # Lifestyle
    "lifestyle": "lifestyle",
    "travel": "lifestyle",
    "food": "lifestyle",
    "beauty": "lifestyle",
    "arts & crafts": "lifestyle",
    "gaming": "lifestyle",
    # Photography
    "photography": "photography-video",
    "photography & video": "photography-video",
    "video editing": "photography-video",
    # Health
    "health & fitness": "health-fitness",
    "health": "health-fitness",
    "fitness": "health-fitness",
    "nutrition": "health-fitness",
    "yoga": "health-fitness",
    "mental health": "health-fitness",
    # Music
    "music": "music",
    "instruments": "music",
    "music production": "music",
    # Teaching
    "teaching & academics": "teaching-academics",
    "teaching": "teaching-academics",
    "academics": "teaching-academics",
    "math": "teaching-academics",
    "science": "teaching-academics",
    "language": "teaching-academics",
}


def normalize_title(title: str) -> str:
    """Clean up a course title by removing noise prefixes/suffixes and fixing whitespace."""
    if not title:
        return title

    cleaned = title.strip()

    # Remove noise patterns
    for pattern in _TITLE_NOISE_PATTERNS:
        cleaned = pattern.sub("", cleaned)

    # Fix encoding artifacts
    cleaned = cleaned.replace("&amp;", "&")
    cleaned = cleaned.replace("&#39;", "'")
    cleaned = cleaned.replace("&quot;", '"')
    cleaned = cleaned.replace("\u2019", "'")
    cleaned = cleaned.replace("\u2014", "-")
    cleaned = cleaned.replace("\u201c", '"')
    cleaned = cleaned.replace("\u201d", '"')

    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned


def normalize_category(category: str | None) -> str | None:
    """Map a source-specific category to one of the seeded category slugs."""
    if not category:
        return None

    key = category.strip().lower()

    # Direct match
    if key in _CATEGORY_MAP:
        return _CATEGORY_MAP[key]

    # Substring match — find the longest matching key
    best_match = None
    best_len = 0
    for cat_key, slug in _CATEGORY_MAP.items():
        if cat_key in key or key in cat_key:
            if len(cat_key) > best_len:
                best_match = slug
                best_len = len(cat_key)

    return best_match


def normalize_course(course: ScrapedCourse) -> ScrapedCourse:
    """
    Normalize a single ScrapedCourse record.

    - Resolve redirects
    - Clean title
    - Normalize URLs
    - Extract Udemy course ID
    - Map category to seeded slugs
    - Clean and upscale thumbnails
    """
    # 1. Resolve redirect URLs first to make sure we work with the final/real URLs
    if course.udemy_url:
        course.udemy_url = resolve_redirect_url(course.udemy_url)
    if course.coupon_url:
        course.coupon_url = resolve_redirect_url(course.coupon_url)

    # Normalize title
    course.title = normalize_title(course.title)

    # Normalize Udemy URL
    if course.udemy_url:
        course.udemy_url = normalize_udemy_url(course.udemy_url)

    # Normalize coupon URL
    if course.coupon_url:
        course.coupon_url = clean_url(course.coupon_url)

    # Extract course ID if not set
    if not course.udemy_course_id:
        course.udemy_course_id = extract_course_id(
            course.coupon_url or course.udemy_url
        )

    # If we have a course ID and coupon code but no proper coupon URL, build one
    if course.udemy_course_id and not course.coupon_url:
        coupon_code = extract_coupon_code(course.udemy_url)
        if coupon_code:
            course.coupon_url = build_coupon_url(course.udemy_course_id, coupon_code)

    # If we have a coupon URL but no udemy_url, derive it
    if course.coupon_url and not course.udemy_url:
        course.udemy_url = normalize_udemy_url(course.coupon_url)

    # Normalize category
    course.category = normalize_category(course.category)

    # Clean and upscale thumbnail URL
    if course.thumbnail_url:
        course.thumbnail_url = clean_url(course.thumbnail_url)
        if any(placeholder in course.thumbnail_url for placeholder in ["FreebiesGlobalLogo", "noimage_220_150", "couponami.com/img/"]):
            course.thumbnail_url = None
        else:
            # 1. Reconstruct official Udemy CDN URL from local/wordpress uploads (e.g. coursejoiner.com, freebiesglobal.com)
            # which contain the original Udemy course image filename structure: COURSE_ID_HASH
            match = re.search(r"(\d+_[a-zA-Z0-9_]+)", course.thumbnail_url)
            if match:
                course.thumbnail_url = f"https://img-c.udemycdn.com/course/750x422/{match.group(1)}.jpg"
            # 2. Otherwise if it's already a direct Udemy CDN URL, ensure it is upscaled
            elif "udemycdn.com" in course.thumbnail_url or "/course/" in course.thumbnail_url:
                course.thumbnail_url = re.sub(
                    r"/course/(?:50x50|100x100|200x120|240x135|304x171|480x270|750x422)/",
                    "/course/750x422/",
                    course.thumbnail_url
                )

    # Normalize rating
    if course.rating is not None:
        try:
            course.rating = round(float(course.rating), 1)
            if course.rating < 0 or course.rating > 5:
                course.rating = None
        except (ValueError, TypeError):
            course.rating = None

    # Normalize price
    if course.price_original is not None:
        try:
            course.price_original = round(float(course.price_original), 2)
            if course.price_original < 0:
                course.price_original = None
        except (ValueError, TypeError):
            course.price_original = None

    # Enhance course from Udemy API if we have the slug
    if course.udemy_course_id:
        course = enhance_course_from_udemy(course)

    return course


_udemy_client = None
_udemy_api_failed_count = 0
_udemy_api_disabled = False


def enhance_course_from_udemy(course: ScrapedCourse) -> ScrapedCourse:
    """Enhance course metadata with high-res image and instructor info from Udemy API."""
    global _udemy_client, _udemy_api_failed_count, _udemy_api_disabled
    if not course.udemy_course_id or _udemy_api_disabled:
        return course

    if _udemy_client is None:
        try:
            from src.utils.http_client import HttpClient
            _udemy_client = HttpClient(timeout_ms=10000, delay_seconds=1.0)
        except Exception as e:
            logger.warning(f"Could not initialize HttpClient for Udemy API enhancement: {e}")
            return course

    url = f"https://www.udemy.com/api-2.0/courses/{course.udemy_course_id}/"
    try:
        data = _udemy_client.get_json(url)
        if isinstance(data, dict):
            new_thumbnail = data.get("image_480x270") or data.get("image_240x135")
            if new_thumbnail:
                course.thumbnail_url = new_thumbnail

            instructors = data.get("visible_instructors", [])
            if instructors and (not course.instructor or course.instructor.strip() == ""):
                course.instructor = instructors[0].get("display_name") or instructors[0].get("title")
    except Exception as e:
        _udemy_api_failed_count += 1
        if _udemy_api_failed_count >= 3:
            _udemy_api_disabled = True
            logger.warning(
                f"Udemy API calls failed multiple times. Disabling enhancement to prevent slow runs. Error: {e}"
            )
        else:
            logger.warning(f"Failed to enhance course '{course.title}' from Udemy API: {e}")

    return course


def normalize_batch(courses: list[ScrapedCourse]) -> list[ScrapedCourse]:
    """Normalize a batch of courses."""
    normalized = []
    for course in courses:
        try:
            normalized.append(normalize_course(course))
        except Exception as e:
            logger.warning(f"Failed to normalize course '{course.title}': {e}")
    return normalized
