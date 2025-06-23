from typing import AsyncGenerator, List, Dict, Any, Optional
import json
import logging

# LangChain and Agent imports
from langchain_core.messages import HumanMessage, AIMessage
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
            fallback_text: Any = ""
            
            async for event in agent_with_chat_history.astream_events(agent_input, config=config, version="v1"):
                kind = event["event"]
                logging.info(f"Event received: {kind}")  # Debug logging
                
                # Handle different types of streaming events
                if kind == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    chunk_text: str | None = None
                    if chunk:
                        # Skip dicts that represent the full agent result (contain both output & messages)
                        if isinstance(chunk, dict) and {"output", "messages"}.issubset(chunk.keys()):
                            chunk_text = None  # ignore this chunk
                        elif hasattr(chunk, "content") and getattr(chunk, "content", None):
                            chunk_text = getattr(chunk, "content")  # type: ignore[attr-defined]
                        elif isinstance(chunk, dict):
                            if "content" in chunk and isinstance(chunk["content"], str):
                                chunk_text = str(chunk["content"])
                            elif "text" in chunk and isinstance(chunk["text"], str):
                                chunk_text = str(chunk["text"])
                    if chunk_text:
                        content_received = True
                        yield json.dumps({"type": "chunk", "data": chunk_text})
                        
                elif kind == "on_llm_stream":
                    chunk = event["data"].get("chunk")
                    llm_chunk_text: str | None = None
                    if chunk:
                        if isinstance(chunk, dict) and {"output", "messages"}.issubset(chunk.keys()):
                            llm_chunk_text = None
                        elif hasattr(chunk, "content") and getattr(chunk, "content", None):
                            llm_chunk_text = getattr(chunk, "content")  # type: ignore[attr-defined]
                        elif isinstance(chunk, dict):
                            if "content" in chunk and isinstance(chunk["content"], str):
                                llm_chunk_text = str(chunk["content"])
                            elif "text" in chunk and isinstance(chunk["text"], str):
                                llm_chunk_text = str(chunk["text"])
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
                    # Capture usage statistics and (optionally) fallback answer, but **do not** emit it here.
                    # Emitting here can send the full answer dict *before* streaming tokens, leading to duplicated/garbled UI.
                    final_output = event["data"].get("output")
                    if isinstance(final_output, dict):
                        usage = final_output.get("usage", {})
                        # Preserve fallback text in case no streaming chunks arrive
                        content_piece = final_output.get("output", final_output)
                    else:
                        usage = {}
                        content_piece = final_output

                    # Save fallback text (string) for later use – evaluated *after* the async for loop.
                    fallback_text = ""
                    if isinstance(content_piece, list):
                        # Attempt to pull last AIMessage.content or join parts
                        for msg in reversed(content_piece):
                            if isinstance(msg, AIMessage) and getattr(msg, "content", None):
                                fallback_text = msg.content
                                break
                        if not fallback_text:
                            fallback_text = "\n".join(
                                m.content if hasattr(m, "content") else str(m) for m in content_piece
                            )  # type: ignore[assignment]
                    elif hasattr(content_piece, "content"):
                        fallback_text = content_piece.content  # type: ignore[attr-defined]
                    else:
                        fallback_text = str(content_piece)

                    # Store text for use after streaming loop ends by assigning to outer-scope var
                    # (simply reassigning updates the variable defined before the loop)

                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)

            # 4. Finalize the chat – if no streaming chunks were emitted, send fallback_text.
            if not content_received and fallback_text:
                yield json.dumps({"type": "chunk", "data": fallback_text})
                content_received = True

            # 5. Update usage and send end event
            if input_tokens > 0 or output_tokens > 0:
                await usage_service.update_usage(user_id, input_tokens, output_tokens)

            yield json.dumps({"type": "end", "data": {"inputTokens": input_tokens, "outputTokens": output_tokens}})

        except Exception as e:
            logging.error(f"Error during LangChain agent chat: {e}", exc_info=True)
            error_message = json.dumps({"type": "error", "data": f"An unexpected error occurred: {str(e)}"})
            yield error_message

chat_service = ChatService() 