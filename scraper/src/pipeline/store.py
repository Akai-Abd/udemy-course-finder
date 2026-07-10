"""
Udemy Course Finder — Pipeline: Store

Persists validated, deduplicated courses to PostgreSQL.
Creates log entries and updates provider status.
"""

import logging
from datetime import datetime
from typing import Optional

from src.db import Database
from src.models import ScrapedCourse, ScrapeResult

logger = logging.getLogger(__name__)


def _resolve_provider_id(db: Database, provider_name: str) -> str | None:
    """Look up the provider ID by name."""
    row = db.execute_one(
        "SELECT id FROM providers WHERE name = %s",
        (provider_name,),
    )
    return row["id"] if row else None


def _resolve_category_id(db: Database, category_slug: str | None) -> str | None:
    """Look up the category ID by slug."""
    if not category_slug:
        return None
    row = db.execute_one(
        "SELECT id FROM categories WHERE slug = %s",
        (category_slug,),
    )
    return row["id"] if row else None


def store_courses(
    db: Database,
    courses: list[ScrapedCourse],
    provider_name: str,
) -> int:
    """
    Upsert courses and coupon sources to the database.

    1. Upsert course details to `courses` on conflict of `udemy_course_id`.
    2. Upsert coupon source details to `coupon_sources` on conflict of `(course_id, provider_id)`.

    Returns the number of courses stored/updated.
    """
    provider_id = _resolve_provider_id(db, provider_name)
    if not provider_id:
        logger.error(f"Provider '{provider_name}' not found in database")
        return 0

    stored = 0
    for course in courses:
        # We require a udemy_course_id to uniquely identify the course.
        if not course.udemy_course_id:
            logger.warning(
                f"Skipping course '{course.title[:50]}' because it has no udemy_course_id"
            )
            continue

        try:
            category_id = _resolve_category_id(db, course.category)

            # 1. Upsert global Course record
            row = db.execute_one(
                """
                INSERT INTO courses (
                    id, title, description, udemy_url, udemy_course_id,
                    category_id, language, thumbnail_url, rating,
                    instructor, price_original, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, NOW(), NOW()
                )
                ON CONFLICT (udemy_course_id) DO UPDATE SET
                    title = COALESCE(NULLIF(EXCLUDED.title, ''), courses.title),
                    description = COALESCE(EXCLUDED.description, courses.description),
                    thumbnail_url = CASE
                        WHEN EXCLUDED.thumbnail_url IS NULL THEN courses.thumbnail_url
                        WHEN EXCLUDED.thumbnail_url LIKE '%%couponami.com%%' OR EXCLUDED.thumbnail_url LIKE '%%real.discount%%' OR EXCLUDED.thumbnail_url LIKE '%%freebiesglobal.com%%' OR EXCLUDED.thumbnail_url LIKE '%%coursejoiner.com%%' OR EXCLUDED.thumbnail_url LIKE '%%placeholder%%' THEN COALESCE(courses.thumbnail_url, EXCLUDED.thumbnail_url)
                        ELSE EXCLUDED.thumbnail_url
                    END,
                    rating = COALESCE(EXCLUDED.rating, courses.rating),
                    instructor = COALESCE(NULLIF(EXCLUDED.instructor, ''), courses.instructor),
                    price_original = COALESCE(EXCLUDED.price_original, courses.price_original),
                    category_id = COALESCE(EXCLUDED.category_id, courses.category_id),
                    updated_at = NOW()
                RETURNING id
                """,
                (
                    course.title,
                    course.description,
                    course.udemy_url,
                    course.udemy_course_id,
                    category_id,
                    course.language or "English",
                    course.thumbnail_url,
                    course.rating,
                    course.instructor,
                    course.price_original,
                ),
            )

            if not row:
                logger.error(f"Failed to upsert course '{course.title[:50]}'")
                continue

            course_uuid = row["id"]

            # 2. Upsert CouponSource details
            db.execute(
                """
                INSERT INTO coupon_sources (
                    id, course_id, provider_id, coupon_url,
                    is_free, expires_at, first_seen_at, last_verified_at,
                    is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), %s, %s, %s,
                    %s, %s, NOW(), NOW(),
                    true, NOW(), NOW()
                )
                ON CONFLICT (course_id, provider_id) DO UPDATE SET
                    coupon_url = EXCLUDED.coupon_url,
                    is_free = EXCLUDED.is_free,
                    expires_at = COALESCE(EXCLUDED.expires_at, coupon_sources.expires_at),
                    last_verified_at = NOW(),
                    is_active = true,
                    updated_at = NOW()
                """,
                (
                    course_uuid,
                    provider_id,
                    course.coupon_url,
                    course.is_free,
                    course.expires_at,
                ),
            )
            stored += 1

        except Exception as e:
            logger.warning(
                f"Failed to store course '{course.title[:50]}': {e}"
            )

    logger.info(f"Stored {stored}/{len(courses)} courses for {provider_name}")
    return stored


def create_log_entry(
    db: Database,
    result: ScrapeResult,
) -> None:
    """Create a log entry for a scrape run."""
    provider_id = _resolve_provider_id(db, result.provider_name)
    if not provider_id:
        logger.error(f"Cannot create log: provider '{result.provider_name}' not found")
        return

    try:
        db.execute(
            """
            INSERT INTO logs (
                id, provider_id, job_id, status, message,
                courses_found, courses_accepted, courses_rejected,
                started_at, finished_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            """,
            (
                provider_id,
                result.job_id or None,
                result.status,
                result.message,
                result.courses_found,
                result.courses_accepted,
                result.courses_rejected,
                result.started_at,
                result.finished_at,
            ),
        )
        logger.debug(f"Log entry created for {result.provider_name}")
    except Exception as e:
        logger.error(f"Failed to create log entry: {e}")


def update_provider_status(
    db: Database,
    provider_name: str,
    status: str,
) -> None:
    """Update the provider's last_run_at and last_status."""
    try:
        db.execute(
            """
            UPDATE providers
            SET last_run_at = NOW(),
                last_status = %s,
                updated_at = NOW()
            WHERE name = %s
            """,
            (status, provider_name),
        )
    except Exception as e:
        logger.error(f"Failed to update provider status for '{provider_name}': {e}")
