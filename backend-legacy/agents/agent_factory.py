from __future__ import annotations

from typing import List

from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain.chat_models.base import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import Tool


def create_agent(
    llm: BaseChatModel,
    tools: List[Tool],
    prompt: ChatPromptTemplate,
) -> AgentExecutor:
    """Construct and return a *bare* LangChain AgentExecutor.

    The caller is responsible for wrapping the executor with memory,
    output parsing, etc.  This function focuses solely on composing the
    agent graph (LLM + tools + prompt).
    """
    agent = create_tool_calling_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=True)
