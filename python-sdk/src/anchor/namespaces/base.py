"""Base namespace class for Anchor SDK"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .._http import HttpClient


class BaseNamespace:
    """Base class for all namespace classes"""

    def __init__(self, http: "HttpClient"):
        self._http = http
