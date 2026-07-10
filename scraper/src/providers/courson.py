"""
Udemy Course Finder — Scraper: Courson

Scrapes free Udemy courses from courson.xyz.
"""

import logging

from src.providers.base import BaseScraper
from src.models import ScrapedCourse

logger = logging.getLogger(__name__)


class CoursonScraper(BaseScraper):
    """Scraper for courson.xyz — free Udemy course aggregator."""

    @property
    def name(self) -> str:
        return "Courson"

    @property
    def base_url(self) -> str:
        return "https://courson.xyz"

    def scrape(self) -> list[ScrapedCourse]:
        """Scrape courses from Courson."""
        courses: list[ScrapedCourse] = []
        max_pages = 3  # Fetch up to 90 courses (3 pages of 30)

        try:
            url = f"{self.base_url}/load-more-coupons"
            self.logger.info(f"Scraping courses from Courson load-more API: {url}")

            for page in range(max_pages):
                offset = page * 30
                self.logger.info(f"Fetching Courson offset {offset}")

                headers = {
                    "Content-Type": "application/json"
                }
                payload = {
                    "filters": {},
                    "offset": offset
                }

                # HttpClient exposes the requests.Session object as self.http._session
                # we use it directly to perform a POST request
                response = self.http._session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=self.http.timeout
                )

                if response.status_code != 200:
                    self.logger.warning(f"Non-200 status {response.status_code} for offset {offset}")
                    break

                data = response.json()
                page_coupons = data.get("coupons", [])
                if not page_coupons:
                    self.logger.info(f"No coupons returned at offset {offset}, stopping")
                    break

                self.logger.info(f"Retrieved {len(page_coupons)} coupons at offset {offset}")

                for coupon in page_coupons:
                    title = coupon.get("title")
                    id_name = coupon.get("id_name")
                    if not title or not id_name:
                        continue

                    coupon_code = coupon.get("coupon_code")
                    udemy_url = f"https://www.udemy.com/course/{id_name}/"
                    if coupon_code:
                        udemy_url = f"{udemy_url}?couponCode={coupon_code}"

                    # Extract rating
                    rating = None
                    if coupon.get("rating") is not None:
                        try:
                            rating = float(coupon["rating"])
                        except (ValueError, TypeError):
                            pass

                    # Extract instructor
                    instructor = None
                    instructors_list = coupon.get("instructors")
                    if instructors_list and isinstance(instructors_list, list):
                        # Extract the first instructor name key
                        first_inst = instructors_list[0]
                        if isinstance(first_inst, dict):
                            instructor = next(iter(first_inst.keys()), None)

                    courses.append(self._make_course(
                        title=title,
                        udemy_url=udemy_url,
                        coupon_url=udemy_url,
                        thumbnail_url=coupon.get("image"),
                        category=coupon.get("primary_category"),
                        rating=rating,
                        instructor=instructor,
                        language=coupon.get("language") or "English",
                    ))

                if len(page_coupons) < 30:
                    self.logger.info("Fewer than 30 coupons returned, reached the end")
                    break

        except Exception as e:
            self.logger.error(f"Error scraping Courson: {e}")

        self.logger.info(f"Scraped {len(courses)} courses from Courson")
        return courses
