from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder


def build_prompt(system_prompt: str) -> ChatPromptTemplate:
    """Construct the standard prompt template.

    Structure: 1) system 2) chat history 3) human input 4) agent scratchpad.
    """
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    ) 