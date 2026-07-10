"""
Udemy Course Finder — Pipeline: Expiry Validator

Periodically validates active courses in the database by requesting their Udemy pages,
checking if the coupon has expired (price is no longer free), and updating their status.
"""

import logging
import re
import json
import time
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import requests

from src.db import Database
from src.utils.http_client import HttpClient

logger = logging.getLogger(__name__)


def parse_price_from_html(html: str) -> float | None:
    """
    Parse the course price from Udemy HTML content.

    Returns:
        0.0 if the course is free (active coupon).
        > 0.0 if the course is paid (coupon expired/invalid).
        None if the price could not be determined.
    """
    if not html:
        return None

    soup = BeautifulSoup(html, "lxml")

    # 1. Check Twitter metadata (Udemy uses this extensively for SEO / Rich Cards)
    # <meta name="twitter:label2" content="Price" />
    # <meta name="twitter:data2" content="Free" /> or "$19.99"
    try:
        twitter_label = soup.find("meta", {"name": "twitter:label2"})
        twitter_data = soup.find("meta", {"name": "twitter:data2"})
        if twitter_label and twitter_data:
            label = twitter_label.get("content", "").lower().strip()
            data = twitter_data.get("content", "").lower().strip()
            if "price" in label:
                if any(term in data for term in ["free", "gratis", "gratuito", "gratuit"]):
                    return 0.0
                cleaned = re.sub(r"[^\d.]", "", data)
                if cleaned:
                    try:
                        return float(cleaned)
                    except ValueError:
                        pass
    except Exception as e:
        logger.debug(f"Failed to check Twitter meta: {e}")

    # 2. Check standard OpenGraph price tags
    # <meta property="og:price:amount" content="0.00" />
    try:
        og_price = soup.find("meta", {"property": "og:price:amount"})
        if og_price:
            amount_str = og_price.get("content", "").strip()
            if amount_str:
                try:
                    return float(amount_str)
                except ValueError:
                    pass
    except Exception as e:
        logger.debug(f"Failed to check og:price:amount: {e}")

    # 3. Check JSON-LD Structured Data
    # <script type="application/ld+json">...</script>
    try:
        for script in soup.find_all("script", {"type": "application/ld+json"}):
            try:
                content = script.string or ""
                if not content.strip():
                    continue
                data = json.loads(content)
                if isinstance(data, dict):
                    items = [data]
                elif isinstance(data, list):
                    items = data
                else:
                    continue

                for item in items:
                    offers = item.get("offers")
                    if not offers:
                        continue

                    if isinstance(offers, dict):
                        offers_list = [offers]
                    elif isinstance(offers, list):
                        offers_list = offers
                    else:
                        continue

                    for offer in offers_list:
                        price_val = offer.get("price")
                        if price_val is not None:
                            price_str = str(price_val).lower().strip()
                            if any(term in price_str for term in ["free", "gratis", "gratuito", "gratuit"]):
                                return 0.0
                            cleaned = re.sub(r"[^\d.]", "", price_str)
                            if cleaned:
                                try:
                                    return float(cleaned)
                                except ValueError:
                                    pass
            except Exception:
                pass
    except Exception as e:
        logger.debug(f"Failed to check JSON-LD scripts: {e}")

    # 4. Check if the page content contains explicit Udemy coupon expired banners
    # This is a fallback check
    html_lower = html.lower()
    if "this coupon has expired" in html_lower or "coupon code entered is not valid" in html_lower:
        # If we see these explicitly, but couldn't parse a price, it's safer to consider it paid/expired.
        return 19.99

    return None


def validate_active_courses(db: Database, http: HttpClient, batch_size: int = 50) -> dict:
    """
    Query currently active courses and validate them against Udemy.
    Updates their status in the database.
    """
    logger.info(f"🔍 Starting active course verification (batch size: {batch_size})")

    # Fetch active coupon sources ordered by last_verified_at ascending (oldest first)
    try:
        rows = db.execute(
            """
            SELECT cs.id, c.title, c.udemy_url, cs.coupon_url, c.udemy_course_id
            FROM coupon_sources cs
            JOIN courses c ON cs.course_id = c.id
            WHERE cs.is_active = true
            ORDER BY cs.last_verified_at ASC
            LIMIT %s
            """,
            (batch_size,),
        )
    except Exception as e:
        logger.error(f"Failed to fetch active courses for verification: {e}")
        return {"status": "error", "message": str(e)}

    if not rows:
        logger.info("No active courses to verify.")
        return {
            "status": "completed",
            "checked": 0,
            "active": 0,
            "expired": 0,
            "skipped": 0,
        }

    logger.info(f"Retrieved {len(rows)} active courses to verify")

    checked = 0
    active = 0
    expired = 0
    skipped = 0

    expired_ids = []
    active_ids = []

    for row in rows:
        course_id = row["id"]
        title = row["title"]
        # Use coupon_url if present (since it redirects to Udemy with the coupon),
        # fallback to udemy_url
        url = row["coupon_url"] or row["udemy_url"]

        if not url:
            logger.warning(f"Course '{title}' ({course_id}) has no validation URL, marking as expired.")
            expired_ids.append(course_id)
            expired += 1
            checked += 1
            continue

        logger.debug(f"Checking course: '{title}' via URL: {url}")
        try:
            # Fetch the landing page
            response = http.get(url, allow_redirects=True, timeout=15.0)

            if response.status_code == 404:
                logger.info(f"❌ Expired (404 Not Found): '{title}'")
                expired_ids.append(course_id)
                expired += 1
            elif response.status_code == 403:
                logger.warning(f"⚠️ Skipped (403 Forbidden - Cloudflare/Blocked): '{title}'")
                active_ids.append(course_id)  # Maintain active status
                skipped += 1
            elif response.status_code == 429:
                logger.warning(f"⚠️ Skipped (429 Too Many Requests): '{title}'")
                active_ids.append(course_id)  # Maintain active status
                skipped += 1
            elif response.status_code != 200:
                logger.warning(f"⚠️ Skipped (HTTP {response.status_code}): '{title}'")
                active_ids.append(course_id)  # Maintain active status
                skipped += 1
            else:
                # HTTP 200 OK
                price = parse_price_from_html(response.text)

                if price is None:
                    logger.debug(f"Could not determine price for '{title}', keeping active.")
                    active_ids.append(course_id)
                    skipped += 1
                elif price == 0.0:
                    logger.debug(f"✓ Still Free: '{title}'")
                    active_ids.append(course_id)
                    active += 1
                else:
                    logger.info(f"❌ Expired (Price: {price}): '{title}'")
                    expired_ids.append(course_id)
                    expired += 1

            checked += 1

        except requests.RequestException as e:
            logger.warning(f"⚠️ Network error checking '{title}': {e}")
            active_ids.append(course_id)  # Maintain active status on network errors
            skipped += 1
            checked += 1
        except Exception as e:
            logger.error(f"Unexpected error checking '{title}': {e}")
            active_ids.append(course_id)
            skipped += 1
            checked += 1

        # Add a tiny delay between requests to be gentle on Udemy
        time.sleep(1.0)

    # Perform batch updates
    now = datetime.now(timezone.utc)
    if expired_ids:
        try:
            db.execute_many(
                """
                UPDATE coupon_sources
                SET is_active = false,
                    expires_at = NOW(),
                    last_verified_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                """,
                [(cid,) for cid in expired_ids],
            )
            logger.info(f"Successfully marked {len(expired_ids)} coupon sources as expired.")
        except Exception as e:
            logger.error(f"Database error updating expired coupon sources: {e}")

    if active_ids:
        try:
            db.execute_many(
                """
                UPDATE coupon_sources
                SET last_verified_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                """,
                [(cid,) for cid in active_ids],
            )
            logger.debug(f"Successfully updated verification timestamps for {len(active_ids)} active/skipped coupon sources.")
        except Exception as e:
            logger.error(f"Database error updating active coupon sources: {e}")

    summary = {
        "status": "completed",
        "checked": checked,
        "active": active,
        "expired": expired,
        "skipped": skipped,
    }
    logger.info(f"📊 Verification summary: {summary}")
    return summary
