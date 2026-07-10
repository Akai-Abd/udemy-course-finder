"""
Udemy Course Finder — Pipeline: Deduplicator

Deduplicates courses within a batch and against existing DB records.
Uses udemy_course_id as primary key, normalized title as fallback.
"""

import re
import logging
from typing import Optional

from src.models import ScrapedCourse
from src.db import Database

logger = logging.getLogger(__name__)


def _normalize_title_for_dedup(title: str) -> str:
    """
    Create a normalized version of a title for fuzzy dedup matching.
    Lowercased, stripped of special chars, collapsed whitespace.
    """
    if not title:
        return ""
    # Lowercase
    normalized = title.lower()
    # Remove special characters except spaces and alphanumerics
    normalized = re.sub(r"[^a-z0-9\s]", "", normalized)
    # Collapse whitespace
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def deduplicate_batch(courses: list[ScrapedCourse]) -> list[ScrapedCourse]:
    """
    Deduplicate courses within a single batch.

    Uses udemy_course_id as primary key. When duplicates exist,
    keeps the one with richer metadata.
    """
    # Index by course ID
    by_id: dict[str, ScrapedCourse] = {}
    # Fallback: index by normalized title
    by_title: dict[str, ScrapedCourse] = {}
    # Courses without any dedup key
    unique: list[ScrapedCourse] = []

    for course in courses:
        if course.udemy_course_id:
            key = course.udemy_course_id
            if key in by_id:
                existing = by_id[key]
                # Keep the richer record
                if course.metadata_richness() > existing.metadata_richness():
                    by_id[key] = course
                    logger.debug(
                        f"Dedup: replaced '{existing.title[:40]}' with richer "
                        f"'{course.title[:40]}' (id={key})"
                    )
            else:
                by_id[key] = course
        else:
            # Fallback to title dedup
            norm_title = _normalize_title_for_dedup(course.title)
            if norm_title and norm_title in by_title:
                existing = by_title[norm_title]
                if course.metadata_richness() > existing.metadata_richness():
                    by_title[norm_title] = course
            elif norm_title:
                by_title[norm_title] = course
            else:
                unique.append(course)

    # Merge: remove title-dupes that also match an ID-deduped entry
    id_titles = {
        _normalize_title_for_dedup(c.title)
        for c in by_id.values()
        if c.title
    }
    title_only = [
        c for title, c in by_title.items()
        if title not in id_titles
    ]

    result = list(by_id.values()) + title_only + unique
    removed = len(courses) - len(result)
    if removed > 0:
        logger.info(f"Batch dedup: {removed} duplicates removed, {len(result)} unique")

    return result


def deduplicate_against_db(
    courses: list[ScrapedCourse],
    db: Database,
    provider_id: str,
) -> tuple[list[ScrapedCourse], list[ScrapedCourse]]:
    """
    Check courses against existing DB records.

    Returns (new_courses, existing_courses_to_update).
    Existing courses get their `last_verified_at` updated; new courses are inserted.
    """
    if not courses:
        return [], []

    # Collect all course IDs and titles for batch lookup
    course_ids = [c.udemy_course_id for c in courses if c.udemy_course_id]

    existing_by_id: dict[str, dict] = {}
    if course_ids:
        try:
            placeholders = ",".join(["%s"] * len(course_ids))
            rows = db.execute(
                f"""
                SELECT c.id, c.udemy_course_id, cs.provider_id, c.title
                FROM courses c
                JOIN coupon_sources cs ON c.id = cs.course_id
                WHERE c.udemy_course_id IN ({placeholders})
                  AND cs.provider_id = %s
                """,
                tuple(course_ids) + (provider_id,),
            )
            for row in rows:
                if row["udemy_course_id"]:
                    existing_by_id[row["udemy_course_id"]] = row
        except Exception as e:
            logger.warning(f"DB dedup lookup failed: {e}")

    new_courses = []
    update_courses = []

    for course in courses:
        if course.udemy_course_id and course.udemy_course_id in existing_by_id:
            update_courses.append(course)
        else:
            new_courses.append(course)

    logger.info(
        f"DB dedup: {len(new_courses)} new, {len(update_courses)} existing (will update)"
    )

    return new_courses, update_courses
