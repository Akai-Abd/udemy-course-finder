"""
Udemy Course Finder — Standalone Live Scraper Runner

Executes all 10 scraper sources, parses live Udemy coupons,
and persists results into SQLite database (dev.db).
"""

import os
import sys
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
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


def _run_single_scraper(provider_name: str, db_path: str) -> tuple[int, int]:
    """Run an individual scraper and persist results (thread-safe)."""
    db = Database(db_path)
    db.connect()
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
        return courses_found, stored

    except Exception as e:
        logger.error(f"❌ Failed scraping {scraper.name}: {e}\n")
        try:
            update_provider_status(db, scraper.name, "FAILED")
        except Exception:
            pass
        return 0, 0
    finally:
        db.disconnect()


def run_all_scrapers(max_workers: int = 5):
    default_db = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../backend/dev.db")
    )
    db_path = os.environ.get("DATABASE_URL", default_db)
    logger.info(
        f"🚀 Starting Standalone Scraper Engine (Parallel: {max_workers} threads) with DB: {db_path}"
    )

    total_scraped = 0
    total_stored = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_run_single_scraper, name, db_path): name
            for name in ALL_SCRAPERS
        }

        for future in as_completed(futures):
            name = futures[future]
            try:
                found, stored = future.result()
                total_scraped += found
                total_stored += stored
            except Exception as e:
                logger.error(f"Error getting result for {name}: {e}")

    logger.info("=" * 60)
    logger.info(
        f"🎉 All {len(ALL_SCRAPERS)} scrapers completed! Total courses found: {total_scraped}, saved/updated: {total_stored}"
    )
    logger.info("=" * 60)


if __name__ == "__main__":
    run_all_scrapers()
