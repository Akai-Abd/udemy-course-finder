"""
Udemy Course Finder — Scraper: CourseJoiner

Scrapes free Udemy courses from coursejoiner.com.
"""

import re
import logging
from bs4 import BeautifulSoup
from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class CourseJoinerScraper(BaseScraper):
    """Scraper for coursejoiner.com — free Udemy course indexing platform."""

    @property
    def name(self) -> str:
        return "CourseJoiner"

    @property
    def base_url(self) -> str:
        return "https://coursejoiner.com"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from CourseJoiner."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 3  # Scrape top 3 pages

        while page_num <= max_pages:
            try:
                # Crawl the Free Udemy category pagination
                url = (
                    f"{self.base_url}/category/free-udemy/page/{page_num}/"
                    if page_num > 1
                    else f"{self.base_url}/category/free-udemy/"
                )
                self.logger.info(f"Fetching page {page_num}: {url}")

                soup = self._fetch_page(url)
                if not soup:
                    break

                page_courses = self._parse_listing(soup)
                if not page_courses:
                    self.logger.info(f"No courses found on page {page_num}, stopping.")
                    break

                courses.extend(page_courses)
                self.logger.info(f"Page {page_num}: {len(page_courses)} courses")

                # Pagination: check next button
                next_link = soup.select_one("a.next, .page-nav a, .pagination .next")
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from CourseJoiner")
        return courses

    def _parse_listing(self, soup: BeautifulSoup) -> list[ScrapedCourse]:
        """Parse listing page for post cards."""
        courses = []
        # Target CourseJoiner card containers
        items = soup.select(
            ".td-big-grid-post, .td_module_wrap"
        )

        for item in items:
            try:
                course = self._parse_item(item)
                if course:
                    courses.append(course)
            except Exception as e:
                self.logger.debug(f"Failed to parse item: {e}")

        return courses

    def _parse_item(self, item) -> ScrapedCourse | None:
        """Parse a single post card item."""
        title_el = item.select_one(
            ".td-module-title a, h3 a, h2 a, a.title"
        )
        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        detail_url = title_el.get("href", "")

        if not title or len(title) < 5 or not detail_url:
            return None

        # Thumbnail
        img = item.select_one("img")
        thumbnail_url = None
        if img:
            thumbnail_url = (
                img.get("data-img-url")
                or img.get("data-lazy-src")
                or img.get("data-src")
                or img.get("src")
            )
            # Filter out base64 lazy-load placeholders
            if thumbnail_url and thumbnail_url.startswith("data:image/"):
                actual_url = (
                    img.get("data-img-url")
                    or img.get("data-lazy-src")
                    or img.get("data-src")
                )
                if actual_url and not actual_url.startswith("data:image/"):
                    thumbnail_url = actual_url
                else:
                    thumbnail_url = None

            # Clean WordPress/dimensions suffix (e.g. -265x198) to get high-resolution original image
            if thumbnail_url and not thumbnail_url.startswith("data:image/"):
                thumbnail_url = re.sub(r'-\d+x\d+(\.[a-zA-Z0-9]+)$', r'\1', thumbnail_url)

        # Category
        cat_el = item.select_one("a.td-post-category, .category")
        category = cat_el.get_text(strip=True) if cat_el else None

        # Follow detail URL to get Udemy link
        coupon_url = self._get_coupon_from_detail(detail_url)
        if not coupon_url:
            return None

        return self._make_course(
            title=title,
            udemy_url=coupon_url,
            coupon_url=coupon_url,
            thumbnail_url=thumbnail_url,
            category=category,
            language="English",
        )

    def _get_coupon_from_detail(self, url: str) -> str:
        """Fetch detail page and extract Udemy coupon/redirect URL."""
        try:
            soup = self._fetch_page(url)
            if not soup:
                return ""

            # Check the orange button selector first
            selectors = [
                ".td-post-content .wp-block-button__link",
                "a[href*='udemy.com/course/'][href*='couponCode']",
                "a[href*='udemy.com/course/']",
                "a[href*='trk.udemy.com']",
            ]

            for selector in selectors:
                link = soup.select_one(selector)
                if link:
                    href = link.get("href", "")
                    if "udemy.com" in href:
                        return href

        except Exception as e:
            self.logger.debug(f"Failed to get coupon from {url}: {e}")

        return ""
