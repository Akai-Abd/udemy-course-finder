"""
Udemy Course Finder — Scraper: E-next

Scrapes free Udemy courses from e-next.in.
"""

import logging

from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class EnextScraper(BaseScraper):
    """Scraper for e-next.in — free Udemy course aggregator."""

    @property
    def name(self) -> str:
        return "E-next"

    @property
    def base_url(self) -> str:
        return "https://jobs.e-next.in/course/udemy"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from E-next."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 3  # Fetch 3 pages of courses

        while page_num <= max_pages:
            try:
                url = (
                    f"{self.base_url}/{page_num}"
                    if page_num > 1
                    else self.base_url
                )
                self.logger.info(f"Fetching page {page_num}: {url}")

                soup = self._fetch_page(url)
                if not soup:
                    break

                page_courses = self._parse_listing(soup)
                if not page_courses:
                    break

                courses.extend(page_courses)
                self.logger.info(f"Page {page_num}: {len(page_courses)} courses")

                # Check for next page
                next_link = soup.select_one(
                    "a.next, .next a, .pagination .next, .nav-links .next, .pagination li:last-child a"
                )
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from E-next")
        return courses

    def _parse_listing(self, soup) -> list[ScrapedCourse]:
        """Parse a listing page for course entries."""
        courses = []

        # E-next uses a grid layout with course cards
        items = soup.select(
            "article, .post, .course-item, .card, "
            "[class*='entry'], [class*='grid-item'], .portfolio-item"
        )

        if not items:
            return self._extract_from_links(soup)

        for item in items:
            try:
                course = self._parse_item(item)
                if course:
                    courses.append(course)
            except Exception as e:
                self.logger.debug(f"Failed to parse item: {e}")

        return courses

    def _parse_item(self, item) -> ScrapedCourse | None:
        """Parse a single course item."""
        # Find the detail link
        link_el = item.select_one("a[href*='/course/udemy/']")
        if not link_el:
            return None

        detail_url = link_el.get("href", "")
        if not detail_url:
            return None

        # Title is inside class h6
        title_el = item.select_one(".h6, h2, h3, h4, .title")
        if not title_el:
            title_el = link_el

        title = title_el.get_text(strip=True)
        if not title or len(title) < 5:
            return None

        # Image
        img = item.select_one("img[src]")
        thumbnail_url = None
        if img:
            thumbnail_url = img.get("src")

        # Category and Language from .course-icon
        category = None
        language = "English"
        icon_div = item.select_one(".course-icon")
        if icon_div:
            text = icon_div.get_text(strip=True)
            parts = [p.strip() for p in text.split("|")]
            if len(parts) >= 1:
                language = parts[0]
            if len(parts) >= 2:
                category = parts[1]

        # Follow detail page to extract coupon URL
        coupon_url = self._get_coupon_from_detail(detail_url)
        if not coupon_url:
            return None

        return self._make_course(
            title=title,
            udemy_url=coupon_url,
            coupon_url=coupon_url,
            thumbnail_url=thumbnail_url,
            category=category,
            language=language,
        )

    def _get_coupon_from_detail(self, url: str) -> str:
        """Visit detail page to extract Udemy coupon link."""
        try:
            soup = self._fetch_page(url)
            if not soup:
                return ""

            selectors = [
                "a[href*='udemy.com/course/'][href*='couponCode']",
                "a[href*='udemy.com/course/']",
                ".entry-content a[href*='udemy']",
                "a.btn[href*='udemy']",
                "a[target='_blank'][href*='udemy']",
            ]

            for selector in selectors:
                link = soup.select_one(selector)
                if link:
                    return link.get("href", "")

        except Exception as e:
            self.logger.debug(f"Failed to get coupon from {url}: {e}")

        return ""

    def _extract_from_links(self, soup) -> list[ScrapedCourse]:
        """Fallback: extract courses from Udemy links."""
        courses = []
        seen = set()

        for link in soup.select("a[href*='udemy.com/course/']"):
            href = link.get("href", "")
            if href in seen:
                continue
            seen.add(href)

            title = link.get_text(strip=True)
            if title and len(title) >= 5:
                courses.append(self._make_course(
                    title=title,
                    udemy_url=href,
                    coupon_url=href,
                    language="English",
                ))

        return courses

    def _fetch_page(self, url: str):
        """Fetch and parse a page with custom headers to prevent Brotli encoding."""
        try:
            response = self.http.get(url, headers={"Accept-Encoding": "gzip, deflate"})
            if response.status_code != 200:
                self.logger.warning(f"Non-200 status {response.status_code} for {url}")
                return None
            return self._parse_html(response.text)
        except Exception as e:
            self.logger.error(f"Failed to fetch {url}: {e}")
            return None
