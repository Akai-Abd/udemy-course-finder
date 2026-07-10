"""
Udemy Course Finder — Redis/BullMQ Job Queue Consumer

Implements a BullMQ-compatible job consumer that listens for scrape jobs
enqueued by the NestJS backend.

BullMQ stores jobs in Redis using a specific key structure:
- bull:<queue>:wait     — jobs waiting to be processed
- bull:<queue>:active   — jobs currently being processed
- bull:<queue>:completed — completed jobs
- bull:<queue>:failed   — failed jobs
- bull:<queue>:<job-id> — job data (hash)
"""

import json
import time
import logging
import traceback
from datetime import datetime
from typing import Callable, Optional

import redis

logger = logging.getLogger(__name__)


class JobConsumer:
    """
    BullMQ-compatible Redis job consumer.

    Listens on the wait list and processes jobs by moving them through
    the wait → active → completed/failed lifecycle.
    """

    def __init__(self, redis_url: str, queue_name: str = "scrape-queue"):
        self.redis_url = redis_url
        self.queue_name = queue_name
        self._prefix = f"bull:{queue_name}"
        self._client: redis.Redis | None = None
        self._running = False
        self._handler: Callable | None = None

    def connect(self) -> None:
        """Connect to Redis."""
        self._client = redis.Redis.from_url(
            self.redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
        )
        # Test connection
        self._client.ping()
        logger.info(f"✅ Connected to Redis for queue '{self.queue_name}'")

    def disconnect(self) -> None:
        """Disconnect from Redis."""
        self._running = False
        if self._client:
            self._client.close()
            logger.info("Redis connection closed")

    def on_job(self, handler: Callable) -> None:
        """Register the job handler callback."""
        self._handler = handler

    def start(self) -> None:
        """
        Start listening for jobs.

        This blocks the calling thread. Call stop() from another thread
        or signal handler to exit.
        """
        if not self._client:
            raise RuntimeError("Not connected. Call connect() first.")
        if not self._handler:
            raise RuntimeError("No job handler registered. Call on_job() first.")

        self._running = True
        wait_key = f"{self._prefix}:wait"
        active_key = f"{self._prefix}:active"

        logger.info(f"🎧 Listening for jobs on '{wait_key}'...")

        while self._running:
            try:
                # BLMOVE: atomically move a job from wait to active
                # Timeout of 5s so we can check _running periodically
                result = self._client.blmove(
                    wait_key, active_key, timeout=5, src="LEFT", dest="RIGHT"
                )

                if result is None:
                    continue  # Timeout, loop to check _running

                job_id = result
                self._process_job(job_id)

            except redis.ConnectionError as e:
                logger.error(f"Redis connection lost: {e}")
                time.sleep(5)
                try:
                    self.connect()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Queue listener error: {e}")
                time.sleep(1)

    def stop(self) -> None:
        """Signal the listener to stop."""
        self._running = False

    def _process_job(self, job_id: str) -> None:
        """Process a single job by its ID."""
        job_key = f"{self._prefix}:{job_id}"
        active_key = f"{self._prefix}:active"

        try:
            # Read job data from Redis hash
            job_data = self._client.hgetall(job_key)
            if not job_data:
                logger.warning(f"Job {job_id} has no data, skipping")
                self._client.lrem(active_key, 1, job_id)
                return

            # Parse job payload
            data = json.loads(job_data.get("data", "{}"))
            job_name = job_data.get("name", "unknown")

            logger.info(f"📋 Processing job {job_id} (type: {job_name})")

            # Execute the handler
            result = self._handler(job_id, job_name, data)

            # Mark as completed
            self._complete_job(job_id, result)

        except Exception as e:
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            logger.error(f"❌ Job {job_id} failed: {e}")
            self._fail_job(job_id, error_msg)

    def _complete_job(self, job_id: str, result: dict | None = None) -> None:
        """Mark a job as completed."""
        job_key = f"{self._prefix}:{job_id}"
        active_key = f"{self._prefix}:active"
        completed_key = f"{self._prefix}:completed"

        try:
            # Update job data
            self._client.hset(job_key, mapping={
                "finishedOn": str(int(time.time() * 1000)),
                "returnvalue": json.dumps(result or {}),
            })

            # Move from active to completed
            self._client.lrem(active_key, 1, job_id)
            self._client.zadd(completed_key, {job_id: time.time() * 1000})

            logger.info(f"✅ Job {job_id} completed")

        except Exception as e:
            logger.error(f"Failed to complete job {job_id}: {e}")

    def _fail_job(self, job_id: str, error_message: str) -> None:
        """Mark a job as failed."""
        job_key = f"{self._prefix}:{job_id}"
        active_key = f"{self._prefix}:active"
        failed_key = f"{self._prefix}:failed"

        try:
            self._client.hset(job_key, mapping={
                "finishedOn": str(int(time.time() * 1000)),
                "failedReason": error_message[:1000],
            })

            self._client.lrem(active_key, 1, job_id)
            self._client.zadd(failed_key, {job_id: time.time() * 1000})

            logger.info(f"❌ Job {job_id} marked as failed")

        except Exception as e:
            logger.error(f"Failed to mark job {job_id} as failed: {e}")

    def enqueue_job(self, job_name: str, data: dict, job_id: str | None = None) -> str:
        """
        Enqueue a job (used by the scheduler for automatic scraping).

        This creates a BullMQ-compatible job in Redis.
        """
        if not self._client:
            raise RuntimeError("Not connected")

        if not job_id:
            job_id = f"{job_name}-{int(time.time() * 1000)}"

        job_key = f"{self._prefix}:{job_id}"
        wait_key = f"{self._prefix}:wait"

        # Create job hash
        self._client.hset(job_key, mapping={
            "name": job_name,
            "data": json.dumps(data),
            "opts": json.dumps({}),
            "timestamp": str(int(time.time() * 1000)),
            "delay": "0",
            "priority": "0",
            "processedOn": "",
            "finishedOn": "",
        })

        # Add to wait list
        self._client.lpush(wait_key, job_id)

        logger.info(f"📤 Enqueued job {job_id} (type: {job_name})")
        return job_id
