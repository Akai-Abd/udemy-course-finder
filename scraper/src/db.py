"""
Udemy Course Finder — Database Connection Pool

Provides a PostgreSQL connection pool using psycopg2.
All database operations go through this module.
"""

import logging
from contextlib import contextmanager
from typing import Generator
from urllib.parse import urlparse

import psycopg2
from psycopg2 import pool, extras

logger = logging.getLogger(__name__)


class Database:
    """PostgreSQL connection pool manager."""

    def __init__(self, database_url: str, min_connections: int = 2, max_connections: int = 10):
        self._database_url = database_url
        self._pool: pool.ThreadedConnectionPool | None = None
        self._min_connections = min_connections
        self._max_connections = max_connections

    def connect(self) -> None:
        """Initialize the connection pool."""
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
        """Close all connections in the pool."""
        if self._pool:
            self._pool.closeall()
            logger.info("PostgreSQL connection pool closed")

    @contextmanager
    def get_connection(self) -> Generator:
        """Get a connection from the pool (context manager)."""
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

    @contextmanager
    def get_cursor(self, cursor_factory=None) -> Generator:
        """Get a cursor from a pooled connection (context manager)."""
        factory = cursor_factory or extras.RealDictCursor
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=factory)
            try:
                yield cursor
            finally:
                cursor.close()

    def execute(self, query: str, params: tuple | None = None) -> list[dict]:
        """Execute a query and return results as list of dicts."""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            if cursor.description:
                return [dict(row) for row in cursor.fetchall()]
            return []

    def execute_one(self, query: str, params: tuple | None = None) -> dict | None:
        """Execute a query and return a single result."""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            if cursor.description:
                row = cursor.fetchone()
                return dict(row) if row else None
            return None

    def execute_many(self, query: str, params_list: list[tuple]) -> None:
        """Execute a query with multiple parameter sets."""
        with self.get_cursor() as cursor:
            extras.execute_batch(cursor, query, params_list)
