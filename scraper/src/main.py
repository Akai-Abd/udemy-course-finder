"""
Udemy Course Finder — Scraper Engine Entry Point

Initializes the scraper engine, connects to Redis and PostgreSQL,
starts the job queue listener and the scheduled scraping cron.
"""

import signal
import sys
import threading
import time
from datetime import datetime, timezone

from src.config import load_config, Config
from src.db import Database
from src.queue import JobConsumer
from src.models import ScrapeResult
from src.providers import create_scraper, SCRAPER_REGISTRY, ALL_SCRAPERS
from src.pipeline.normalizer import normalize_batch
from src.pipeline.validator import validate_batch
from src.pipeline.language_filter import filter_english
from src.pipeline.deduplicator import deduplicate_batch
from src.pipeline.store import store_courses, create_log_entry, update_provider_status
from src.pipeline.expiry_validator import validate_active_courses
from src.utils.logging import setup_logging, get_logger

logger = get_logger(__name__)


class ScraperEngine:
    """
    Main scraper engine orchestrator.

    - Connects to Redis and PostgreSQL
    - Listens for BullMQ jobs from the NestJS backend
    - Runs scheduled scraping on a configurable interval
    - Processes the full scraping pipeline per provider
    """

    def __init__(self, config: Config):
        self.config = config
        self.db = Database(config.database_url)
        self.queue = JobConsumer(config.redis_url, config.queue_name)
        self._shutdown_event = threading.Event()
        self._scheduler_thread: threading.Thread | None = None

    def start(self) -> None:
        """Start the scraper engine."""
        logger.info("=" * 60)
        logger.info("  Udemy Course Finder — Scraper Engine")
        logger.info("=" * 60)
        logger.info(f"  Providers:     {len(SCRAPER_REGISTRY)}")
        logger.info(f"  Interval:      {self.config.scrape_interval_minutes} min")
        logger.info(f"  Delay:         {self.config.scrape_delay_seconds}s between requests")
        logger.info(f"  URL Validation: {'ON' if self.config.validate_urls else 'OFF'}")
        logger.info("=" * 60)

        # Connect to services
        self.db.connect()
        self.queue.connect()

        # Register job handler
        self.queue.on_job(self._handle_job)

        # Start scheduler thread
        self._scheduler_thread = threading.Thread(
            target=self._run_scheduler,
            daemon=True,
            name="scraper-scheduler",
        )
        self._scheduler_thread.start()

        # Start queue listener (blocks)
        logger.info("🚀 Scraper engine started")
        self.queue.start()

    def stop(self) -> None:
        """Gracefully stop the engine."""
        logger.info("🛑 Shutting down scraper engine...")
        self._shutdown_event.set()
        self.queue.stop()
        self.db.disconnect()
        logger.info("Scraper engine stopped")

    def _handle_job(self, job_id: str, job_name: str, data: dict) -> dict:
        """
        Handle an incoming job from the BullMQ queue.

        Job types:
        - scrape-all: scrape all enabled providers
        - scrape-single: scrape a specific provider
        - test-provider: test connectivity for a provider
        """
        if job_name == "scrape-all":
            return self._scrape_all(job_id)
        elif job_name == "scrape-single":
            provider_id = data.get("providerId")
            provider_name = data.get("providerName")
            if provider_name:
                return self._scrape_provider(provider_name, job_id)
            elif provider_id:
                # Look up provider name by ID
                name = self._get_provider_name(provider_id)
                if name:
                    return self._scrape_provider(name, job_id)
                return {"status": "error", "message": f"Provider {provider_id} not found"}
            return {"status": "error", "message": "Missing providerId or providerName"}
        elif job_name == "test-provider":
            provider_name = data.get("providerName")
            provider_id = data.get("providerId")
            if not provider_name and provider_id:
                provider_name = self._get_provider_name(provider_id)
            if provider_name:
                return self._test_provider(provider_name)
            return {"status": "error", "message": "Missing provider info"}
        elif job_name == "validate-active-courses":
            return self._validate_active_courses()
        else:
            logger.warning(f"Unknown job type: {job_name}")
            return {"status": "error", "message": f"Unknown job type: {job_name}"}

    def _get_proxies(self) -> list[str]:
        """Fetch and parse the list of proxies from settings."""
        try:
            row = self.db.execute_one(
                "SELECT value FROM settings WHERE key = %s",
                ("proxies",),
            )
            if not row or not row.get("value"):
                return []
            
            val = row["value"].strip()
            if not val:
                return []
                
            # If it's a JSON array
            if val.startswith("[") and val.endswith("]"):
                import json
                try:
                    return [p.strip() for p in json.loads(val) if p.strip()]
                except Exception:
                    pass
            
            # Fallback to newline-separated
            return [line.strip() for line in val.split("\n") if line.strip()]
        except Exception as e:
            logger.error(f"Failed to fetch proxies from settings: {e}")
            return []

    def _scrape_all(self, job_id: str) -> dict:
        """Scrape all enabled providers."""
        enabled = self._get_enabled_providers()
        logger.info(f"Starting scrape-all: {len(enabled)} enabled providers")

        results = []
        for provider_name in enabled:
            result = self._scrape_provider(provider_name, job_id)
            results.append(result)

        total_accepted = sum(r.get("courses_accepted", 0) for r in results)
        total_found = sum(r.get("courses_found", 0) for r in results)

        return {
            "status": "completed",
            "providers_scraped": len(results),
            "total_found": total_found,
            "total_accepted": total_accepted,
        }

    def _scrape_provider(self, provider_name: str, job_id: str = "") -> dict:
        """
        Run the full scraping pipeline for a single provider.

        Pipeline: Scrape → Normalize → Validate → English-filter → Dedup → Store
        """
        result = ScrapeResult(
            provider_name=provider_name,
            job_id=job_id,
            started_at=datetime.now(timezone.utc),
        )

        try:
            logger.info(f"▶ Scraping {provider_name}...")
            update_provider_status(self.db, provider_name, "RUNNING")

            # Get provider config from DB
            provider_config = self._get_provider_config(provider_name)
            timeout_ms = provider_config.get("timeout_ms", self.config.default_timeout_ms) if provider_config else self.config.default_timeout_ms

            # Fetch rotating proxies
            proxies = self._get_proxies()

            # Create scraper instance
            scraper = create_scraper(
                provider_name,
                timeout_ms=timeout_ms,
                delay_seconds=self.config.scrape_delay_seconds,
                max_retries=self.config.max_retries,
                proxies=proxies,
            )

            try:
                # ─── Stage 1: Scrape ───
                raw_courses = scraper.scrape()
                result.courses_found = len(raw_courses)
                logger.info(f"  📥 Found {len(raw_courses)} raw courses")

                if not raw_courses:
                    result.mark_finished("SUCCESS", "No courses found")
                    create_log_entry(self.db, result)
                    update_provider_status(self.db, provider_name, "SUCCESS")
                    return self._result_to_dict(result)

                # ─── Stage 2: Normalize ───
                normalized = normalize_batch(raw_courses)
                logger.info(f"  🔧 Normalized {len(normalized)} courses")

                # ─── Stage 3: Validate ───
                valid, rejected_validation = validate_batch(normalized)
                logger.info(f"  ✓ Validated: {len(valid)} passed, {len(rejected_validation)} rejected")

                # ─── Stage 4: English Filter ───
                english, rejected_language = filter_english(valid)
                logger.info(f"  🌐 English filter: {len(english)} passed, {len(rejected_language)} rejected")

                # ─── Stage 5: Deduplicate ───
                deduplicated = deduplicate_batch(english)
                logger.info(f"  🔀 Deduped: {len(deduplicated)} unique")

                # ─── Stage 6: Store ───
                stored = store_courses(self.db, deduplicated, provider_name)
                logger.info(f"  💾 Stored: {stored} courses")

                result.courses_accepted = stored
                result.courses_rejected = result.courses_found - stored
                result.mark_finished("SUCCESS")

            finally:
                scraper.close()

        except KeyError as e:
            error_msg = f"Provider not found in registry: {e}"
            logger.error(f"  ❌ {error_msg}")
            result.mark_finished("FAILED", error_msg)

        except Exception as e:
            error_msg = f"Scraping failed: {str(e)}"
            logger.error(f"  ❌ {error_msg}")
            result.mark_finished("FAILED", error_msg)

        # Write log entry and update status
        try:
            create_log_entry(self.db, result)
            update_provider_status(self.db, provider_name, result.status)
        except Exception as e:
            logger.error(f"Failed to write result for {provider_name}: {e}")

        logger.info(
            f"  ✅ {provider_name}: found={result.courses_found}, "
            f"accepted={result.courses_accepted}, rejected={result.courses_rejected} "
            f"({result.duration_seconds:.1f}s)"
        )

        return self._result_to_dict(result)

    def _test_provider(self, provider_name: str) -> dict:
        """Test connectivity for a single provider."""
        try:
            proxies = self._get_proxies()
            scraper = create_scraper(
                provider_name,
                timeout_ms=10000,
                delay_seconds=0,
                max_retries=1,
                proxies=proxies,
            )
            try:
                result = scraper.test_connectivity()
                return {"provider": provider_name, **result}
            finally:
                scraper.close()
        except Exception as e:
            return {
                "provider": provider_name,
                "status": "error",
                "message": str(e),
            }

    def _validate_active_courses(self) -> dict:
        """Verify active course coupons and mark expired ones as inactive."""
        from src.utils.http_client import HttpClient
        proxies = self._get_proxies()
        http_client = HttpClient(
            timeout_ms=self.config.default_timeout_ms,
            max_retries=self.config.max_retries,
            delay_seconds=self.config.scrape_delay_seconds,
            proxies=proxies,
        )
        try:
            return validate_active_courses(
                db=self.db,
                http=http_client,
                batch_size=self.config.validate_batch_size,
            )
        finally:
            http_client.close()

    def _run_scheduler(self) -> None:
        """Background thread: enqueue scrape-all jobs on a schedule."""
        interval = self.config.scrape_interval_minutes * 60
        logger.info(
            f"⏰ Scheduler started: scrape-all every {self.config.scrape_interval_minutes} min"
        )

        # Wait a bit before the first scheduled scrape to let things settle
        initial_delay = 30  # seconds
        if self._shutdown_event.wait(initial_delay):
            return

        while not self._shutdown_event.is_set():
            try:
                logger.info("⏰ Scheduler: enqueuing scrape-all job")
                self.queue.enqueue_job("scrape-all", {})
            except Exception as e:
                logger.error(f"Scheduler failed to enqueue job: {e}")

            # Wait for the next interval
            if self._shutdown_event.wait(interval):
                break

        logger.info("Scheduler stopped")

    def _get_enabled_providers(self) -> list[str]:
        """Get list of enabled provider names from the DB."""
        try:
            rows = self.db.execute(
                "SELECT name FROM providers WHERE is_enabled = true ORDER BY name"
            )
            return [row["name"] for row in rows]
        except Exception as e:
            logger.warning(f"Failed to query enabled providers: {e}")
            return ALL_SCRAPERS  # Fallback to all known scrapers

    def _get_provider_name(self, provider_id: str) -> str | None:
        """Look up provider name by ID."""
        try:
            row = self.db.execute_one(
                "SELECT name FROM providers WHERE id = %s",
                (provider_id,),
            )
            return row["name"] if row else None
        except Exception:
            return None

    def _get_provider_config(self, provider_name: str) -> dict | None:
        """Get provider configuration from DB."""
        try:
            return self.db.execute_one(
                "SELECT id, timeout_ms, is_enabled FROM providers WHERE name = %s",
                (provider_name,),
            )
        except Exception:
            return None

    @staticmethod
    def _result_to_dict(result: ScrapeResult) -> dict:
        """Convert a ScrapeResult to a serializable dict."""
        return {
            "provider": result.provider_name,
            "status": result.status,
            "message": result.message,
            "courses_found": result.courses_found,
            "courses_accepted": result.courses_accepted,
            "courses_rejected": result.courses_rejected,
            "duration_seconds": result.duration_seconds,
        }


def main():
    """Entry point for the scraper engine."""
    # Load config
    try:
        config = load_config()
    except ValueError as e:
        print(f"❌ Configuration error: {e}", file=sys.stderr)
        sys.exit(1)

    # Setup logging
    setup_logging(config.log_level)

    # Create engine
    engine = ScraperEngine(config)

    # Signal handlers for graceful shutdown
    def shutdown_handler(sig, frame):
        engine.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # Start
    try:
        engine.start()
    except KeyboardInterrupt:
        engine.stop()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        engine.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
