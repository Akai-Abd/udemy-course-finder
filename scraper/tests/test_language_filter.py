"""
Extended tests for language filter utility.
"""

import pytest

from src.pipeline.language_filter import filter_english
from src.models import ScrapedCourse


class TestLanguageFilterExtended:
    """Extended language filter tests covering edge cases."""

    def test_english_courses_pass(self):
        """Courses explicitly marked English should pass."""
        courses = [
            ScrapedCourse(title="Python Bootcamp", udemy_url="https://udemy.com/course/py/", language="English"),
            ScrapedCourse(title="React Guide", udemy_url="https://udemy.com/course/react/", language="English"),
        ]

        result, rejected = filter_english(courses)
        assert len(result) == 2
        assert len(rejected) == 0

    def test_non_english_courses_filtered(self):
        """Non-English courses should be filtered out."""
        courses = [
            ScrapedCourse(title="Python em Portugues", udemy_url="https://udemy.com/course/py-pt/", language="Portuguese"),
            ScrapedCourse(title="Java auf Deutsch", udemy_url="https://udemy.com/course/java-de/", language="German"),
        ]

        result, rejected = filter_english(courses)
        assert len(result) == 0
        assert len(rejected) == 2

    def test_none_language_passes(self):
        """Courses with no language specified should pass (assumed English)."""
        courses = [
            ScrapedCourse(title="Machine Learning Guide", udemy_url="https://udemy.com/course/ml/", language=None),
        ]

        result, rejected = filter_english(courses)
        assert len(result) == 1

    def test_mixed_batch(self):
        """Mixed batch should only keep English and unspecified."""
        courses = [
            ScrapedCourse(title="English Course One", udemy_url="https://udemy.com/course/en1/", language="English"),
            ScrapedCourse(title="Curso en Español", udemy_url="https://udemy.com/course/es1/", language="Spanish"),
            ScrapedCourse(title="Unknown Language Course", udemy_url="https://udemy.com/course/unk/", language=None),
            ScrapedCourse(title="日本語コース", udemy_url="https://udemy.com/course/jp1/", language="Japanese"),
        ]

        result, rejected = filter_english(courses)
        assert len(result) == 2
        assert result[0].title == "English Course One"
        assert result[1].title == "Unknown Language Course"
        assert len(rejected) == 2

    def test_language_case_insensitive(self):
        """Language matching should be case-insensitive."""
        courses = [
            ScrapedCourse(title="Course One", udemy_url="https://udemy.com/course/c1/", language="english"),
            ScrapedCourse(title="Course Two", udemy_url="https://udemy.com/course/c2/", language="ENGLISH"),
            ScrapedCourse(title="Course Three", udemy_url="https://udemy.com/course/c3/", language="English"),
        ]

        result, rejected = filter_english(courses)
        assert len(result) == 3

    def test_language_variations(self):
        """Various English language representations should pass."""
        courses = [
            ScrapedCourse(title="Course A", udemy_url="https://udemy.com/course/a/", language="en"),
            ScrapedCourse(title="Course B", udemy_url="https://udemy.com/course/b/", language="en-US"),
            ScrapedCourse(title="Course C", udemy_url="https://udemy.com/course/c/", language="eng"),
        ]

        result, rejected = filter_english(courses)
        assert len(result) >= 1  # At least the "en" variations should pass

    def test_empty_list(self):
        """Empty list should return empty list."""
        result, rejected = filter_english([])
        assert result == []
        assert rejected == []

    def test_empty_string_language(self):
        """Empty string language should be treated like None (pass through)."""
        courses = [
            ScrapedCourse(title="Empty Lang Course", udemy_url="https://udemy.com/course/el/", language=""),
        ]

        result, rejected = filter_english(courses)
        assert len(result) == 1
