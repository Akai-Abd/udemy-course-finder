"""
Udemy Course Finder — Scripts: Update Thumbnails

Updates existing course thumbnails (like those hosted on couponami.com)
to the high-resolution official images from Udemy's public API.
"""

import sys
import os
import re
import time
import requests
import logging

# Ensure src path is in Python path if running from scraper root
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.config import load_config
from src.db import Database
from src.utils.url_parser import extract_course_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("update_thumbnails")

def update_blurry_thumbnails():
    config = load_config()
    db = Database(config.database_url)
    db.connect()

    try:
        # Fetch all courses that currently have a blurry or placeholder image.
        # Prioritize data:image placeholders by sorting them first.
        courses = db.execute(
            """
            SELECT id, title, udemy_url, udemy_course_id, thumbnail_url, instructor 
            FROM courses
            ORDER BY 
                CASE WHEN thumbnail_url LIKE 'data:image%' THEN 0 ELSE 1 END ASC,
                id ASC
            """
        )
        logger.info(f"Loaded {len(courses)} courses from database.")

        updated_count = 0
        for i, course in enumerate(courses):
            course_id = course["id"]
            title = course["title"]
            udemy_course_id = course["udemy_course_id"] or extract_course_id(course["udemy_url"])
            current_thumbnail = course["thumbnail_url"]
            current_instructor = course["instructor"]

            if not udemy_course_id:
                logger.warning(f"[{i+1}/{len(courses)}] Could not determine Udemy course slug for: {title}")
                continue

            # Reconstruct official Udemy CDN URL from local/wordpress uploads (e.g. coursejoiner.com, freebiesglobal.com)
            if current_thumbnail:
                match = re.search(r"(\d+_[a-zA-Z0-9_]+)", current_thumbnail)
                if match and "udemycdn.com" not in current_thumbnail:
                    new_thumbnail = f"https://img-c.udemycdn.com/course/750x422/{match.group(1)}.jpg"
                    db.execute(
                        """
                        UPDATE courses 
                        SET thumbnail_url = %s, 
                            updated_at = NOW() 
                        WHERE id = %s
                        """,
                        (new_thumbnail, course_id)
                    )
                    logger.info(f"  --> Reconstructed Udemy CDN URL from local upload to: {new_thumbnail}")
                    updated_count += 1
                    continue

            # Skip if it is already a high-resolution udemycdn image
            if current_thumbnail and "udemycdn.com" in current_thumbnail:
                if any(size in current_thumbnail for size in ["/course/50x50/", "/course/100x100/", "/course/200x120/", "/course/240x135/", "/course/304x171/", "/course/480x270/"]):
                    new_thumbnail = re.sub(
                        r"/course/(?:50x50|100x100|200x120|240x135|304x171|480x270)/",
                        "/course/750x422/",
                        current_thumbnail
                    )
                    db.execute(
                        """
                        UPDATE courses 
                        SET thumbnail_url = %s, 
                            updated_at = NOW() 
                        WHERE id = %s
                        """,
                        (new_thumbnail, course_id)
                    )
                    logger.info(f"  --> Directly upscaled Udemy CDN URL to: {new_thumbnail}")
                    updated_count += 1
                    continue
                else:
                    logger.info(f"[{i+1}/{len(courses)}] Skipping (already high-res): {title}")
                    continue

            logger.info(f"[{i+1}/{len(courses)}] Processing: {title} (slug: {udemy_course_id})")

            # Query the unauthenticated Udemy API
            api_url = f"https://www.udemy.com/api-2.0/courses/{udemy_course_id}/"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
            }

            try:
                response = requests.get(api_url, headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    new_thumbnail = data.get("image_480x270") or data.get("image_240x135")
                    
                    # Try to parse instructor
                    instructors = data.get("visible_instructors", [])
                    new_instructor = current_instructor
                    if instructors and (not current_instructor or current_instructor.strip() == ""):
                        new_instructor = instructors[0].get("display_name") or instructors[0].get("title")

                    if new_thumbnail:
                        # Update database
                        db.execute(
                            """
                            UPDATE courses 
                            SET thumbnail_url = %s, 
                                instructor = %s, 
                                updated_at = NOW() 
                            WHERE id = %s
                            """,
                            (new_thumbnail, new_instructor, course_id)
                        )
                        logger.info(f"  --> Updated image to: {new_thumbnail}")
                        if new_instructor != current_instructor:
                            logger.info(f"  --> Updated instructor to: {new_instructor}")
                        updated_count += 1
                    else:
                        logger.warning("  --> Udemy API succeeded but no image URL was found.")
                else:
                    logger.warning(f"  --> Udemy API returned status code {response.status_code}")
            except Exception as e:
                logger.error(f"  --> Error fetching Udemy API: {e}")

            # Sleep briefly to avoid getting rate-limited
            time.sleep(1.0)

        logger.info(f"Migration completed. Updated {updated_count} course(s).")
    finally:
        db.disconnect()

if __name__ == "__main__":
    update_blurry_thumbnails()
