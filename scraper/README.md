# Scraper — Python Scraping Worker

BeautifulSoup-based scraping worker that discovers free Udemy courses from 10 coupon aggregator websites. Runs as a BullMQ job consumer connected to Redis, or standalone via `run_all.py`.

## Architecture

```
BullMQ Job (Redis)
    │
    ▼
┌─────────────────┐
│  ScraperEngine   │
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
| Coupon Scorpion | `CouponScorpionScraper` | `coupon_scorpion.py` |
| CourseJoiner | `CourseJoinerScraper` | `course_joiner.py` |
| Courson | `CoursonScraper` | `courson.py` |
| DiscUdemy | `DiscUdemyScraper` | `discudemy.py` |
| E-next | `EnextScraper` | `enext.py` |
| Freebies Global | `FreebiesGlobalScraper` | `freebies_global.py` |
| FreeWebCart | `FreeWebCartScraper` | `freewebcart.py` |
| iDownloadCoupons | `IDownloadCouponsScraper` | `idownloadcoupons.py` |
| Real Discount | `RealDiscountScraper` | `real_discount.py` |
| Udemy Freebies | `UdemyFreebiesScraper` | `udemy_freebies.py` |

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in your values
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SCRAPE_INTERVAL_MINUTES` | `30` | Auto-scrape interval |
| `SCRAPE_DELAY_SECONDS` | `2` | Delay between HTTP requests |
| `VALIDATE_URLS` | `true` | Validate extracted Udemy URLs |
| `MAX_RETRIES` | `3` | HTTP retry count |
| `DEFAULT_TIMEOUT_MS` | `30000` | HTTP timeout per request |
| `VALIDATE_BATCH_SIZE` | `50` | Courses per expiry validation batch |
| `LOG_LEVEL` | `INFO` | Python log level |

## Running

```bash
# As a BullMQ worker (production)
python -m src.main

# Standalone — scrape all providers without Redis/BullMQ
python run_all.py

# Run a single provider test
python -c "from src.providers.real_discount import RealDiscountScraper; s = RealDiscountScraper(); print(s.test_connectivity())"
```

## Docker

```bash
docker build -t udemy-scraper .
docker run --env-file .env udemy-scraper
```

Uses `python:3.12-slim`. Health check pings Redis.

## Testing

```bash
# Run all tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_pipeline.py -v
python -m pytest tests/test_providers.py -v
python -m pytest tests/test_store.py -v
python -m pytest tests/test_url_parser.py -v
python -m pytest tests/test_expiry_validator.py -v
python -m pytest tests/test_language_filter.py -v

# With coverage
python -m pytest tests/ --cov=src --cov-report=term-missing
```

## Pipeline Stages

1. **Normalize** — Standardize URLs, strip tracking params, clean titles (remove `[FREE]`/`[COUPON]` noise), resolve redirects, extract Udemy course IDs
2. **Validate** — Check required fields (title + URL), verify Udemy URL format
3. **Language Filter** — Keep English courses; reject non-English via `langdetect`
4. **Deduplicate** — Merge courses with same Udemy course ID, prefer records with higher metadata richness score
5. **Store** — Upsert courses and coupon sources into PostgreSQL

## Job Types

| Job Name | Description |
|----------|-------------|
| `scrape-all` | Scrape all enabled providers |
| `scrape-single` | Scrape a specific provider by ID or name |
| `test-provider` | Test provider connectivity |
| `validate-active-courses` | Verify active coupons haven't expired |

## Scripts

| Script | Description |
|--------|-------------|
| `run_all.py` | Standalone runner — scrapes all 10 providers without Redis |
| `src/scripts/update_thumbnails.py` | Replaces blurry thumbnails with high-res Udemy API images |

## Adding a New Provider

1. Create `src/providers/your_provider.py`
2. Extend `BaseScraper`, implement `name`, `base_url`, and `scrape()`
3. Register in `src/providers/__init__.py` (`SCRAPER_REGISTRY`)
4. Add an HTML fixture in `tests/fixtures/`
5. Add tests in `tests/test_providers.py`
6. Seed the provider in `backend/prisma/seed.ts` (parent project)
