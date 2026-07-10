"""
Udemy Course Finder — Data Models

Defines the ScrapedCourse dataclass used throughout the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class ScrapedCourse:
    """
    Normalized course representation used by the scraping pipeline.

    Scrapers produce instances of this class, which then flow through
    the normalize → validate → language-filter → dedup → store pipeline.
    """

    title: str
    udemy_url: str = ""
    coupon_url: str = ""
    udemy_course_id: str | None = None
    provider_name: str = ""
    category: str | None = None
    language: str | None = None
    thumbnail_url: str | None = None
    rating: float | None = None
    instructor: str | None = None
    price_original: float | None = None
    is_free: bool = True
    expires_at: datetime | None = None
    description: str | None = None

    def has_required_fields(self) -> bool:
        """Check if the minimum required fields are present."""
        return bool(self.title and (self.udemy_url or self.coupon_url))

    def metadata_richness(self) -> int:
        """
        Score how much metadata this course has.
        Used for dedup: prefer the record with richer data.
        """
        score = 0
        if self.description:
            score += 2
        if self.thumbnail_url:
            score += 1
        if self.rating is not None:
            score += 1
        if self.instructor:
            score += 1
        if self.category:
            score += 1
        if self.price_original is not None:
            score += 1
        if self.expires_at is not None:
            score += 1
        if self.udemy_course_id:
            score += 2
        return score


@dataclass
class ScrapeResult:
    """Result of a single provider scrape run."""

    provider_name: str
    provider_id: str = ""
    job_id: str = ""
    status: str = "SUCCESS"  # SUCCESS, FAILED, CANCELLED
    message: str | None = None
    courses_found: int = 0
    courses_accepted: int = 0
    courses_rejected: int = 0
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: datetime | None = None
    courses: list[ScrapedCourse] = field(default_factory=list)

    def mark_finished(self, status: str = "SUCCESS", message: str | None = None) -> None:
        """Mark this result as finished."""
        self.finished_at = datetime.now(timezone.utc)
        self.status = status
        if message:
            self.message = message

    @property
    def duration_seconds(self) -> float:
        """Duration of the scrape run in seconds."""
        if self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return 0.0
