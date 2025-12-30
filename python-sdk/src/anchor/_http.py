"""HTTP client utilities for Anchor SDK."""

import time
import requests
from typing import Optional, Dict, Any, TYPE_CHECKING

from .exceptions import (
    AnchorAPIError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
    RateLimitError,
    ServerError,
    NetworkError,
    PolicyViolationError,
)

if TYPE_CHECKING:
    from .config import Config


class HttpClient:
    """
    HTTP client with retry logic and error handling.

    Used internally by all namespace classes.
    """

    def __init__(self, config: "Config"):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(
            {"X-API-Key": config.api_key, "User-Agent": "anchorai-python/1.0.0"}
        )

    def _handle_error(self, response: requests.Response) -> None:
        """Parse and raise appropriate exception for API errors"""
        status_code = response.status_code

        try:
            error_data = response.json()
            message = error_data.get("message") or error_data.get(
                "error", "Unknown error"
            )
        except (ValueError, KeyError):
            message = response.text or f"HTTP {status_code}"
            error_data = {}

        # Check for policy violation
        if error_data.get("blocked_by") or error_data.get("policy_name"):
            policy_name = error_data.get("blocked_by") or error_data.get(
                "policy_name", "unknown"
            )
            raise PolicyViolationError(message, policy_name, status_code, error_data)

        if status_code == 400:
            field = error_data.get("field")
            raise ValidationError(message, status_code, error_data, field)
        elif status_code == 401:
            raise AuthenticationError(message, status_code, error_data)
        elif status_code == 403:
            required = error_data.get("required_permission")
            raise AuthorizationError(message, status_code, error_data, required)
        elif status_code == 404:
            raise NotFoundError(message, status_code, error_data)
        elif status_code == 429:
            retry_after = error_data.get("retry_after")
            raise RateLimitError(message, status_code, error_data, retry_after)
        elif 500 <= status_code < 600:
            raise ServerError(message, status_code, error_data)
        else:
            raise AnchorAPIError(message, status_code, error_data)

    def request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to Anchor API with retry logic.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            endpoint: API endpoint path (e.g., "/agents")
            data: Optional request body
            params: Optional query parameters

        Returns:
            Response JSON data

        Raises:
            AnchorAPIError: For API errors
            NetworkError: For network errors
        """
        url = f"{self.config.base_url}{endpoint}"
        last_exception = None

        for attempt in range(self.config.retry_attempts + 1):
            try:
                response = self.session.request(
                    method,
                    url,
                    json=data if data is not None else None,
                    params=params,
                    timeout=self.config.timeout,
                    verify=self.config.verify_ssl,
                )

                if response.ok:
                    # Handle empty responses
                    if not response.content:
                        return {}
                    return response.json()
                else:
                    # Don't retry on client errors (4xx), except 429
                    if (
                        400 <= response.status_code < 500
                        and response.status_code != 429
                    ):
                        self._handle_error(response)

                    # Retry on server errors (5xx) and rate limits (429)
                    if attempt < self.config.retry_attempts:
                        delay = self.config.retry_delay * (2**attempt)
                        time.sleep(delay)
                        continue
                    else:
                        self._handle_error(response)

            except requests.exceptions.Timeout:
                last_exception = NetworkError(
                    f"Request timeout after {self.config.timeout}s"
                )
                if attempt < self.config.retry_attempts:
                    time.sleep(self.config.retry_delay * (2**attempt))
                    continue

            except requests.exceptions.ConnectionError as e:
                last_exception = NetworkError(f"Connection error: {str(e)}")
                if attempt < self.config.retry_attempts:
                    time.sleep(self.config.retry_delay * (2**attempt))
                    continue

            except requests.exceptions.RequestException as e:
                last_exception = NetworkError(f"Request failed: {str(e)}")
                if attempt < self.config.retry_attempts:
                    time.sleep(self.config.retry_delay * (2**attempt))
                    continue

        if last_exception:
            raise last_exception
        raise NetworkError("Request failed after retries")

    def get(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make GET request"""
        return self.request("GET", endpoint, params=params)

    def post(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make POST request"""
        return self.request("POST", endpoint, data=data, params=params)

    def put(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make PUT request"""
        return self.request("PUT", endpoint, data=data, params=params)

    def patch(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make PATCH request"""
        return self.request("PATCH", endpoint, data=data, params=params)

    def delete(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Make DELETE request"""
        return self.request("DELETE", endpoint, params=params)
