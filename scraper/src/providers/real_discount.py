"""
Udemy Course Finder — Scraper: Real Discount

Scrapes free Udemy courses from real.discount.
This site provides a listing page that can be parsed for course cards.
"""

import logging
from typing import Optional

from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class RealDiscountScraper(BaseScraper):
    """Scraper for real.discount — free Udemy course aggregator."""

    @property
    def name(self) -> str:
        return "Real Discount"

    @property
    def base_url(self) -> str:
        return "https://www.real.discount"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from Real Discount."""
        courses: list[ScrapedCourse] = []

        try:
            url = "https://cdn.real.discount/api/courses"
            params = {
                "page": 1,
                "limit": 100,
                "sortBy": "sale_start",
                "store": "Udemy"
            }
            self.logger.info(f"Fetching JSON listings from {url}")

            data = self._fetch_json(url, params=params)
            if not data or not isinstance(data, dict):
                self.logger.warning("Failed to fetch Real Discount JSON data")
                return courses

            items = data.get("items", [])
            self.logger.info(f"Found {len(items)} courses in JSON response")

            for item in items:
                try:
                    title = item.get("name")
                    udemy_url = item.get("url")
                    if not title or not udemy_url:
                        continue

                    # Clean or parse rating if it is an float/int
                    rating = None
                    if item.get("rating") is not None:
                        try:
                            rating = float(item["rating"])
                        except (ValueError, TypeError):
                            pass

                    courses.append(self._make_course(
                        title=title,
                        udemy_url=udemy_url,
                        coupon_url=udemy_url,
                        thumbnail_url=item.get("image"),
                        category=item.get("category"),
                        rating=rating,
                        language=item.get("language") or "English",
                    ))
                except Exception as e:
                    self.logger.debug(f"Failed to parse item: {e}")

        except Exception as e:
            self.logger.error(f"Error scraping Real Discount: {e}")

        self.logger.info(f"Scraped {len(courses)} courses from Real Discount")
        return courses
