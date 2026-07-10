"""
Udemy Course Finder — HTTP Client

Shared requests session with User-Agent rotation, retries, timeouts, and rate limiting.
"""

import time
import logging
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from fake_useragent import UserAgent
    _ua = UserAgent(fallback="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
except Exception:
    _ua = None

logger = logging.getLogger(__name__)

# Default fallback user agents
_FALLBACK_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]
_ua_index = 0


def _get_user_agent() -> str:
    """Get a rotating User-Agent string."""
    global _ua_index
    if _ua:
        try:
            return _ua.random
        except Exception:
            pass
    ua = _FALLBACK_UAS[_ua_index % len(_FALLBACK_UAS)]
    _ua_index += 1
    return ua


class HttpClient:
    """
    HTTP client with session reuse, retries, User-Agent rotation, rate limiting, and proxy support.
    """

    def __init__(
        self,
        timeout_ms: int = 30000,
        max_retries: int = 3,
        delay_seconds: float = 2.0,
        proxies: list[str] = None,
    ):
        self.timeout = timeout_ms / 1000.0
        self.delay_seconds = delay_seconds
        self.proxies = proxies or []
        self._last_request_time: float = 0
        self._session = self._create_session(max_retries)

    def _create_session(self, max_retries: int) -> requests.Session:
        """Create a requests session with retry logic."""
        session = requests.Session()

        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET"],
            raise_on_status=False,
        )

        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,
            pool_maxsize=10,
        )
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    def _rate_limit(self) -> None:
        """Enforce minimum delay between requests."""
        if self.delay_seconds <= 0:
            return

        elapsed = time.time() - self._last_request_time
        if elapsed < self.delay_seconds:
            sleep_time = self.delay_seconds - elapsed
            time.sleep(sleep_time)

    def get(
        self,
        url: str,
        headers: dict | None = None,
        params: dict | None = None,
        timeout: float | None = None,
        allow_redirects: bool = True,
    ) -> requests.Response:
        """
        Perform a GET request with rate limiting, User-Agent rotation, and proxy rotation.

        Raises requests.RequestException on failure.
        """
        self._rate_limit()

        request_headers = {
            "User-Agent": _get_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        if headers:
            request_headers.update(headers)

        request_timeout = timeout or self.timeout
        logger.debug(f"GET {url}")

        proxies_to_try = list(self.proxies) if self.proxies else [None]
        import random
        random.shuffle(proxies_to_try)

        last_err = None
        for proxy in proxies_to_try:
            req_proxies = {"http": proxy, "https": proxy} if proxy else None
            try:
                self._last_request_time = time.time()
                response = self._session.get(
                    url,
                    headers=request_headers,
                    params=params,
                    timeout=request_timeout,
                    allow_redirects=allow_redirects,
                    proxies=req_proxies,
                )
                logger.debug(f"  → {response.status_code} ({len(response.content)} bytes)")
                return response
            except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Request failed using proxy {proxy}: {e}")
                last_err = e
                continue
        
        if last_err:
            raise last_err
        raise requests.RequestException("Request failed with no available proxies")

    def head(
        self,
        url: str,
        timeout: float | None = None,
        allow_redirects: bool = True,
    ) -> requests.Response:
        """Perform a HEAD request with rate limiting and proxy rotation."""
        self._rate_limit()

        request_headers = {
            "User-Agent": _get_user_agent(),
        }

        request_timeout = timeout or min(self.timeout, 10.0)
        logger.debug(f"HEAD {url}")

        proxies_to_try = list(self.proxies) if self.proxies else [None]
        import random
        random.shuffle(proxies_to_try)

        last_err = None
        for proxy in proxies_to_try:
            req_proxies = {"http": proxy, "https": proxy} if proxy else None
            try:
                self._last_request_time = time.time()
                response = self._session.head(
                    url,
                    headers=request_headers,
                    timeout=request_timeout,
                    allow_redirects=allow_redirects,
                    proxies=req_proxies,
                )
                return response
            except (requests.exceptions.ProxyError, requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"HEAD request failed using proxy {proxy}: {e}")
                last_err = e
                continue

        if last_err:
            raise last_err
        raise requests.RequestException("HEAD request failed with no available proxies")

    def get_json(
        self,
        url: str,
        headers: dict | None = None,
        params: dict | None = None,
        timeout: float | None = None,
    ) -> dict | list:
        """Perform a GET request and parse JSON response."""
        request_headers = {
            "Accept": "application/json",
        }
        if headers:
            request_headers.update(headers)

        response = self.get(url, headers=request_headers, params=params, timeout=timeout)
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        """Close the underlying session."""
        self._session.close()
