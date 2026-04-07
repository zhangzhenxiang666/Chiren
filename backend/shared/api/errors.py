"""API error types"""

from __future__ import annotations


class ChirenApiError(RuntimeError):
    """Base class for upstream API failures."""


class AuthenticationFailure(ChirenApiError):
    """Raised when the upstream service rejects the provided credentials."""


class RateLimitFailure(ChirenApiError):
    """Raised when the upstream service rejects the request due to rate limits."""


class RequestFailure(ChirenApiError):
    """Raised for generic request or transport failures."""
