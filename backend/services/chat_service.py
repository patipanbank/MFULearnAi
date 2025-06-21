from typing import AsyncGenerator, List, Dict, Any, Optional
import json
import logging

# LangChain and Agent imports
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from agents.agent_factory import create_agent_executor

# Services
from services.usage_service import usage_service
from models.chat import ImagePayload

class ChatService:
    async def chat(
        self,
        session_id: str,
        user_id: str,
        message: str,
        model_id: str,
        collection_names: List[str],
        images: Optional[List[ImagePayload]] = None
    ) -> AsyncGenerator[str, None]:
        
        try:
            # 1. Create the agent executor with history for the current session
            agent_with_chat_history = create_agent_executor(
                model_id=model_id,
                collection_names=collection_names,
                session_id=session_id
            )

            # 2. Prepare the input for the agent (simple string format for Bedrock compatibility)
            agent_input = {"input": message}
            
            # Configuration for the session history
            config: RunnableConfig = {"configurable": {"session_id": session_id}}

            # 3. Stream the agent's response
            input_tokens = 0
            output_tokens = 0
            content_received = False
            
            async for event in agent_with_chat_history.astream_events(agent_input, config=config, version="v1"):
                kind = event["event"]
                logging.info(f"Event received: {kind}")  # Debug logging
                
                # Handle different types of streaming events
                if kind == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, 'content') and chunk.content:
                        content_received = True
                        yield json.dumps({"type": "chunk", "data": chunk.content})
                        
                elif kind == "on_llm_stream":
                    # Alternative event name for LLM streaming
                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, 'content') and chunk.content:
                        content_received = True
                        yield json.dumps({"type": "chunk", "data": chunk.content})
                        
                elif kind == "on_tool_end":
                    # Handle tool execution results
                    tool_output = event["data"].get("output")
                    if tool_output:
                        content_received = True
                        yield json.dumps({"type": "tool_result", "data": str(tool_output)})
                
                elif kind == "on_chain_end":
                    final_output = event["data"].get("output")
                    if final_output and isinstance(final_output, dict):
                        # Try to get the final answer
                        final_answer = final_output.get('output')
                        if final_answer and not content_received:
                            # If no streaming content was received, send the final answer
                            yield json.dumps({"type": "chunk", "data": str(final_answer)})
                            content_received = True
                            
                        # Extract token usage if available
                        if final_answer and hasattr(final_answer, 'response_metadata'):
                            usage = final_answer.response_metadata.get('usage', {})
                            input_tokens = usage.get('input_tokens', 0)
                            output_tokens = usage.get('output_tokens', 0)

            # 4. Finalize the chat
            if input_tokens > 0 or output_tokens > 0:
                await usage_service.update_usage(user_id, input_tokens, output_tokens)

            yield json.dumps({"type": "end", "data": {"inputTokens": input_tokens, "outputTokens": output_tokens}})

        except Exception as e:
            logging.error(f"Error during LangChain agent chat: {e}", exc_info=True)
            error_message = json.dumps({"type": "error", "data": f"An unexpected error occurred: {str(e)}"})
            yield error_message

chat_service = ChatService() 