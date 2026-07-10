"""
Udemy Course Finder — Base Scraper

Abstract base class that all 9 provider scrapers extend.
Provides shared HTTP client, error handling, and common scraping utilities.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Optional

from bs4 import BeautifulSoup

from src.models import ScrapedCourse
from src.utils.http_client import HttpClient
from src.utils.url_parser import extract_course_id

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """
    Abstract base scraper that all provider implementations extend.

    Subclasses must implement:
    - name: str property identifying the provider
    - base_url: str property with the site's base URL
    - scrape(): performs the actual scraping and returns a list of ScrapedCourse
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name (must match the seeded provider name in DB)."""
        ...

    @property
    @abstractmethod
    def base_url(self) -> str:
        """Base URL of the coupon aggregator site."""
        ...

    def __init__(
        self,
        timeout_ms: int = 30000,
        delay_seconds: float = 2.0,
        max_retries: int = 3,
        proxies: list[str] = None,
    ):
        self.http = HttpClient(
            timeout_ms=timeout_ms,
            max_retries=max_retries,
            delay_seconds=delay_seconds,
            proxies=proxies,
        )
        self.logger = logging.getLogger(f"scraper.{self.name}")

    @abstractmethod
    def scrape(self) -> list[ScrapedCourse]:
        """
        Scrape the provider site and return a list of raw ScrapedCourse objects.

        These objects will be processed through the pipeline stages
        (normalize → validate → filter → dedup → store).
        """
        ...

    def test_connectivity(self) -> dict:
        """
        Test basic connectivity to the provider site.

        Returns a dict with 'status', 'status_code', 'response_time_ms', and 'message'.
        """
        start = time.time()
        try:
            response = self.http.get(self.base_url, timeout=10.0)
            elapsed_ms = round((time.time() - start) * 1000)

            return {
                "status": "ok" if response.status_code == 200 else "warning",
                "status_code": response.status_code,
                "response_time_ms": elapsed_ms,
                "message": f"Received HTTP {response.status_code} in {elapsed_ms}ms",
            }
        except Exception as e:
            elapsed_ms = round((time.time() - start) * 1000)
            return {
                "status": "error",
                "status_code": None,
                "response_time_ms": elapsed_ms,
                "message": f"Connection failed: {str(e)}",
            }

    def _parse_html(self, html: str) -> BeautifulSoup:
        """Parse HTML content with BeautifulSoup."""
        return BeautifulSoup(html, "lxml")

    def _fetch_page(self, url: str) -> BeautifulSoup | None:
        """Fetch and parse a page, returning None on failure."""
        try:
            response = self.http.get(url)
            if response.status_code != 200:
                self.logger.warning(f"Non-200 status {response.status_code} for {url}")
                return None
            return self._parse_html(response.text)
        except Exception as e:
            self.logger.error(f"Failed to fetch {url}: {e}")
            return None

    def _fetch_json(self, url: str, params: dict | None = None) -> dict | list | None:
        """Fetch JSON from a URL, returning None on failure."""
        try:
            return self.http.get_json(url, params=params)
        except Exception as e:
            self.logger.error(f"Failed to fetch JSON from {url}: {e}")
            return None

    def _extract_course_id_from_url(self, url: str) -> str | None:
        """Extract Udemy course ID/slug from a URL."""
        return extract_course_id(url)

    def _make_course(self, **kwargs) -> ScrapedCourse:
        """Create a ScrapedCourse with the provider name pre-filled."""
        return ScrapedCourse(provider_name=self.name, **kwargs)

    def close(self) -> None:
        """Clean up HTTP client resources."""
        self.http.close()
