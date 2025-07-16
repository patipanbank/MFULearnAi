from __future__ import annotations

"""Utility helpers for dealing with raw strings that contain LangChain `AIMessage`/`HumanMessage` representations.

In some logging or persisted scenarios we end up with *stringified* Python
objects such as::

    {'output': [{'type': 'text', 'text': 'สวัสดีครับ', 'index': 0}], ...}
    {'output': [...], 'messages': [AIMessage(content="Hello", ...)]}

Because these are not valid JSON, nor pure Python *literals* (they contain
constructor calls like ``AIMessage(...)``), they cannot be parsed directly
with :pymod:`json` or :pyfunc:`ast.literal_eval`.

This module provides best-effort helpers to pull out the underlying text
content so the rest of the system can continue to work with plain strings or
actual :pyclass:`langchain_core.messages.AIMessage` objects.
"""

from typing import List
import re
import ast

try:
    # Optional import – only needed when caller expects real AIMessage objects.
    from langchain_core.messages import AIMessage
except Exception:  # pragma: no cover – keep hard dependency optional
    AIMessage = None  # type: ignore

__all__ = [
    "extract_contents",
]


_AI_MESSAGE_RE = re.compile(
    r"AIMessage\(content=(?P<quote>[\'\"])(?P<content>.*?)(?P=quote)",
    flags=re.S,
)


def _from_dict_block(block: str) -> List[str]:
    """Attempt to literal-eval a *dict* block and pull `output[0]['text']` etc."""
    try:
        data = ast.literal_eval(block)
    except Exception:
        return []

    results: List[str] = []
    if isinstance(data, dict) and "output" in data:  # legacy schema
        for item in data["output"]:
            if not isinstance(item, dict):
                continue
            # Prefer LangChain style key "content" but fallback to "text"/"value".
            for key in ("content", "text", "value"):
                if key in item and isinstance(item[key], str):
                    results.append(item[key])
                    break
    return results


def extract_contents(raw: str, *, return_ai_message: bool = False):
    """Extract **ordered** text contents from a raw string that may contain
    multiple consecutive dict-like blobs or ``AIMessage(...)`` representations.

    Parameters
    ----------
    raw: str
        The raw input string (e.g. lines read from a log file).
    return_ai_message: bool, default False
        If *True* and *langchain* is available, return actual
        :class:`langchain_core.messages.AIMessage` instances; otherwise return
        plain strings.

    Returns
    -------
    List[str | AIMessage]
        Each element is either the extracted text or an ``AIMessage`` object
        whose ``content`` holds that text.
    """
    raw = raw.strip()
    if not raw:
        return []

    # 1) Fast-path: pull out `AIMessage(content="…")` occurrences via regex.
    ordered: List[str] = []
    for m in _AI_MESSAGE_RE.finditer(raw):
        ordered.append(m.group("content"))

    # 2) Fallback: split raw into top-level *dict* blocks and parse each.
    #    We naïvely count braces – good enough for the expected log format.
    depth = 0
    start = None
    for i, ch in enumerate(raw):
        if ch == "{" and (i == 0 or raw[i - 1] != "\\"):
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and (i == 0 or raw[i - 1] != "\\"):
            depth -= 1
            if depth == 0 and start is not None:
                block = raw[start : i + 1]
                ordered.extend(_from_dict_block(block))

    # 3) Optionally wrap into AIMessage objects.
    if return_ai_message and AIMessage is not None:
        return [AIMessage(content=txt) for txt in ordered]
    return ordered 