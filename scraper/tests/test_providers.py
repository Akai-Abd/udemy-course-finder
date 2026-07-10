"""
Tests for provider scrapers using HTML fixtures and JSON mocking.

Each test verifies that the scraper correctly extracts course data from the page/API response.
"""

import os
import pytest
from unittest.mock import patch, MagicMock

from src.providers.real_discount import RealDiscountScraper
from src.providers.courson import CoursonScraper
from src.providers.enext import EnextScraper
from src.providers.idownloadcoupons import IDownloadCouponsScraper
from src.providers.discudemy import DiscUdemyScraper
from src.providers.udemy_freebies import UdemyFreebiesScraper

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def load_fixture(filename: str) -> str:
    """Load an HTML fixture file."""
    path = os.path.join(FIXTURES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def make_mock_response(html: str, status_code: int = 200):
    """Create a mock HTTP response with the given HTML content."""
    response = MagicMock()
    response.status_code = status_code
    response.text = html
    return response


class TestRealDiscountScraper:
    """Tests for RealDiscountScraper with mocked JSON data."""

    def test_parses_valid_courses(self):
        """Should extract courses with title, URL, category, and rating."""
        scraper = RealDiscountScraper()
        mock_data = {
            "items": [
                {
                    "name": "Python for Beginners",
                    "url": "https://www.udemy.com/course/python-beginners/?couponCode=FREE",
                    "image": "https://example.com/python.jpg",
                    "category": "Development",
                    "rating": 4.5,
                    "language": "English"
                }
            ]
        }

        with patch.object(scraper.http, "get_json", return_value=mock_data):
            courses = scraper.scrape()

        assert len(courses) == 1
        assert courses[0].title == "Python for Beginners"
        assert courses[0].udemy_url == "https://www.udemy.com/course/python-beginners/?couponCode=FREE"
        assert courses[0].category == "Development"
        assert courses[0].rating == 4.5

    def test_handles_empty_page(self):
        """Should return empty list for a page with no courses."""
        scraper = RealDiscountScraper()

        with patch.object(scraper.http, "get_json", return_value={}):
            courses = scraper.scrape()

        assert courses == []

    def test_handles_network_exception(self):
        """Should return empty list on network exception."""
        scraper = RealDiscountScraper()

        with patch.object(scraper.http, "get_json", side_effect=Exception("timeout")):
            courses = scraper.scrape()

        assert courses == []


class TestCoursonScraper:
    """Tests for CoursonScraper."""

    def test_parses_ajax_response(self):
        scraper = CoursonScraper()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "coupons": [
                {
                    "title": "CISSP Certification",
                    "id_name": "cissp-prep",
                    "coupon_code": "FED63A",
                    "image": "https://example.com/cissp.jpg",
                    "primary_category": "IT & Software",
                    "rating": 4.8,
                    "language": "English",
                    "instructors": [{"John Doe": "https://udemy.com/user/john"}]
                }
            ],
            "total_count": 1
        }

        with patch.object(scraper.http._session, "post", return_value=mock_response):
            courses = scraper.scrape()

        assert len(courses) == 1
        assert courses[0].title == "CISSP Certification"
        assert courses[0].udemy_url == "https://www.udemy.com/course/cissp-prep/?couponCode=FED63A"
        assert courses[0].instructor == "John Doe"


class TestEnextScraper:
    """Tests for EnextScraper."""

    def test_parses_fixture(self):
        html = load_fixture("enext_sample.html")
        scraper = EnextScraper()

        with patch.object(scraper.http, "get", return_value=make_mock_response(html)):
            courses = scraper.scrape()

        assert len(courses) >= 1


class TestIDownloadCouponsScraper:
    """Tests for IDownloadCouponsScraper."""

    def test_parses_fixture(self):
        html = load_fixture("idownloadcoupons_sample.html")
        scraper = IDownloadCouponsScraper()

        with patch.object(scraper.http, "get", return_value=make_mock_response(html)):
            courses = scraper.scrape()

        assert len(courses) >= 1


class TestDiscUdemyScraper:
    """Tests for DiscUdemyScraper."""

    def test_parses_fixture(self):
        html = load_fixture("discudemy_sample.html")
        scraper = DiscUdemyScraper()

        with patch.object(scraper.http, "get", return_value=make_mock_response(html)):
            courses = scraper.scrape()

        assert len(courses) >= 1


class TestUdemyFreebiesScraper:
    """Tests for UdemyFreebiesScraper."""

    def test_parses_fixture(self):
        html = load_fixture("udemy_freebies_sample.html")
        scraper = UdemyFreebiesScraper()

        with patch.object(scraper.http, "get", return_value=make_mock_response(html)):
            courses = scraper.scrape()

        assert len(courses) >= 1


class TestScraperConnectivity:
    """Tests for the base scraper test_connectivity method."""

    def test_connectivity_success(self):
        scraper = RealDiscountScraper()

        with patch.object(
            scraper.http,
            "get",
            return_value=make_mock_response("<html></html>", 200),
        ):
            result = scraper.test_connectivity()

        assert result["status"] == "ok"
        assert result["status_code"] == 200
        assert "response_time_ms" in result

    def test_connectivity_failure(self):
        scraper = RealDiscountScraper()

        with patch.object(
            scraper.http, "get", side_effect=ConnectionError("refused")
        ):
            result = scraper.test_connectivity()

        assert result["status"] == "error"
        assert "Connection failed" in result["message"]


class TestScraperCourseMetadata:
    """Tests that scrapers populate course metadata correctly."""

    def test_provider_name_set(self):
        """All courses should have the provider_name populated."""
        scraper = RealDiscountScraper()
        mock_data = {
            "items": [
                {
                    "name": "Python for Beginners",
                    "url": "https://www.udemy.com/course/python-beginners/?couponCode=FREE",
                    "image": "https://example.com/python.jpg",
                    "category": "Development",
                    "rating": 4.5,
                    "language": "English"
                }
            ]
        }
        with patch.object(scraper.http, "get_json", return_value=mock_data):
            courses = scraper.scrape()

        for course in courses:
            assert course.provider_name == "Real Discount"

    def test_has_required_fields(self):
        """All returned courses should pass has_required_fields."""
        scraper = RealDiscountScraper()
        mock_data = {
            "items": [
                {
                    "name": "Python for Beginners",
                    "url": "https://www.udemy.com/course/python-beginners/?couponCode=FREE",
                    "image": "https://example.com/python.jpg",
                    "category": "Development",
                    "rating": 4.5,
                    "language": "English"
                }
            ]
        }
        with patch.object(scraper.http, "get_json", return_value=mock_data):
            courses = scraper.scrape()

        for course in courses:
            assert course.has_required_fields(), f"Course missing fields: {course.title}"
