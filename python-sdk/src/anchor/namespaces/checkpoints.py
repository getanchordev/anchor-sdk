"""Checkpoints namespace for snapshot and rollback operations."""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime

from .base import BaseNamespace


@dataclass
class Checkpoint:
    """Checkpoint snapshot."""

    id: str
    agent_id: str
    label: Optional[str] = None
    description: Optional[str] = None
    config_version: str = ""
    data_snapshot: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    audit_id: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Checkpoint":
        return cls(
            id=data.get("id", ""),
            agent_id=data.get("agent_id", ""),
            label=data.get("label"),
            description=data.get("description"),
            config_version=data.get("config_version", ""),
            data_snapshot=data.get("data_snapshot", {}),
            created_at=(
                datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
                if data.get("created_at")
                else None
            ),
            audit_id=data.get("audit_id"),
        )


@dataclass
class RestoreResult:
    """Result of a checkpoint restore operation."""

    restored_from: str
    config_restored: bool
    config_version: Optional[str] = None
    data_restored: bool = False
    data_keys_restored: int = 0
    data_keys_removed: int = 0
    audit_id: str = ""
    restored_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RestoreResult":
        return cls(
            restored_from=data.get("restored_from", ""),
            config_restored=data.get("config_restored", False),
            config_version=data.get("config_version"),
            data_restored=data.get("data_restored", False),
            data_keys_restored=data.get("data_keys_restored", 0),
            data_keys_removed=data.get("data_keys_removed", 0),
            audit_id=data.get("audit_id", ""),
            restored_at=(
                datetime.fromisoformat(data["restored_at"].replace("Z", "+00:00"))
                if data.get("restored_at")
                else None
            ),
        )


class CheckpointsNamespace(BaseNamespace):
    """Checkpoint management for rollback."""

    def create(
        self,
        agent_id: str,
        label: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Checkpoint:
        """
        Create a checkpoint of current state.

        Args:
            agent_id: Agent ID
            label: Optional human-readable label
            description: Optional description

        Returns:
            Checkpoint object
        """
        response = self._http.post(
            f"/agents/{agent_id}/checkpoints",
            data={
                "label": label,
                "description": description,
            },
        )
        return Checkpoint.from_dict(response)

    def list(self, agent_id: str, limit: int = 20) -> List[Checkpoint]:
        """
        List checkpoints.

        Args:
            agent_id: Agent ID
            limit: Max checkpoints to return

        Returns:
            List of Checkpoint objects
        """
        response = self._http.get(
            f"/agents/{agent_id}/checkpoints", params={"limit": limit}
        )
        return [Checkpoint.from_dict(c) for c in response.get("checkpoints", [])]

    def get(self, agent_id: str, checkpoint_id: str) -> Checkpoint:
        """
        Get a specific checkpoint.

        Args:
            agent_id: Agent ID
            checkpoint_id: Checkpoint ID

        Returns:
            Checkpoint object
        """
        response = self._http.get(f"/agents/{agent_id}/checkpoints/{checkpoint_id}")
        return Checkpoint.from_dict(response)

    def restore(
        self,
        agent_id: str,
        checkpoint_id: str,
        restore_config: bool = True,
        restore_data: bool = True,
    ) -> RestoreResult:
        """
        Restore agent to a checkpoint.

        Args:
            agent_id: Agent ID
            checkpoint_id: Checkpoint to restore
            restore_config: Whether to restore config
            restore_data: Whether to restore data

        Returns:
            RestoreResult with details
        """
        response = self._http.post(
            f"/agents/{agent_id}/checkpoints/{checkpoint_id}/restore",
            data={
                "restore_config": restore_config,
                "restore_data": restore_data,
            },
        )
        return RestoreResult.from_dict(response)

    def delete(self, agent_id: str, checkpoint_id: str) -> bool:
        """
        Delete a checkpoint.

        Args:
            agent_id: Agent ID
            checkpoint_id: Checkpoint ID

        Returns:
            True if deleted
        """
        self._http.delete(f"/agents/{agent_id}/checkpoints/{checkpoint_id}")
        return True
