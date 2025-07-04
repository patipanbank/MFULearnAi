from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder


def build_prompt(system_prompt: str) -> ChatPromptTemplate:
    """Construct the standard prompt template.

    Structure: 1) system 2) chat history (as context) 3) human input 4) agent scratchpad.
    """
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt + "\n\nIMPORTANT: The chat history below is context from previous conversations. Use this context to provide better responses, but only answer the current user's question. Do not repeat or respond to previous questions in the history."),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "Current question: {input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    ) 