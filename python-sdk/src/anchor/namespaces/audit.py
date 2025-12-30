"""Audit namespace for Anchor SDK (hash-chained audit trail per agent)."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any

from .base import BaseNamespace


@dataclass
class AuditEvent:
    """Audit event per API spec."""

    id: str
    agent_id: str
    operation: str
    resource: str
    result: str  # "allowed" | "blocked"
    blocked_by: Optional[str] = None
    timestamp: Optional[datetime] = None
    hash: str = ""
    previous_hash: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditEvent":
        """Create AuditEvent from API response dict."""
        return cls(
            id=data.get("id", ""),
            agent_id=data.get("agent_id", ""),
            operation=data.get("operation", ""),
            resource=data.get("resource", ""),
            result=data.get("result", "allowed"),
            blocked_by=data.get("blocked_by"),
            timestamp=(
                datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
                if data.get("timestamp")
                else None
            ),
            hash=data.get("hash", ""),
            previous_hash=data.get("previous_hash"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class Verification:
    """Result of audit chain verification."""

    valid: bool
    events_checked: int
    chain_start: Optional[str] = None
    chain_end: Optional[str] = None
    verified_at: Optional[datetime] = None
    first_invalid: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Verification":
        """Create Verification from API response dict."""
        return cls(
            valid=data.get("valid", False),
            events_checked=data.get("events_checked", 0),
            chain_start=data.get("chain_start"),
            chain_end=data.get("chain_end"),
            verified_at=(
                datetime.fromisoformat(data["verified_at"].replace("Z", "+00:00"))
                if data.get("verified_at")
                else None
            ),
            first_invalid=data.get("first_invalid"),
        )


@dataclass
class ExportResult:
    """Result of audit export request."""

    export_id: str
    format: str
    download_url: str
    expires_at: Optional[datetime] = None
    event_count: int = 0
    verification: Optional[Verification] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExportResult":
        """Create ExportResult from API response dict."""
        verification = None
        if data.get("verification"):
            verification = Verification.from_dict(data["verification"])

        return cls(
            export_id=data.get("export_id", ""),
            format=data.get("format", "json"),
            download_url=data.get("download_url", ""),
            expires_at=(
                datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
                if data.get("expires_at")
                else None
            ),
            event_count=data.get("event_count", 0),
            verification=verification,
        )


class AuditNamespace(BaseNamespace):
    """
    Agent-scoped audit trail operations.

    All agent operations are logged to a hash-chained audit trail
    that can be verified for integrity.

    Usage:
        anchor = Anchor(api_key="your-api-key")

        # Query audit events for an agent
        events = anchor.audit.query(
            agent_id="agent_a1b2c3...",
            operations=["data.write", "data.delete"],
            limit=100
        )

        for event in events:
            print(f"{event.timestamp}: {event.operation}")
            print(f"  Result: {event.result}")
            print(f"  Hash: {event.hash}")

        # Verify chain integrity
        verification = anchor.audit.verify(agent_id="agent_a1b2c3...")
        print(verification.valid)  # True/False

        # Export for compliance
        export = anchor.audit.export(
            agent_id="agent_a1b2c3...",
            format="json",
            include_verification=True
        )
        print(f"Download: {export.download_url}")
    """

    def query(
        self,
        agent_id: str,
        operations: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[AuditEvent]:
        """
        Query audit events for an agent.

        Args:
            agent_id: Agent ID (required)
            operations: Filter by operation types
                (e.g., ["data.write", "data.delete"])
            start_time: Filter events after this time
            end_time: Filter events before this time
            limit: Max events to return

        Returns:
            List of AuditEvent objects
        """
        params: Dict[str, Any] = {"limit": min(limit, 1000)}
        if operations:
            params["operations"] = ",".join(operations)
        if start_time:
            params["start"] = start_time.isoformat()
        if end_time:
            params["end"] = end_time.isoformat()

        response = self._http.get(f"/agents/{agent_id}/audit", params=params)
        return [AuditEvent.from_dict(e) for e in response.get("events", [])]

    def get(self, agent_id: str, audit_id: str) -> AuditEvent:
        """
        Get a specific audit event.

        Args:
            agent_id: Agent ID
            audit_id: Audit event ID

        Returns:
            AuditEvent object
        """
        response = self._http.get(f"/agents/{agent_id}/audit/{audit_id}")
        return AuditEvent.from_dict(response)

    def verify(
        self,
        agent_id: str,
        start_time: Optional[datetime] = None,
    ) -> Verification:
        """
        Verify hash chain integrity.

        Args:
            agent_id: Agent ID
            start_time: Optional start time for verification

        Returns:
            Verification result with valid status
        """
        params: Dict[str, Any] = {}
        if start_time:
            params["start"] = start_time.isoformat()

        response = self._http.get(f"/agents/{agent_id}/audit/verify", params=params)
        return Verification.from_dict(response)

    def export(
        self,
        agent_id: str,
        format: str = "json",
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        include_verification: bool = True,
    ) -> ExportResult:
        """
        Export audit trail for compliance.

        Args:
            agent_id: Agent ID
            format: Export format ("json" or "csv")
            start_time: Start of export range
            end_time: End of export range
            include_verification: Include chain verification

        Returns:
            ExportResult with download URL
        """
        payload: Dict[str, Any] = {
            "format": format,
            "include_verification": include_verification,
        }
        if start_time:
            payload["start"] = start_time.isoformat()
        if end_time:
            payload["end"] = end_time.isoformat()

        response = self._http.post(f"/agents/{agent_id}/audit/export", data=payload)
        return ExportResult.from_dict(response)
