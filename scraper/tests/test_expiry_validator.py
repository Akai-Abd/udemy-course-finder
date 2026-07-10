"""
Tests for the expiry validator module.
"""

import pytest
from unittest.mock import MagicMock, patch
import requests

from src.pipeline.expiry_validator import parse_price_from_html, validate_active_courses


class TestParsePriceFromHtml:
    """Tests for parse_price_from_html() price extraction."""

    def test_twitter_meta_free(self):
        html = """
        <html>
        <head>
            <meta name="twitter:label2" content="Price" />
            <meta name="twitter:data2" content="Free" />
        </head>
        </html>
        """
        assert parse_price_from_html(html) == 0.0

    def test_twitter_meta_paid(self):
        html = """
        <html>
        <head>
            <meta name="twitter:label2" content="Price" />
            <meta name="twitter:data2" content="$19.99" />
        </head>
        </html>
        """
        assert parse_price_from_html(html) == 19.99

    def test_og_price_free(self):
        html = """
        <html>
        <head>
            <meta property="og:price:amount" content="0.00" />
        </head>
        </html>
        """
        assert parse_price_from_html(html) == 0.0

    def test_og_price_paid(self):
        html = """
        <html>
        <head>
            <meta property="og:price:amount" content="14.99" />
        </head>
        </html>
        """
        assert parse_price_from_html(html) == 14.99

    def test_json_ld_free(self):
        html = """
        <html>
        <head>
            <script type="application/ld+json">
            {
                "@context": "http://schema.org",
                "@type": "Product",
                "offers": {
                    "@type": "Offer",
                    "price": "0.00"
                }
            }
            </script>
        </head>
        </html>
        """
        assert parse_price_from_html(html) == 0.0

    def test_json_ld_paid(self):
        html = """
        <html>
        <head>
            <script type="application/ld+json">
            {
                "@context": "http://schema.org",
                "@type": "Product",
                "offers": [
                    {
                        "@type": "Offer",
                        "price": "29.99"
                    }
                ]
            }
            </script>
        </head>
        </html>
        """
        assert parse_price_from_html(html) == 29.99

    def test_expired_banner_fallback(self):
        html = """
        <html>
        <body>
            <div>Sorry, this coupon has expired!</div>
        </body>
        </html>
        """
        assert parse_price_from_html(html) == 19.99

    def test_unparseable_html(self):
        html = """
        <html>
        <body>
            <div>No pricing details here at all. Just random text.</div>
        </body>
        </html>
        """
        assert parse_price_from_html(html) is None

    def test_empty_html(self):
        assert parse_price_from_html("") is None
        assert parse_price_from_html(None) is None


class TestValidateActiveCourses:
    """Tests for validate_active_courses() database coordination and logic."""

    @patch("time.sleep", return_value=None)
    def test_verify_courses_and_update_db(self, mock_sleep):
        # Arrange
        db_mock = MagicMock()
        db_mock.execute.return_value = [
            {
                "id": "c1",
                "title": "Still Free Course",
                "udemy_url": "https://udemy.com/c1",
                "coupon_url": "https://udemy.com/c1?coupon=FREE",
                "udemy_course_id": "c1-id",
            },
            {
                "id": "c2",
                "title": "Expired Course",
                "udemy_url": "https://udemy.com/c2",
                "coupon_url": "https://udemy.com/c2?coupon=EXPIRED",
                "udemy_course_id": "c2-id",
            },
            {
                "id": "c3",
                "title": "404 Deleted Course",
                "udemy_url": "https://udemy.com/c3",
                "coupon_url": "https://udemy.com/c3?coupon=404",
                "udemy_course_id": "c3-id",
            },
            {
                "id": "c4",
                "title": "Cloudflare Blocked Course",
                "udemy_url": "https://udemy.com/c4",
                "coupon_url": "https://udemy.com/c4?coupon=403",
                "udemy_course_id": "c4-id",
            },
        ]

        http_mock = MagicMock()
        
        # Mock responses
        res_free = MagicMock()
        res_free.status_code = 200
        res_free.text = '<meta name="twitter:label2" content="Price" /><meta name="twitter:data2" content="Free" />'
        
        res_paid = MagicMock()
        res_paid.status_code = 200
        res_paid.text = '<meta name="twitter:label2" content="Price" /><meta name="twitter:data2" content="$9.99" />'
        
        res_404 = MagicMock()
        res_404.status_code = 404
        
        res_403 = MagicMock()
        res_403.status_code = 403

        # Configure get side effect based on URL
        def get_side_effect(url, **kwargs):
            if "FREE" in url:
                return res_free
            elif "EXPIRED" in url:
                return res_paid
            elif "404" in url:
                return res_404
            elif "403" in url:
                return res_403
            return res_free

        http_mock.get.side_effect = get_side_effect

        # Act
        result = validate_active_courses(db_mock, http_mock, batch_size=10)

        # Assert
        assert result["checked"] == 4
        assert result["active"] == 1
        assert result["expired"] == 2  # c2 (paid) and c3 (404)
        assert result["skipped"] == 1  # c4 (403 blocked)

        # Verify db.execute_many calls
        # 1. expired courses: c2, c3
        # 2. active/skipped courses: c1, c4
        calls = db_mock.execute_many.call_args_list
        assert len(calls) == 2
        
        # Verify expired courses updates contains c2 and c3 ids
        expired_args = calls[0][0][1]
        assert len(expired_args) == 2
        assert expired_args[0] == ("c2",) or expired_args[1] == ("c2",)
        assert expired_args[0] == ("c3",) or expired_args[1] == ("c3",)

        # Verify active/skipped updates contains c1 and c4 ids
        active_args = calls[1][0][1]
        assert len(active_args) == 2
        assert active_args[0] == ("c1",) or active_args[1] == ("c1",)
        assert active_args[0] == ("c4",) or active_args[1] == ("c4",)
