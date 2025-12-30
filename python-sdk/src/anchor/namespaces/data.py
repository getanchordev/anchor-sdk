"""Data namespace: Policy-checked key-value storage with audit logging."""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime

from .base import BaseNamespace
from ..exceptions import NotFoundError


@dataclass
class WriteResult:
    """Result of a data write operation."""

    key: str
    allowed: bool
    audit_id: str
    blocked_by: Optional[str] = None
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WriteResult":
        return cls(
            key=data.get("key", ""),
            allowed=data.get("allowed", True),
            audit_id=data.get("audit_id", ""),
            blocked_by=data.get("blocked_by"),
            reason=data.get("reason"),
            expires_at=(
                datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
                if data.get("expires_at")
                else None
            ),
            created_at=(
                datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
                if data.get("created_at")
                else None
            ),
        )


@dataclass
class DataEntry:
    """Full data entry with metadata."""

    key: str
    value: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    audit_id: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DataEntry":
        return cls(
            key=data.get("key", ""),
            value=data.get("value", ""),
            metadata=data.get("metadata", {}),
            created_at=(
                datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
                if data.get("created_at")
                else None
            ),
            updated_at=(
                datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
                if data.get("updated_at")
                else None
            ),
            expires_at=(
                datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
                if data.get("expires_at")
                else None
            ),
            audit_id=data.get("audit_id", ""),
        )


@dataclass
class SearchResult:
    """Search result with similarity score."""

    key: str
    value: str
    similarity: float
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SearchResult":
        return cls(
            key=data.get("key", ""),
            value=data.get("value", ""),
            similarity=data.get("similarity", 0.0),
            metadata=data.get("metadata", {}),
        )


class DataNamespace(BaseNamespace):
    """Key-value storage with policy checks and audit logging."""

    def write(
        self,
        agent_id: str,
        key: str,
        value: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WriteResult:
        """
        Write a key-value pair. Policy-checked and audit-logged.

        Args:
            agent_id: Agent ID
            key: Key (e.g., "user:123:preference")
            value: Value to store
            metadata: Optional metadata

        Returns:
            WriteResult with allowed status and audit_id

        Note:
            If blocked by policy, result.allowed will be False
            and result.blocked_by will indicate which policy.
        """
        response = self._http.post(
            f"/agents/{agent_id}/data",
            data={
                "key": key,
                "value": value,
                "metadata": metadata or {},
            },
        )
        return WriteResult.from_dict(response)

    def write_batch(
        self,
        agent_id: str,
        items: Dict[str, str],
    ) -> List[WriteResult]:
        """
        Write multiple key-value pairs.

        Args:
            agent_id: Agent ID
            items: Dict of key -> value pairs

        Returns:
            List of WriteResult objects
        """
        response = self._http.post(
            f"/agents/{agent_id}/data/batch",
            data={"items": [{"key": k, "value": v} for k, v in items.items()]},
        )
        return [WriteResult.from_dict(r) for r in response.get("results", [])]

    def read(self, agent_id: str, key: str) -> Optional[str]:
        """
        Read a value by key. Audit-logged.

        Args:
            agent_id: Agent ID
            key: Key to read

        Returns:
            Value string, or None if not found
        """
        try:
            response = self._http.get(f"/agents/{agent_id}/data/{key}")
            return response.get("value")
        except NotFoundError:
            return None

    def read_full(self, agent_id: str, key: str) -> Optional[DataEntry]:
        """
        Read full entry including metadata.

        Args:
            agent_id: Agent ID
            key: Key to read

        Returns:
            DataEntry object, or None if not found
        """
        try:
            response = self._http.get(f"/agents/{agent_id}/data/{key}")
            return DataEntry.from_dict(response)
        except NotFoundError:
            return None

    def delete(self, agent_id: str, key: str) -> bool:
        """
        Delete a key. Audit-logged.

        Args:
            agent_id: Agent ID
            key: Key to delete

        Returns:
            True if deleted
        """
        self._http.delete(f"/agents/{agent_id}/data/{key}")
        return True

    def delete_prefix(self, agent_id: str, prefix: str) -> int:
        """
        Delete all keys with a prefix.

        Args:
            agent_id: Agent ID
            prefix: Key prefix (e.g., "user:123:")

        Returns:
            Number of keys deleted
        """
        response = self._http.delete(
            f"/agents/{agent_id}/data", params={"prefix": prefix}
        )
        return response.get("deleted_count", 0)

    def list(
        self,
        agent_id: str,
        prefix: Optional[str] = None,
        limit: int = 100,
    ) -> List[str]:
        """
        List keys.

        Args:
            agent_id: Agent ID
            prefix: Optional key prefix filter
            limit: Max keys to return

        Returns:
            List of key strings
        """
        params: Dict[str, Any] = {"limit": limit}
        if prefix:
            params["prefix"] = prefix
        response = self._http.get(f"/agents/{agent_id}/data", params=params)
        return [k.get("key", "") for k in response.get("keys", [])]

    def search(
        self,
        agent_id: str,
        query: str,
        limit: int = 10,
        prefix: Optional[str] = None,
        min_similarity: float = 0.7,
    ) -> List[SearchResult]:
        """
        Search data using vector similarity.

        Args:
            agent_id: Agent ID
            query: Search query
            limit: Max results
            prefix: Optional key prefix filter
            min_similarity: Minimum similarity threshold (0-1)

        Returns:
            List of SearchResult objects with similarity scores
        """
        data: Dict[str, Any] = {
            "query": query,
            "limit": limit,
            "min_similarity": min_similarity,
        }
        if prefix:
            data["prefix"] = prefix

        response = self._http.post(f"/agents/{agent_id}/data/search", data=data)
        return [SearchResult.from_dict(r) for r in response.get("results", [])]
