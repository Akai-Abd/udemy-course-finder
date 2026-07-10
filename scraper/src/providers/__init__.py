"""
Udemy Course Finder — Provider Scrapers Registry

Exports all 9 provider scrapers and provides a factory for instantiation.
"""

from src.providers.base import BaseScraper
from src.providers.real_discount import RealDiscountScraper
from src.providers.courson import CoursonScraper
from src.providers.enext import EnextScraper
from src.providers.idownloadcoupons import IDownloadCouponsScraper
from src.providers.discudemy import DiscUdemyScraper
from src.providers.udemy_freebies import UdemyFreebiesScraper
from src.providers.coupon_scorpion import CouponScorpionScraper
from src.providers.course_joiner import CourseJoinerScraper
from src.providers.freewebcart import FreeWebCartScraper
from src.providers.freebies_global import FreebiesGlobalScraper

# Map of provider names (matching DB seed) → scraper classes
SCRAPER_REGISTRY: dict[str, type[BaseScraper]] = {
    "Real Discount": RealDiscountScraper,
    "Courson": CoursonScraper,
    "E-next": EnextScraper,
    "iDownloadCoupons": IDownloadCouponsScraper,
    "DiscUdemy": DiscUdemyScraper,
    "Udemy Freebies": UdemyFreebiesScraper,
    "Coupon Scorpion": CouponScorpionScraper,
    "CourseJoiner": CourseJoinerScraper,
    "FreeWebCart": FreeWebCartScraper,
    "Freebies Global": FreebiesGlobalScraper,
}

ALL_SCRAPERS = list(SCRAPER_REGISTRY.keys())


def create_scraper(
    provider_name: str,
    timeout_ms: int = 30000,
    delay_seconds: float = 2.0,
    max_retries: int = 3,
    proxies: list[str] = None,
) -> BaseScraper:
    """
    Factory: create a scraper instance by provider name.

    Raises KeyError if the provider name is not recognized.
    """
    scraper_class = SCRAPER_REGISTRY.get(provider_name)
    if not scraper_class:
        raise KeyError(
            f"Unknown provider '{provider_name}'. "
            f"Available: {', '.join(SCRAPER_REGISTRY.keys())}"
        )
    return scraper_class(
        timeout_ms=timeout_ms,
        delay_seconds=delay_seconds,
        max_retries=max_retries,
        proxies=proxies,
    )
