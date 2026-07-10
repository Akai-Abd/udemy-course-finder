"""
Tests for URL parser utility.
"""

import pytest
from src.utils.url_parser import (
    extract_course_id,
    extract_coupon_code,
    normalize_udemy_url,
    build_coupon_url,
    is_udemy_url,
    clean_url,
)


class TestExtractCourseId:
    """Tests for extract_course_id()."""

    def test_standard_course_url(self):
        url = "https://www.udemy.com/course/python-bootcamp/"
        assert extract_course_id(url) == "python-bootcamp"

    def test_course_url_with_coupon(self):
        url = "https://www.udemy.com/course/python-bootcamp/?couponCode=FREE2024"
        assert extract_course_id(url) == "python-bootcamp"

    def test_course_url_without_trailing_slash(self):
        url = "https://www.udemy.com/course/python-bootcamp"
        assert extract_course_id(url) == "python-bootcamp"

    def test_old_format_url(self):
        url = "https://www.udemy.com/python-bootcamp/"
        assert extract_course_id(url) == "python-bootcamp"

    def test_url_with_tracking_params(self):
        url = "https://www.udemy.com/course/python-bootcamp/?couponCode=FREE&utm_source=test"
        assert extract_course_id(url) == "python-bootcamp"

    def test_course_with_numbers(self):
        url = "https://www.udemy.com/course/react-2024-complete-guide/"
        assert extract_course_id(url) == "react-2024-complete-guide"

    def test_course_with_underscores(self):
        url = "https://www.udemy.com/course/web_development_101/"
        assert extract_course_id(url) == "web_development_101"

    def test_non_udemy_url(self):
        url = "https://www.google.com/search?q=udemy"
        assert extract_course_id(url) is None

    def test_empty_url(self):
        assert extract_course_id("") is None

    def test_none_url(self):
        assert extract_course_id(None) is None

    def test_filters_non_course_slugs(self):
        url = "https://www.udemy.com/cart/"
        assert extract_course_id(url) is None


class TestExtractCouponCode:
    """Tests for extract_coupon_code()."""

    def test_standard_coupon(self):
        url = "https://www.udemy.com/course/python/?couponCode=FREE2024"
        assert extract_coupon_code(url) == "FREE2024"

    def test_no_coupon(self):
        url = "https://www.udemy.com/course/python/"
        assert extract_coupon_code(url) is None

    def test_empty_coupon(self):
        url = "https://www.udemy.com/course/python/?couponCode="
        assert extract_coupon_code(url) is None

    def test_empty_url(self):
        assert extract_coupon_code("") is None


class TestNormalizeUdemyUrl:
    """Tests for normalize_udemy_url()."""

    def test_strips_tracking_params(self):
        url = "https://www.udemy.com/course/python/?couponCode=FREE&utm_source=x&ref=y"
        result = normalize_udemy_url(url)
        assert result == "https://www.udemy.com/course/python/?couponCode=FREE"

    def test_canonical_format(self):
        url = "https://udemy.com/course/python"
        result = normalize_udemy_url(url)
        assert result == "https://www.udemy.com/course/python/"

    def test_preserves_coupon_code(self):
        url = "https://www.udemy.com/course/python/?couponCode=ABC123"
        result = normalize_udemy_url(url)
        assert "couponCode=ABC123" in result

    def test_non_udemy_url_passthrough(self):
        url = "https://www.google.com/"
        assert normalize_udemy_url(url) == url


class TestBuildCouponUrl:
    """Tests for build_coupon_url()."""

    def test_builds_correct_url(self):
        result = build_coupon_url("python-bootcamp", "FREE2024")
        assert result == "https://www.udemy.com/course/python-bootcamp/?couponCode=FREE2024"


class TestIsUdemyUrl:
    """Tests for is_udemy_url()."""

    def test_udemy_url(self):
        assert is_udemy_url("https://www.udemy.com/course/python/") is True

    def test_non_udemy_url(self):
        assert is_udemy_url("https://www.google.com/") is False

    def test_empty_url(self):
        assert is_udemy_url("") is False


class TestCleanUrl:
    """Tests for clean_url()."""

    def test_removes_tracking_params(self):
        url = "https://example.com/page?id=1&utm_source=test&ref=abc"
        result = clean_url(url)
        assert "utm_source" not in result
        assert "ref" not in result
        assert "id=1" in result

    def test_preserves_non_tracking_params(self):
        url = "https://example.com/page?id=1&name=test"
        result = clean_url(url)
        assert "id=1" in result
        assert "name=test" in result

    def test_empty_url(self):
        assert clean_url("") == ""
