"""
Udemy Course Finder — Scraper Engine Configuration

Reads environment variables and provides typed config to all modules.
"""

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Config:
    """Immutable application configuration loaded from environment."""

    # ─── Database ───
    database_url: str = field(default_factory=lambda: os.environ.get(
        "DATABASE_URL", ""
    ))

    # ─── Redis ───
    redis_url: str = field(default_factory=lambda: os.environ.get(
        "REDIS_URL", "redis://localhost:6379"
    ))

    # ─── Scraping Behavior ───
    scrape_delay_seconds: float = field(default_factory=lambda: float(
        os.environ.get("SCRAPE_DELAY_SECONDS", "2")
    ))
    scrape_interval_minutes: int = field(default_factory=lambda: int(
        os.environ.get("SCRAPE_INTERVAL_MINUTES", "30")
    ))
    validate_urls: bool = field(default_factory=lambda: os.environ.get(
        "VALIDATE_URLS", "true"
    ).lower() == "true")
    max_retries: int = field(default_factory=lambda: int(
        os.environ.get("MAX_RETRIES", "3")
    ))
    default_timeout_ms: int = field(default_factory=lambda: int(
        os.environ.get("DEFAULT_TIMEOUT_MS", "30000")
    ))
    validate_batch_size: int = field(default_factory=lambda: int(
        os.environ.get("VALIDATE_BATCH_SIZE", "50")
    ))
    validate_interval_minutes: int = field(default_factory=lambda: int(
        os.environ.get("VALIDATE_INTERVAL_MINUTES", "60")
    ))

    # ─── Logging ───
    log_level: str = field(default_factory=lambda: os.environ.get(
        "LOG_LEVEL", "INFO"
    ).upper())

    # ─── Queue ───
    queue_name: str = "scrape-queue"

    def validate(self) -> None:
        """Validate required configuration at startup."""
        errors: list[str] = []

        if not self.database_url:
            errors.append("DATABASE_URL is required")
        if not self.redis_url:
            errors.append("REDIS_URL is required")
        if self.scrape_delay_seconds < 0:
            errors.append("SCRAPE_DELAY_SECONDS must be >= 0")
        if self.scrape_interval_minutes < 1:
            errors.append("SCRAPE_INTERVAL_MINUTES must be >= 1")
        if self.validate_batch_size < 1:
            errors.append("VALIDATE_BATCH_SIZE must be >= 1")
        if self.validate_interval_minutes < 1:
            errors.append("VALIDATE_INTERVAL_MINUTES must be >= 1")

        if errors:
            raise ValueError(
                "Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            )


def load_config() -> Config:
    """Load and validate configuration from environment variables."""
    config = Config()
    config.validate()
    return config
