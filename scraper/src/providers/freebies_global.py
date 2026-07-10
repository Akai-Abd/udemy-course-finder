"""
Udemy Course Finder — Scraper: Freebies Global

Scrapes free Udemy courses from freebiesglobal.com.
"""

import logging
from bs4 import BeautifulSoup
from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class FreebiesGlobalScraper(BaseScraper):
    """Scraper for freebiesglobal.com — Udemy category."""

    @property
    def name(self) -> str:
        return "Freebies Global"

    @property
    def base_url(self) -> str:
        return "https://freebiesglobal.com"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from Freebies Global."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 3  # Scrape top 3 pages

        while page_num <= max_pages:
            try:
                # Target the Udemy shop list
                url = (
                    f"{self.base_url}/shop/udemy/page/{page_num}/"
                    if page_num > 1
                    else f"{self.base_url}/shop/udemy/"
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

                # Pagination: look for next link
                next_link = soup.select_one("a.next, .pagination .next, li.next a, .nav-links .next")
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from Freebies Global")
        return courses

    def _parse_listing(self, soup: BeautifulSoup) -> list[ScrapedCourse]:
        """Parse listing page for post cards."""
        courses = []
        # Freebies Global uses article.col_item for its shop items grid
        items = soup.select("article.col_item")

        if not items:
            items = soup.select("article")

        for item in items:
            try:
                course = self._parse_item(item)
                if course:
                    courses.append(course)
            except Exception as e:
                self.logger.debug(f"Failed to parse item: {e}")

        return courses

    def _parse_item(self, item) -> ScrapedCourse | None:
        """Parse a single card item into a ScrapedCourse."""
        title_el = item.select_one(
            "h2 a.re_track_btn, h2 a, h3 a, a.title"
        )
        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        detail_url = title_el.get("href", "")

        if not title or len(title) < 5 or not detail_url:
            return None

        # Image/Thumbnail
        img = item.select_one("img[src], img[data-src]")
        thumbnail_url = None
        if img:
            thumbnail_url = img.get("data-src") or img.get("src")

        # Category
        cat_el = item.select_one("a[rel='tag'], .category, [class*='category']")
        category = cat_el.get_text(strip=True) if cat_el else None

        # Resolve Udemy link from detail page
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
        """Fetch detail page and extract Udemy coupon URL."""
        try:
            soup = self._fetch_page(url)
            if not soup:
                return ""

            # Check direct links first
            selectors = [
                "a[href*='udemy.com/course/'][href*='couponCode']",
                "a[href*='udemy.com/course/']",
                ".entry-content a[href*='udemy.com']",
                "a.btn[href*='udemy']",
                "a.go-to-store",
                "a[target='_blank'][href*='udemy']",
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
