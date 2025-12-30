"""Pytest configuration and fixtures for Anchor SDK tests"""

import pytest
from unittest.mock import Mock
from anchor import Anchor


@pytest.fixture
def mock_response():
    """Create a mock requests.Response object"""
    response = Mock()
    response.ok = True
    response.status_code = 200
    response.json.return_value = {}
    response.text = ""
    return response


@pytest.fixture
def anchor_client():
    """Create an Anchor client instance"""
    return Anchor(api_key="anc_test_key", base_url="http://localhost:5050")


@pytest.fixture
def sample_agent():
    """Sample agent for testing"""
    return {
        "id": "agent_123",
        "name": "test-agent",
        "status": "active",
        "metadata": {"env": "test"},
        "config_version": "v1",
        "data_count": 10,
        "checkpoint_count": 2,
        "created_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_config():
    """Sample config for testing - schema-less with policies"""
    return {
        "agent_id": "agent_123",
        "version": "v1",
        "config": {
            # Freeform fields - Anchor just stores these
            "instructions": "You are a helpful assistant",
            "model": "gpt-4",
            "custom_setting": "my_value",
            # Anchor enforces this on data.write()
            "policies": {
                "block_pii": True,
                "block_secrets": True,
                "retention_days": 90
            },
        },
        "created_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_audit_event():
    """Sample audit event for testing"""
    return {
        "id": "audit_123",
        "agent_id": "agent_123",
        "operation": "data.write",
        "resource": "user:456:preference",
        "result": "allowed",
        "hash": "abc123def456",
        "previous_hash": "xyz789",
        "timestamp": "2024-01-01T00:00:00Z",
        "metadata": {},
    }
