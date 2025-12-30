"""
Framework integrations for Anchor.

1. Available integrations:
    - LangChain: AnchorMemory, AnchorChatHistory, AnchorCallbackHandler
    - CrewAI: AnchorCrewAgent, AnchorCrewMemory
    - Mem0: AnchorMem0

2. Usage:
    # LangChain
    from anchor.integrations.langchain import AnchorMemory, AnchorCallbackHandler

    # CrewAI
    from anchor.integrations.crewai import AnchorCrewAgent, AnchorCrewMemory

    # Mem0
    from anchor.integrations.mem0 import AnchorMem0

Note: Each integration requires its respective framework to be installed.
    pip install langchain-core  # for LangChain
    pip install crewai  # for CrewAI
    pip install mem0ai  # for Mem0
"""

__all__ = []


# Lazy imports to avoid requiring all framework dependencies
def __getattr__(name):
    if name == "langchain":
        from . import langchain

        return langchain
    elif name == "crewai":
        from . import crewai

        return crewai
    elif name == "mem0":
        from . import mem0

        return mem0
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
