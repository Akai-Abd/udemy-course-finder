"""
Udemy Course Finder — Scraper: Coupon Scorpion

Scrapes free Udemy courses from couponscorpion.com.
"""

import logging
import re
from bs4 import BeautifulSoup
from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class CouponScorpionScraper(BaseScraper):
    """Scraper for couponscorpion.com — popular Udemy coupon portal."""

    @property
    def name(self) -> str:
        return "Coupon Scorpion"

    @property
    def base_url(self) -> str:
        return "https://couponscorpion.com"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from Coupon Scorpion."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 3  # Scrape top 3 pages

        while page_num <= max_pages:
            try:
                # Target the Udemy coupons category archive
                url = (
                    f"{self.base_url}/category/100-off-coupons/page/{page_num}/"
                    if page_num > 1
                    else f"{self.base_url}/category/100-off-coupons/"
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

                # Check if a next page button exists
                next_link = soup.select_one("a.next, .pagination .next, .nav-links .next")
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from Coupon Scorpion")
        return courses

    def _parse_listing(self, soup: BeautifulSoup) -> list[ScrapedCourse]:
        """Parse listing page for course cards/articles."""
        courses = []
        # Target typical WordPress post structures on Coupon Scorpion
        posts = soup.select(
            "div.news-community, article.post, .post, .type-post, .coupon-item, .card, "
            "[class*='grid-item'], [class*='post-container']"
        )

        if not posts:
            # Fallback to general articles
            posts = soup.select("article")

        for post in posts:
            try:
                course = self._parse_post(post)
                if course:
                    courses.append(course)
            except Exception as e:
                self.logger.debug(f"Failed to parse post: {e}")

        return courses

    def _parse_post(self, post) -> ScrapedCourse | None:
        """Parse a single post card into a ScrapedCourse."""
        title_el = post.select_one(
            "h2.entry-title a, h3.entry-title a, .post-title a, h3 a, h2 a, a.title, [class*='title'] a"
        )
        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        detail_url = title_el.get("href", "")

        if not title or len(title) < 5 or not detail_url:
            return None

        # Image/Thumbnail
        img = post.select_one("img[src], img[data-src], img[data-lazy-src]")
        thumbnail_url = None
        if img:
            thumbnail_url = (
                img.get("data-lazy-src") or img.get("data-src") or img.get("src")
            )

        # Category
        cat_el = post.select_one("a[rel='category tag'], .category a, [class*='category']")
        category = cat_el.get_text(strip=True) if cat_el else None

        # Extract Udemy link from detail page
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
        """Fetch detail page and extract the Udemy coupon link."""
        try:
            soup = self._fetch_page(url)
            if not soup:
                return ""

            # Check direct links first
            selectors = [
                "a[href*='udemy.com/course/'][href*='couponCode']",
                "a[href*='udemy.com/course/']",
                ".entry-content a[href*='udemy.com']",
                "a.btn-coupon[href*='udemy']",
                "a.coupon-code-link",
            ]

            for selector in selectors:
                link = soup.select_one(selector)
                if link:
                    href = link.get("href", "")
                    if "udemy.com" in href:
                        return href

            # Check redirect links or script outgoing links
            # E.g. couponscorpion.com/scripts/udemy/out.php?id=XXX or couponscorpion.com/coupon/out/...
            out_links = soup.select(
                "a[href*='/out.php'], a[href*='/scripts/udemy/'], a[href*='/coupon/']"
            )
            for link in out_links:
                href = link.get("href", "")
                if not href:
                    continue

                if not href.startswith("http"):
                    href = f"{self.base_url.rstrip('/')}{href}"

                if "udemy.com" in href:
                    return href

                # Follow outgoing redirect to get the target URL
                final_url = self._follow_outgoing_redirect(href)
                if final_url and "udemy.com" in final_url:
                    return final_url

        except Exception as e:
            self.logger.debug(f"Failed to get coupon from {url}: {e}")

        return ""

    def _follow_outgoing_redirect(self, url: str) -> str:
        """Follow redirect link to resolve the target Udemy URL."""
        try:
            # Try HEAD request first for speed
            response = self.http.head(url, allow_redirects=True, timeout=5.0)
            if response.url and "udemy.com" in response.url:
                return response.url

            # Fallback to GET with short timeout
            response = self.http.get(url, allow_redirects=True, timeout=5.0)
            if response.url and "udemy.com" in response.url:
                return response.url

            # Also check if it's a meta refresh or script redirect
            if response.status_code == 200:
                soup = self._parse_html(response.text)
                udemy_link = soup.select_one("a[href*='udemy.com/course/']")
                if udemy_link:
                    return udemy_link.get("href", "")

                meta_refresh = soup.select_one("meta[http-equiv='refresh']")
                if meta_refresh:
                    content = meta_refresh.get("content", "")
                    match = re.search(r"url=(.+)", content, re.IGNORECASE)
                    if match and "udemy.com" in match.group(1):
                        return match.group(1).strip("\"'")

        except Exception as e:
            self.logger.debug(f"Failed to follow redirect {url}: {e}")

        return ""
