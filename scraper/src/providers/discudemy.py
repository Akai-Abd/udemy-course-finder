"""
Udemy Course Finder — Scraper: DiscUdemy

Scrapes free Udemy courses from discudemy.com.
DiscUdemy uses a multi-step process: listing → detail page → reveal coupon URL.
"""

import logging
import re

from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class DiscUdemyScraper(BaseScraper):
    """
    Scraper for discudemy.com.

    DiscUdemy has a multi-step reveal process:
    1. Listing page shows course cards
    2. Each card links to a detail page
    3. Detail page has a "Go to course" link that reveals the actual Udemy coupon URL
    """

    @property
    def name(self) -> str:
        return "DiscUdemy"

    @property
    def base_url(self) -> str:
        return "https://www.discudemy.com"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from DiscUdemy."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 5

        while page_num <= max_pages:
            try:
                url = f"{self.base_url}/all/{page_num}" if page_num > 1 else f"{self.base_url}/all"
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
                next_link = soup.select_one("a.next, .pagination .next, li.next a")
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from DiscUdemy")
        return courses

    def _parse_listing(self, soup) -> list[ScrapedCourse]:
        """Parse the listing page for course cards."""
        courses = []

        # DiscUdemy uses section.card for course items within article containers
        cards = soup.select(
            "section.card, .card, article.card, "
            ".content .card, [class*='course-card']"
        )

        if not cards:
            cards = soup.select("article, .post, [class*='entry']")

        for card in cards:
            try:
                course = self._parse_card(card)
                if course:
                    courses.append(course)
            except Exception as e:
                self.logger.debug(f"Failed to parse card: {e}")

        return courses

    def _parse_card(self, card) -> ScrapedCourse | None:
        """Parse a single card into a ScrapedCourse."""
        # Title and link
        title_el = card.select_one(
            "h3 a, h2 a, .title a, [class*='title'] a, a.card-header"
        )
        if not title_el:
            # Try finding any link
            title_el = card.select_one("a[href]")

        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        detail_url = title_el.get("href", "")

        if not title or len(title) < 5:
            return None

        # Make detail URL absolute
        if detail_url and not detail_url.startswith("http"):
            detail_url = f"{self.base_url}{detail_url}"

        # Image
        img = card.select_one("img[src], img[data-src]")
        thumbnail_url = None
        if img:
            thumbnail_url = img.get("data-src") or img.get("src")

        # Category
        cat_el = card.select_one(".category, [class*='category'], .badge, .tag")
        category = cat_el.get_text(strip=True) if cat_el else None

        # DiscUdemy requires visiting detail → go-to-course page
        coupon_url = ""
        if detail_url:
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

    def _get_coupon_from_detail(self, detail_url: str) -> str:
        """
        Visit the detail page and extract the coupon URL.

        DiscUdemy often has a "Go to course" link that points to another
        page with the actual Udemy coupon URL.
        """
        try:
            soup = self._fetch_page(detail_url)
            if not soup:
                return ""

            # Look for the "Go to course" or coupon reveal link
            go_link = soup.select_one(
                "a[href*='udemy.com/course/'][href*='couponCode'],"
                "a[href*='udemy.com/course/'],"
                "a[class*='go-to'], a[class*='enroll'],"
                ".coupon-link a, .ud-btn a"
            )

            if go_link:
                href = go_link.get("href", "")
                if "udemy.com" in href:
                    return href

                # May be an intermediate page — follow it
                if href and not href.startswith("http"):
                    href = f"{self.base_url}{href}"

                if href:
                    return self._follow_redirect(href)

            # Check for intermediate "go/" page pattern
            go_links = soup.select("a[href*='/go/'], a[href*='redirect']")
            for link in go_links:
                href = link.get("href", "")
                if href and not href.startswith("http"):
                    href = f"{self.base_url}{href}"
                result = self._follow_redirect(href)
                if result and "udemy.com" in result:
                    return result

        except Exception as e:
            self.logger.debug(f"Failed to get coupon from {detail_url}: {e}")

        return ""

    def _follow_redirect(self, url: str) -> str:
        """Follow a redirect URL to get the final Udemy URL."""
        try:
            response = self.http.get(url, allow_redirects=False, timeout=10.0)

            # Check for redirect
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location", "")
                if "udemy.com" in location:
                    return location

            # Check response body for Udemy link
            if response.status_code == 200:
                soup = self._parse_html(response.text)
                udemy_link = soup.select_one("a[href*='udemy.com/course/']")
                if udemy_link:
                    return udemy_link.get("href", "")

                # Check for meta refresh redirect
                meta_refresh = soup.select_one("meta[http-equiv='refresh']")
                if meta_refresh:
                    content = meta_refresh.get("content", "")
                    match = re.search(r"url=(.+)", content, re.IGNORECASE)
                    if match and "udemy.com" in match.group(1):
                        return match.group(1).strip("\"'")

        except Exception as e:
            self.logger.debug(f"Failed to follow redirect {url}: {e}")

        return ""
