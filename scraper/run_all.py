"""
Udemy Course Finder — Standalone Live Scraper Runner

Executes all 10 scraper sources, parses live Udemy coupons,
and persists results into SQLite database (dev.db).
"""

import os
import sys
import logging
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.db import Database
from src.providers import ALL_SCRAPERS, create_scraper
from src.pipeline.normalizer import normalize_batch
from src.pipeline.store import store_courses, create_log_entry, update_provider_status
from src.models import ScrapeResult

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("StandaloneScraper")


def run_all_scrapers():
    db_path = os.environ.get("DATABASE_URL", "../backend/dev.db")
    logger.info(f"🚀 Starting Standalone Scraper Engine with DB: {db_path}")

    db = Database(db_path)
    db.connect()

    total_scraped = 0
    total_stored = 0

    for provider_name in ALL_SCRAPERS:
        scraper = create_scraper(provider_name)
        logger.info(f"🔎 Running scraper: {scraper.name} ({scraper.base_url})...")
        started_at = datetime.now(timezone.utc)

        try:
            raw_courses = scraper.scrape()
            courses_found = len(raw_courses)
            logger.info(f"Found {courses_found} raw course links from {scraper.name}")

            normalized = normalize_batch(raw_courses)
            stored = store_courses(db, normalized, scraper.name)

            finished_at = datetime.now(timezone.utc)
            total_scraped += courses_found
            total_stored += stored

            update_provider_status(db, scraper.name, "SUCCESS")

            result = ScrapeResult(
                provider_name=scraper.name,
                job_id="live-standalone-job",
                status="SUCCESS",
                message=f"Scraped {courses_found} links, saved/updated {stored} courses.",
                courses_found=courses_found,
                courses_accepted=stored,
                courses_rejected=courses_found - stored,
                started_at=started_at,
                finished_at=finished_at,
            )
            create_log_entry(db, result)
            logger.info(f"✅ {scraper.name}: Saved {stored} courses to database\n")

        except Exception as e:
            logger.error(f"❌ Failed scraping {scraper.name}: {e}\n")
            update_provider_status(db, scraper.name, "FAILED")

    logger.info("=" * 60)
    logger.info(f"🎉 All 10 scrapers completed! Total courses stored/updated: {total_stored}")
    logger.info("=" * 60)


if __name__ == "__main__":
    run_all_scrapers()
