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
        images: Optional[List[ImagePayload]] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4000
    ) -> AsyncGenerator[str, None]:
        
        try:
            # 1. Create the agent executor with history for the current session
            agent_with_chat_history = create_agent_executor(
                model_id=model_id,
                collection_names=collection_names,
                session_id=session_id,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens
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
                    chunk_text: str | None = None
                    if chunk:
                        if hasattr(chunk, "content") and chunk.content:
                            chunk_text = chunk.content  # type: ignore[attr-defined]
                        elif isinstance(chunk, dict) and chunk.get("content"):
                            chunk_text = str(chunk.get("content"))
                    if chunk_text:
                        content_received = True
                        yield json.dumps({"type": "chunk", "data": chunk_text})
                        
                elif kind == "on_llm_stream":
                    chunk = event["data"].get("chunk")
                    llm_chunk_text: str | None = None
                    if chunk:
                        if hasattr(chunk, "content") and chunk.content:
                            llm_chunk_text = chunk.content  # type: ignore[attr-defined]
                        elif isinstance(chunk, dict) and chunk.get("content"):
                            llm_chunk_text = str(chunk.get("content"))
                    if llm_chunk_text:
                        content_received = True
                        yield json.dumps({"type": "chunk", "data": llm_chunk_text})
                        
                elif kind == "on_tool_end":
                    # Handle tool execution results
                    tool_output = event["data"].get("output")
                    if tool_output:
                        content_received = True
                        yield json.dumps({"type": "tool_result", "data": str(tool_output)})
                
                elif kind == "on_chain_end":
                    final_output = event["data"].get("output")
                    if final_output:
                        final_answer = None
                        usage = {}

                        if isinstance(final_output, dict):
                            final_answer = final_output.get('output')
                            # Check for token usage in the nested structure
                            if final_answer and hasattr(final_answer, 'response_metadata') and 'usage' in final_answer.response_metadata:
                                usage = final_answer.response_metadata['usage']
                            elif 'usage' in final_output:
                                usage = final_output['usage']
                        else:
                             # Handle cases where the output is just a string
                             final_answer = str(final_output)

                        # Extract text if final_answer is message object
                        if final_answer and hasattr(final_answer, 'content'):
                            final_answer_text = final_answer.content  # type: ignore[attr-defined]
                        else:
                            final_answer_text = str(final_answer) if final_answer else ""

                        # If no chunks were streamed, send the final answer.
                        if final_answer_text and not content_received:
                            yield json.dumps({"type": "chunk", "data": final_answer_text})
                            content_received = True

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