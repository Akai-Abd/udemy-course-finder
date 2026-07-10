"""
Tests for pipeline stages: normalizer, validator, language filter, deduplicator.
"""

import pytest
from datetime import datetime

from src.models import ScrapedCourse
from src.pipeline.normalizer import normalize_title, normalize_category, normalize_course
from src.pipeline.validator import validate_course, validate_batch
from src.pipeline.language_filter import filter_english
from src.pipeline.deduplicator import deduplicate_batch


# ─── Normalizer Tests ───

class TestNormalizeTitle:
    """Tests for normalize_title()."""

    def test_strips_free_prefix(self):
        assert normalize_title("[FREE] Python Bootcamp") == "Python Bootcamp"

    def test_strips_udemy_prefix(self):
        assert normalize_title("[UDEMY] Learn React") == "Learn React"

    def test_strips_free_suffix(self):
        assert normalize_title("Python Bootcamp - FREE") == "Python Bootcamp"

    def test_strips_100_off_bracket(self):
        assert normalize_title("[100% OFF] Data Science") == "Data Science"

    def test_fixes_html_entities(self):
        assert normalize_title("Python &amp; Django") == "Python & Django"

    def test_collapses_whitespace(self):
        assert normalize_title("  Python   Bootcamp  ") == "Python Bootcamp"

    def test_preserves_normal_title(self):
        assert normalize_title("Learn Python 3") == "Learn Python 3"

    def test_empty_title(self):
        assert normalize_title("") == ""


class TestNormalizeCategory:
    """Tests for normalize_category()."""

    def test_direct_match(self):
        assert normalize_category("Development") == "development"

    def test_programming_maps_to_development(self):
        assert normalize_category("Programming") == "development"

    def test_case_insensitive(self):
        assert normalize_category("BUSINESS") == "business"

    def test_finance_accounting(self):
        assert normalize_category("Finance & Accounting") == "finance-accounting"

    def test_unknown_category(self):
        assert normalize_category("Quantum Physics") is None

    def test_none_input(self):
        assert normalize_category(None) is None


class TestNormalizeCourse:
    """Tests for normalize_course()."""

    def test_extracts_course_id(self):
        course = ScrapedCourse(
            title="Python Bootcamp",
            coupon_url="https://www.udemy.com/course/python-bootcamp/?couponCode=FREE",
        )
        result = normalize_course(course)
        assert result.udemy_course_id == "python-bootcamp"

    def test_normalizes_rating(self):
        course = ScrapedCourse(
            title="Test Course",
            udemy_url="https://www.udemy.com/course/test/",
            rating=4.56789,
        )
        result = normalize_course(course)
        assert result.rating == 4.6

    def test_invalid_rating_set_to_none(self):
        course = ScrapedCourse(
            title="Test Course",
            udemy_url="https://www.udemy.com/course/test/",
            rating=6.0,  # > 5
        )
        result = normalize_course(course)
        assert result.rating is None


# ─── Validator Tests ───

class TestValidateCourse:
    """Tests for validate_course()."""

    def test_valid_course(self):
        course = ScrapedCourse(
            title="Python Bootcamp",
            udemy_url="https://www.udemy.com/course/python-bootcamp/",
            coupon_url="https://www.udemy.com/course/python-bootcamp/?couponCode=FREE",
            is_free=True,
        )
        is_valid, reason = validate_course(course)
        assert is_valid is True
        assert reason is None

    def test_missing_title(self):
        course = ScrapedCourse(
            title="",
            udemy_url="https://www.udemy.com/course/test/",
        )
        is_valid, reason = validate_course(course)
        assert is_valid is False
        assert reason == "missing_title"

    def test_missing_url(self):
        course = ScrapedCourse(title="Python Course")
        is_valid, reason = validate_course(course)
        assert is_valid is False
        assert reason == "missing_url"

    def test_not_udemy_url(self):
        course = ScrapedCourse(
            title="Python Course",
            udemy_url="https://www.coursera.org/course/python",
        )
        is_valid, reason = validate_course(course)
        assert is_valid is False
        assert reason == "not_udemy_url"

    def test_not_free(self):
        course = ScrapedCourse(
            title="Python Course",
            udemy_url="https://www.udemy.com/course/python/",
            is_free=False,
        )
        is_valid, reason = validate_course(course)
        assert is_valid is False
        assert reason == "not_free"

    def test_short_title(self):
        course = ScrapedCourse(
            title="Py",
            udemy_url="https://www.udemy.com/course/test/",
        )
        is_valid, reason = validate_course(course)
        assert is_valid is False
        assert reason == "title_too_short"


class TestValidateBatch:
    """Tests for validate_batch()."""

    def test_separates_valid_and_invalid(self):
        courses = [
            ScrapedCourse(
                title="Valid Course",
                udemy_url="https://www.udemy.com/course/valid/",
            ),
            ScrapedCourse(title="", udemy_url="https://www.udemy.com/course/empty/"),
        ]
        valid, rejected = validate_batch(courses)
        assert len(valid) == 1
        assert len(rejected) == 1


# ─── Language Filter Tests ───

class TestFilterEnglish:
    """Tests for filter_english()."""

    def test_explicit_english(self):
        courses = [
            ScrapedCourse(
                title="Python Course",
                udemy_url="https://www.udemy.com/course/python/",
                language="English",
            ),
        ]
        english, rejected = filter_english(courses)
        assert len(english) == 1
        assert len(rejected) == 0

    def test_explicit_non_english(self):
        courses = [
            ScrapedCourse(
                title="Curso de Python",
                udemy_url="https://www.udemy.com/course/python-es/",
                language="Spanish",
            ),
        ]
        english, rejected = filter_english(courses)
        assert len(english) == 0
        assert len(rejected) == 1

    def test_normalizes_language_to_english(self):
        courses = [
            ScrapedCourse(
                title="Learn React",
                udemy_url="https://www.udemy.com/course/react/",
                language="en",
            ),
        ]
        english, _ = filter_english(courses)
        assert len(english) == 1
        assert english[0].language == "English"


# ─── Deduplicator Tests ───

class TestDeduplicateBatch:
    """Tests for deduplicate_batch()."""

    def test_deduplicates_by_course_id(self):
        courses = [
            ScrapedCourse(
                title="Python Bootcamp",
                udemy_url="https://www.udemy.com/course/python/",
                udemy_course_id="python",
                provider_name="Source A",
                description="A full course",  # richer
            ),
            ScrapedCourse(
                title="Python Bootcamp",
                udemy_url="https://www.udemy.com/course/python/",
                udemy_course_id="python",
                provider_name="Source B",
            ),
        ]
        result = deduplicate_batch(courses)
        assert len(result) == 1
        assert result[0].description == "A full course"  # kept the richer one

    def test_keeps_different_courses(self):
        courses = [
            ScrapedCourse(
                title="Python Bootcamp",
                udemy_url="https://www.udemy.com/course/python/",
                udemy_course_id="python",
            ),
            ScrapedCourse(
                title="React Bootcamp",
                udemy_url="https://www.udemy.com/course/react/",
                udemy_course_id="react",
            ),
        ]
        result = deduplicate_batch(courses)
        assert len(result) == 2

    def test_deduplicates_by_title_fallback(self):
        courses = [
            ScrapedCourse(
                title="Python Bootcamp",
                udemy_url="https://www.udemy.com/course/python/",
            ),
            ScrapedCourse(
                title="Python Bootcamp",
                udemy_url="https://www.udemy.com/course/python-v2/",
            ),
        ]
        result = deduplicate_batch(courses)
        assert len(result) == 1

    def test_empty_batch(self):
        assert deduplicate_batch([]) == []
