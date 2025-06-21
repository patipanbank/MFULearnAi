import boto3
from botocore.config import Config
from typing import List

from langchain_aws import ChatBedrock
from langchain_aws import BedrockEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.tools.retriever import create_retriever_tool
from langchain_core.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

from config.config import settings
from services.chroma_service import chroma_service
from services.tool_service import tool_functions

def create_agent_executor(model_id: str, collection_names: List[str], session_id: str) -> RunnableWithMessageHistory:
    """
    Creates and returns a LangChain agent executor with chat history.

    Args:
        model_id (str): The ID of the model to use (used to select agent type).
        collection_names (List[str]): A list of collection names to be used as tools.
        session_id (str): The ID of the current chat session for memory.

    Returns:
        An initialized LangChain agent executor with chat history.
    """
    # 1. Initialize the LLM
    # Recommended configuration for Bedrock streaming and timeouts
    boto3_config = Config(
        read_timeout=900,
        retries={'max_attempts': 3, 'mode': 'standard'}
    )
    
    bedrock_client = boto3.client(
        service_name='bedrock-runtime',
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=boto3_config
    )

    llm = ChatBedrock(
        client=bedrock_client,
        model=model_id,
        streaming=True,
    )

    # 2. Initialize Tools
    tools = []

    # 2.1 Initialize Retriever Tools for each collection
    if collection_names:
        # Initialize the embedding function that the retriever will use
        embedding_function = BedrockEmbeddings(
            client=bedrock_client,
            model_id="amazon.titan-embed-text-v1", # This is the model used in bedrock_service
            region_name=settings.AWS_REGION,  # เพิ่ม region_name
        )

        for name in collection_names:
            try:
                # Use the existing ChromaDB client from chroma_service
                vector_store = Chroma(
                    client=chroma_service.client,
                    collection_name=name,
                    embedding_function=embedding_function,
                )
                
                retriever = vector_store.as_retriever(
                    # You can configure search_type, search_kwargs here
                    # e.g., search_kwargs={'k': 5}
                )
                
                # Create a retriever tool
                retriever_tool = create_retriever_tool(
                    retriever,
                    name=f"search_{name.replace('-', '_')}", # Tool names should be python identifiers
                    description=f"Searches and returns relevant documents from the '{name}' collection. Use this to find information related to {name}."
                )
                tools.append(retriever_tool)
            except Exception as e:
                # Log the error and continue without the tool
                print(f"Warning: Could not create retriever tool for collection '{name}': {e}")

    # 2.2 Initialize Function tools from tool_service
    if tool_functions:
        for tool_name, tool_function in tool_functions.items():
            # Create a LangChain Tool from the existing function
            langchain_tool = Tool(
                name=tool_name,
                func=tool_function,
                description=tool_function.__doc__ or f"A tool to perform {tool_name}."
            )
            tools.append(langchain_tool)

    # Placeholder for the next steps
    print(f"Agent Executor created for model: {model_id}")
    print(f"LLM Initialized: {llm}")
    print(f"Tools Initialized: {tools}")

    # TODO: 3. Create Prompt Template
    # This is a generic prompt template. You might want to create specific ones
    # based on the agent type (model_id) later.
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "You are a helpful assistant. You have access to a number of tools and must use them when appropriate."),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    )

    # 4. Create Agent with Tools
    agent = create_tool_calling_agent(llm, tools, prompt)

    # 5. Create Agent Executor
    # The AgentExecutor is what actually runs the agent and executes tools.
    agent_executor = AgentExecutor(
        agent=agent, 
        tools=tools,
        verbose=True # Set to True for debugging to see agent's thoughts
    )

    # 6. Create Agent with Message History
    # This wraps the agent executor and manages the chat history.
    redis_url = settings.REDIS_URL
    if not redis_url:
        raise ValueError("REDIS_URL must be set in the environment variables to use chat history.")

    agent_with_chat_history = RunnableWithMessageHistory(
        agent_executor, # type: ignore
        # The get_session_history function returns a history object based on the session ID
        lambda session_id: RedisChatMessageHistory(
            session_id, url=redis_url
        ),
        input_messages_key="input",
        history_messages_key="chat_history",
    )
    
    print(f"Agent Executor with history created for session: {session_id}")

    return agent_with_chat_history
