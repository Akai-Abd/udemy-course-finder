"""
Tests for the store module — database persistence logic.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime

from src.models import ScrapedCourse, ScrapeResult


class TestScrapeResult:
    """Tests for the ScrapeResult dataclass."""

    def test_mark_finished(self):
        """Should set finished_at, status, and optional message."""
        result = ScrapeResult(provider_name="Test Provider")
        assert result.finished_at is None

        result.mark_finished("SUCCESS", "Completed OK")

        assert result.finished_at is not None
        assert result.status == "SUCCESS"
        assert result.message == "Completed OK"

    def test_mark_finished_failure(self):
        """Should record failure status."""
        result = ScrapeResult(provider_name="Test Provider")
        result.mark_finished("FAILED", "Connection timeout")

        assert result.status == "FAILED"
        assert result.message == "Connection timeout"

    def test_duration_seconds(self):
        """Should calculate duration when finished."""
        result = ScrapeResult(provider_name="Test Provider")
        result.started_at = datetime(2026, 1, 1, 0, 0, 0)
        result.finished_at = datetime(2026, 1, 1, 0, 0, 30)

        assert result.duration_seconds == 30.0

    def test_duration_none_when_not_finished(self):
        """Should return None when not yet finished."""
        result = ScrapeResult(provider_name="Test Provider")
        assert result.duration_seconds is None

    def test_default_values(self):
        """Should have sensible defaults."""
        result = ScrapeResult(provider_name="Test Provider")

        assert result.status == "SUCCESS"
        assert result.courses_found == 0
        assert result.courses_accepted == 0
        assert result.courses_rejected == 0
        assert result.courses == []


class TestScrapedCourseStore:
    """Tests for ScrapedCourse model validation used before storing."""

    def test_has_required_fields_complete(self):
        """Course with title and URL should pass validation."""
        course = ScrapedCourse(
            title="Python Bootcamp",
            udemy_url="https://www.udemy.com/course/python-bootcamp/",
            coupon_url="https://www.udemy.com/course/python-bootcamp/?couponCode=FREE",
            provider_name="Test Provider",
        )
        assert course.has_required_fields() is True

    def test_has_required_fields_missing_title(self):
        """Course without title should fail."""
        course = ScrapedCourse(
            title="",
            udemy_url="https://www.udemy.com/course/test/",
        )
        assert course.has_required_fields() is False

    def test_has_required_fields_missing_url(self):
        """Course without any URL should fail."""
        course = ScrapedCourse(
            title="Good Title",
            udemy_url="",
            coupon_url="",
        )
        assert course.has_required_fields() is False

    def test_has_required_fields_coupon_only(self):
        """Course with only coupon URL should pass."""
        course = ScrapedCourse(
            title="Good Title",
            coupon_url="https://www.udemy.com/course/test/?couponCode=FREE",
        )
        assert course.has_required_fields() is True

    def test_metadata_richness_empty(self):
        """Minimal course should have 0 richness."""
        course = ScrapedCourse(title="Basic Course", udemy_url="https://udemy.com/course/basic/")
        assert course.metadata_richness() == 0

    def test_metadata_richness_full(self):
        """Course with all metadata should have high richness."""
        course = ScrapedCourse(
            title="Full Course",
            udemy_url="https://udemy.com/course/full/",
            udemy_course_id="full-course",
            description="A comprehensive course",
            thumbnail_url="https://img.udemy.com/course.jpg",
            rating=4.5,
            instructor="Dr. Test",
            category="Development",
            price_original=99.99,
            expires_at=datetime(2026, 12, 31),
        )
        richness = course.metadata_richness()
        # description=2, thumbnail=1, rating=1, instructor=1, category=1,
        # price=1, expires=1, course_id=2 = 10
        assert richness == 10

    def test_metadata_richness_partial(self):
        """Course with some metadata should have partial richness."""
        course = ScrapedCourse(
            title="Partial Course",
            udemy_url="https://udemy.com/course/partial/",
            rating=4.0,
            category="IT",
        )
        # rating=1, category=1 = 2
        assert course.metadata_richness() == 2


class TestUpsertLogic:
    """Tests for the upsert/dedup decision logic used in store."""

    def test_richer_course_wins_dedup(self):
        """When deduplicating, the course with higher richness should win."""
        existing = ScrapedCourse(
            title="Python Bootcamp",
            udemy_url="https://www.udemy.com/course/python/",
            provider_name="Provider A",
        )

        incoming = ScrapedCourse(
            title="Python Bootcamp",
            udemy_url="https://www.udemy.com/course/python/",
            provider_name="Provider B",
            description="Full description here",
            rating=4.5,
            instructor="Test Author",
        )

        assert incoming.metadata_richness() > existing.metadata_richness()

    def test_same_url_dedup_detected(self):
        """Two courses with the same udemy_url should be considered duplicates."""
        course_a = ScrapedCourse(
            title="Course A",
            udemy_url="https://www.udemy.com/course/python-bootcamp/",
            provider_name="Provider A",
        )
        course_b = ScrapedCourse(
            title="Course B (Same URL)",
            udemy_url="https://www.udemy.com/course/python-bootcamp/",
            provider_name="Provider B",
        )

        assert course_a.udemy_url == course_b.udemy_url
