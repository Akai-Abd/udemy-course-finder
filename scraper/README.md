# Scraper — Python Scraping Worker

BeautifulSoup-based scraping worker that discovers free Udemy courses from 9 coupon aggregator websites. Runs as a BullMQ worker consuming jobs from Redis.

## Architecture

```
BullMQ Job (Redis)
    │
    ▼
┌─────────────────┐
│  Worker (main)   │
│  Picks provider  │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Scraper  │   ← One per provider (extends BaseScraper)
    │ .scrape()│
    └────┬────┘
         │
    ┌────▼────────────────────────────────┐
    │ Pipeline                             │
    │ normalize → validate → lang-filter   │
    │ → dedup → store (PostgreSQL)         │
    └──────────────────────────────────────┘
```

## Providers

Each provider is a Python class in `src/providers/` that extends `BaseScraper`:

| Provider | Class | File |
|----------|-------|------|
| Real Discount | `RealDiscountScraper` | `real_discount.py` |
| Courson | `CoursonScraper` | `courson.py` |
| Tutorial Bar | `TutorialBarScraper` | `tutorial_bar.py` |
| Enext | `EnextScraper` | `enext.py` |
| iDownloadCoupons | `IDownloadCouponsScraper` | `idownloadcoupons.py` |
| Discudemy | `DiscudemyScraper` | `discudemy.py` |
| Udemy Freebies | `UdemyFreebiesScraper` | `udemy_freebies.py` |
| Course Joiner | `CourseJoinerScraper` | `course_joiner.py` |
| Course Vania | `CourseVaniaScraper` | `course_vania.py` |

## Setup

```bash
pip install -r requirements.txt
```

## Running

```bash
# As a BullMQ worker (production)
python -m src.worker

# Run a single provider test
python -c "from src.providers.real_discount import RealDiscountScraper; s = RealDiscountScraper(); print(s.test_connectivity())"
```

## Testing

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_pipeline.py -v
python -m pytest tests/test_providers.py -v
python -m pytest tests/test_store.py -v

# With coverage
python -m pytest tests/ --cov=src --cov-report=term-missing
```

## Adding a New Provider

1. Create `src/providers/your_provider.py`
2. Extend `BaseScraper`, implement `name`, `base_url`, and `scrape()`
3. Register in `src/providers/__init__.py`
4. Add an HTML fixture in `tests/fixtures/`
5. Add tests in `tests/test_providers.py`
6. Seed the provider in `backend/prisma/seed.ts`

## Pipeline Stages

1. **Normalize** — Standardize URLs, strip tracking params, clean text
2. **Validate** — Check required fields (title + URL), verify Udemy URL format
3. **Language Filter** — Keep English and unspecified; drop other languages
4. **Deduplicate** — Merge courses with same Udemy URL, prefer richer metadata
5. **Store** — Upsert into PostgreSQL via the backend API
