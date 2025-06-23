import boto3
from botocore.config import Config
from typing import List, Optional

from langchain_aws import ChatBedrock
from langchain_aws import BedrockEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.tools.retriever import create_retriever_tool
from langchain_core.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.runnables import RunnableLambda

from config.config import settings
from services.chroma_service import chroma_service
from services.tool_service import tool_functions

def create_agent_executor(
    model_id: str, 
    collection_names: List[str], 
    session_id: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4000
) -> RunnableWithMessageHistory:
    """
    Creates and returns a LangChain agent executor with chat history.

    Args:
        model_id (str): The ID of the model to use (used to select agent type).
        collection_names (List[str]): A list of collection names to be used as tools.
        session_id (str): The ID of the current chat session for memory.
        system_prompt (Optional[str]): Custom system prompt for the agent.
        temperature (float): Temperature setting for the LLM (0.0-1.0).
        max_tokens (int): Maximum tokens for the LLM response.

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

    # Create LLM with agent-specific parameters
    llm_params = {
        'client': bedrock_client,
        'model': model_id,
        'streaming': True,
    }
    
    # Add model-specific parameters
    model_kwargs = {}
    if temperature is not None:
        model_kwargs['temperature'] = temperature
    if max_tokens is not None:
        model_kwargs['max_tokens'] = max_tokens
        
    if model_kwargs:
        llm_params['model_kwargs'] = model_kwargs

    llm = ChatBedrock(**llm_params)

    # 2. Initialize Tools
    tools = []

    # 2.1 Create retrieval tools from collection names
    for collection_name in collection_names:
        try:
            # Get the vector store for this collection
            vector_store = chroma_service.get_vector_store(collection_name)  # type: ignore[attr-defined]
            
            if vector_store:
                # Create a retriever from the vector store
                retriever = vector_store.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": 5}  # Return top 5 similar documents
                )
                
                # Create a retrieval tool
                retrieval_tool = create_retriever_tool(
                    retriever,
                    name=f"search_{collection_name}",
                    description=f"Search and retrieve information from the {collection_name} knowledge base. Use this when you need specific information about {collection_name}."
                )
                
                tools.append(retrieval_tool)
                print(f"✅ Created retrieval tool for collection: {collection_name}")
            else:
                print(f"⚠️ Vector store not found for collection: {collection_name}")
                
        except Exception as e:
            print(f"❌ Error creating retrieval tool for {collection_name}: {e}")
            continue

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

    # 3. Create Prompt Template
    # Use custom system prompt if provided, otherwise use default
    default_system_prompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate."
    final_system_prompt = system_prompt if system_prompt else default_system_prompt
    
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", final_system_prompt),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    )

    print(f"📝 Using system prompt: {final_system_prompt[:100]}...")

    # 4. Create Agent with Tools
    agent = create_tool_calling_agent(llm, tools, prompt)

    # 5. Create Agent Executor
    # The AgentExecutor is what actually runs the agent and executes tools.
    agent_executor = AgentExecutor(
        agent=agent, 
        tools=tools,
        verbose=True # Set to True for debugging to see agent's thoughts
    )

    # --- Strip `usage` key from the final output to avoid LangChain tracer bug ---
    def _drop_usage(output):  # helper removes the `usage` field that confuses AsyncRootListenersTracer
        if isinstance(output, dict) and "usage" in output:
            # Create a shallow copy to avoid mutating downstream
            return {k: v for k, v in output.items() if k != "usage"}
        return output

    agent_executor = agent_executor | RunnableLambda(_drop_usage)

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
