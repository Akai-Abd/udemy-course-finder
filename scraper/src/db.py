"""
Udemy Course Finder — Database Connection Pool

Provides a PostgreSQL connection pool using psycopg2.
All database operations go through this module.
"""

import logging
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator
from urllib.parse import urlparse

try:
    import psycopg2
    from psycopg2 import pool, extras
except ImportError:
    psycopg2 = None
    pool = None
    extras = None

logger = logging.getLogger(__name__)


class Database:
    """Connection pool manager supporting PostgreSQL and SQLite."""

    def __init__(self, database_url: str, min_connections: int = 2, max_connections: int = 10):
        self._database_url = database_url
        self._is_sqlite = (
            database_url.startswith("file:")
            or database_url.endswith(".db")
            or "sqlite" in database_url
        )
        self._db_path = (
            database_url.replace("file:", "").split("?")[0]
            if self._is_sqlite
            else None
        )
        self._pool: pool.ThreadedConnectionPool | None = None
        self._min_connections = min_connections
        self._max_connections = max_connections

    def connect(self) -> None:
        """Initialize database connection."""
        if self._is_sqlite:
            logger.info(f"✅ SQLite database initialized: {self._db_path}")
            return

        try:
            parsed = urlparse(self._database_url)
            self._pool = pool.ThreadedConnectionPool(
                self._min_connections,
                self._max_connections,
                host=parsed.hostname,
                port=parsed.port or 5432,
                dbname=parsed.path.lstrip("/").split("?")[0],
                user=parsed.username,
                password=parsed.password,
            )
            logger.info("✅ PostgreSQL connection pool initialized")
        except psycopg2.Error as e:
            logger.error(f"❌ Failed to connect to PostgreSQL: {e}")
            raise

    def disconnect(self) -> None:
        """Close database pool."""
        if self._pool:
            self._pool.closeall()
            logger.info("PostgreSQL connection pool closed")

    @contextmanager
    def get_connection(self) -> Generator:
        """Get database connection."""
        if self._is_sqlite:
            conn = sqlite3.connect(self._db_path or "./dev.db", timeout=30.0)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
            return

        if not self._pool:
            raise RuntimeError("Database pool not initialized. Call connect() first.")

        conn = self._pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)

    def execute(self, query: str, params: tuple | None = None) -> list[dict]:
        """Execute a query and return results as list of dicts."""
        if self._is_sqlite:
            clean_query = query.replace("%s", "?").replace("NOW()", "CURRENT_TIMESTAMP")
            prepared_params = list(params) if params else []
            while "gen_random_uuid()" in clean_query:
                clean_query = clean_query.replace("gen_random_uuid()", "?", 1)
                prepared_params.insert(0, str(uuid.uuid4()))

            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(clean_query, tuple(prepared_params))
                if cursor.description:
                    return [dict(row) for row in cursor.fetchall()]
                return []

        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
            cursor.execute(query, params)
            if cursor.description:
                return [dict(row) for row in cursor.fetchall()]
            return []

    def execute_one(self, query: str, params: tuple | None = None) -> dict | None:
        """Execute a query and return a single result."""
        results = self.execute(query, params)
        return results[0] if results else None

    def execute_many(self, query: str, params_list: list[tuple]) -> None:
        """Execute a query with multiple parameter sets."""
        with self.get_cursor() as cursor:
            extras.execute_batch(cursor, query, params_list)
