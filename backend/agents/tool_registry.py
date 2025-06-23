from __future__ import annotations

from langchain_core.tools import Tool

# Import function tools defined elsewhere in the codebase **once** at start-up
from services.tool_service import tool_functions

# -------------------------------------------------------------------------------------------------
# TOOL REGISTRY – imported by other modules so must not have heavy dependencies or side-effects.
# -------------------------------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, Tool] = {}

for _name, _fn in tool_functions.items():
    TOOL_REGISTRY[_name] = Tool(
        name=_name,
        func=_fn,
        description=_fn.__doc__ or f"Tool `{_name}`",
    )

__all__ = ["TOOL_REGISTRY"] 