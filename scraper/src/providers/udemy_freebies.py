"""
Udemy Course Finder — Scraper: Udemy Freebies

Scrapes free Udemy courses from udemyfreebies.com.
"""

import logging

from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class UdemyFreebiesScraper(BaseScraper):
    """Scraper for udemyfreebies.com — free Udemy course aggregator."""

    @property
    def name(self) -> str:
        return "Udemy Freebies"

    @property
    def base_url(self) -> str:
        return "https://www.udemyfreebies.com"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from Udemy Freebies."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 5

        while page_num <= max_pages:
            try:
                url = (
                    f"{self.base_url}/free-udemy-courses/{page_num}/"
                    if page_num > 1
                    else f"{self.base_url}/free-udemy-courses/"
                )
                self.logger.info(f"Fetching page {page_num}: {url}")

                soup = self._fetch_page(url)
                if not soup:
                    # Try alternative URL
                    if page_num == 1:
                        soup = self._fetch_page(self.base_url)
                    if not soup:
                        break

                page_courses = self._parse_listing(soup)
                if not page_courses:
                    break

                courses.extend(page_courses)
                self.logger.info(f"Page {page_num}: {len(page_courses)} courses")

                next_link = soup.select_one("a.next, .pagination .next, .next-page")
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from Udemy Freebies")
        return courses

    def _parse_listing(self, soup) -> list[ScrapedCourse]:
        """Parse a listing page for course items."""
        courses = []

        # UdemyFreebies uses card/grid layout
        items = soup.select(
            ".theme-block, .coupon-item, article, .post, "
            ".card, [class*='course'], [class*='deal']"
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
        # Title
        title_el = item.select_one(
            "h2 a, h3 a, .title a, .entry-title a, "
            ".coupon-name a, [class*='title'] a"
        )
        if not title_el:
            title_el = item.select_one("h2, h3, .title, [class*='title']")
        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        if not title or len(title) < 5:
            return None

        # Detail/coupon link
        detail_url = ""
        if title_el.name == "a":
            detail_url = title_el.get("href", "")
        else:
            link = title_el.select_one("a")
            if link:
                detail_url = link.get("href", "")

        # Direct Udemy link
        udemy_link = item.select_one("a[href*='udemy.com']")
        coupon_url = ""
        if udemy_link:
            coupon_url = udemy_link.get("href", "")

        # Image
        img = item.select_one("img[src], img[data-src], img[data-lazy-src]")
        thumbnail_url = None
        if img:
            thumbnail_url = (
                img.get("data-src") or img.get("data-lazy-src") or img.get("src")
            )

        # Category
        cat_el = item.select_one(
            ".category, [class*='category'], a[rel='tag']"
        )
        category = cat_el.get_text(strip=True) if cat_el else None

        # Follow detail page if no direct link
        if not coupon_url and detail_url:
            if not detail_url.startswith("http"):
                detail_url = f"{self.base_url}{detail_url}"
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
        """Visit detail page to extract Udemy coupon link."""
        try:
            soup = self._fetch_page(url)
            if not soup:
                return ""

            # Check for outbound redirect link first
            redirect_link = soup.select_one("a[href*='/out/'], a[href*='udemyfreebies.com/out/']")
            if redirect_link:
                href = redirect_link.get("href", "")
                if href:
                    if not href.startswith("http"):
                        href = f"{self.base_url.rstrip('/')}/{href.lstrip('/')}"
                    
                    # Call GET request with redirect disabled to get location header
                    response = self.http.get(href, allow_redirects=False)
                    location = response.headers.get("Location")
                    if location and "udemy.com" in location:
                        return location

            # Fallback selectors
            selectors = [
                "a[href*='udemy.com/course/'][href*='couponCode']",
                "a[href*='udemy.com/course/']",
                "a.coupon-btn[href*='udemy']",
                ".coupon-details a[href*='udemy']",
                "a[target='_blank'][href*='udemy.com']",
                ".entry-content a[href*='udemy']",
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

    def _extract_from_links(self, soup) -> list[ScrapedCourse]:
        """Fallback extraction from links."""
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
