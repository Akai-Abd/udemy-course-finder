"""
Udemy Course Finder — Scraper: iDownloadCoupons

Scrapes free Udemy courses from idownloadcoupon.com.
"""

import logging

from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class IDownloadCouponsScraper(BaseScraper):
    """Scraper for idownloadcoupon.com — free Udemy coupon aggregator."""

    @property
    def name(self) -> str:
        return "iDownloadCoupons"

    @property
    def base_url(self) -> str:
        return "https://idownloadcoupon.com"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from iDownloadCoupons."""
        courses: list[ScrapedCourse] = []
        page_num = 1
        max_pages = 5

        while page_num <= max_pages:
            try:
                url = (
                    f"{self.base_url}/page/{page_num}/"
                    if page_num > 1
                    else f"{self.base_url}/udemy-coupon-code/"
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

                next_link = soup.select_one(
                    "a.next, .next a, .pagination .next"
                )
                if not next_link:
                    break

                page_num += 1

            except Exception as e:
                self.logger.error(f"Error on page {page_num}: {e}")
                break

        self.logger.info(f"Scraped {len(courses)} courses from iDownloadCoupons")
        return courses

    def _parse_listing(self, soup) -> list[ScrapedCourse]:
        """Parse a listing page."""
        courses = []

        items = soup.select(
            "li.product, .product, article, .post, .coupon-item, .deal-item, "
            "[class*='entry'], .listing-item"
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
        """Parse a single coupon item."""
        title_el = item.select_one(
            ".woocommerce-loop-product__title, h2 a, h3 a, .entry-title a, .title a, .post-title a, h2"
        )
        if not title_el:
            return None

        title = title_el.get_text(strip=True)
        
        # Detail URL
        detail_url = ""
        if title_el.name == "a":
            detail_url = title_el.get("href", "")
        else:
            link = title_el.select_one("a") or item.select_one("a")
            if link:
                detail_url = link.get("href", "")

        if not title or len(title) < 5:
            return None

        # Image
        img = item.select_one("img[src], img[data-src]")
        thumbnail_url = None
        if img:
            thumbnail_url = img.get("data-src") or img.get("src")

        # Category
        cat_el = item.select_one("a[rel='tag'], .category a, [class*='category']")
        category = cat_el.get_text(strip=True) if cat_el else None

        # Direct Udemy link
        udemy_link = item.select_one("a[href*='udemy.com']")
        coupon_url = ""
        if udemy_link:
            coupon_url = udemy_link.get("href", "")

        # Follow detail page
        if not coupon_url and detail_url:
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
        """Visit detail page or follow product redirect to find the actual Udemy coupon link."""
        try:
            # First try parsing the product redirect link directly
            import re
            match = re.search(r"/udemy/(\d+)", url)
            if match:
                product_id = match.group(1)
                redirect_url = f"{self.base_url.rstrip('/')}/udemy/{product_id}/"
                response = self.http.get(redirect_url, allow_redirects=False)
                location = response.headers.get("Location")
                if location and ("udemy" in location or "trk.udemy.com" in location):
                    return location

            # Fallback to fetching detail page HTML and parsing buttons
            soup = self._fetch_page(url)
            if not soup:
                return ""

            # iDownloadCoupons typically has a prominent coupon/enroll button
            selectors = [
                "a[href*='udemy.com/course/'][href*='couponCode']",
                "a[href*='udemy.com/course/']",
                "a.coupon-btn[href*='udemy']",
                ".coupon-link a[href*='udemy']",
                ".entry-content a[href*='udemy']",
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

    def _extract_from_links(self, soup) -> list[ScrapedCourse]:
        """Fallback: extract from Udemy links."""
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
