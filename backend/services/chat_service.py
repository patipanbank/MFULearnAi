from typing import AsyncGenerator, List, Dict, Any, Optional, cast
import json
import logging

# LangChain and Agent imports
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig

# New modular factories
from agents.llm_factory import get_llm
from agents.prompt_factory import build_prompt
from agents.agent_factory import create_agent
from agents.tool_registry import TOOL_REGISTRY

# LangChain utils for memory & parsing
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.output_parsers import StrOutputParser

# Tooling
from langchain.tools.retriever import create_retriever_tool
from langchain_core.tools import Tool

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
            # ------------------------------------------------------------------
            # 1) LLM
            # ------------------------------------------------------------------
            llm = get_llm(
                model_id,
                streaming=True,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            # ------------------------------------------------------------------
            # 2) Tools – static registry + dynamic retrieval tools
            # ------------------------------------------------------------------
            tools: list[Tool] = list(TOOL_REGISTRY.values())

            from services.chroma_service import chroma_service  # local import to avoid cycles

            for collection_name in collection_names:
                try:
                    vector_store = chroma_service.get_vector_store(collection_name)  # type: ignore[attr-defined]
                    if not vector_store:
                        continue

                    retriever = vector_store.as_retriever(
                        search_type="similarity",
                        search_kwargs={"k": 5},
                    )

                    retrieval_tool = create_retriever_tool(
                        retriever,
                        name=f"search_{collection_name}",
                        description=(
                            f"Search and retrieve information from the {collection_name} knowledge base. "
                            "Use this when you need specific information."
                        ),
                    )
                    tools.append(retrieval_tool)
                except Exception as e:
                    logging.warning(
                        f"Could not create retrieval tool for collection '{collection_name}': {e}"
                    )

            # ------------------------------------------------------------------
            # 3) Prompt
            # ------------------------------------------------------------------
            default_system_prompt = (
                "You are a helpful assistant. You have access to a number of tools and must use them when appropriate."
            )
            final_system_prompt = system_prompt if system_prompt else default_system_prompt

            prompt = build_prompt(final_system_prompt)

            # ------------------------------------------------------------------
            # 4) Agent executor (without memory / output parsing)
            # ------------------------------------------------------------------
            agent_executor = create_agent(llm, tools, prompt)

            # ------------------------------------------------------------------
            # 5) Memory – wrap with message history
            # ------------------------------------------------------------------
            from config.config import settings
            redis_url = settings.REDIS_URL
            if not redis_url:
                raise ValueError("REDIS_URL must be configured for chat history support.")

            agent_with_history = RunnableWithMessageHistory(
                cast(Any, agent_executor),
                lambda s_id: RedisChatMessageHistory(s_id, url=redis_url),
                input_messages_key="input",
                history_messages_key="chat_history",
            )

            # ------------------------------------------------------------------
            # 6) Output parsing – convert LangChain Messages to raw string for UI
            #    The agent executor returns a dict with keys like "output", "messages", etc.
            #    StrOutputParser expects to receive either a string or generations list, **not** a dict.
            #    Therefore, we first extract the "output" field (which contains the assistant text)
            #    before piping the data into StrOutputParser.
            # ------------------------------------------------------------------
            def _extract_output(res: Any) -> Any:  # noqa: ANN401
                """Return the plain string assistant output from the agent result.

                The agent executor typically returns a dict with an "output" key that
                contains the assistant's textual response.  We convert that to a plain
                string for downstream parsing.  If the structure is unexpected, we
                fall back to str(res) to avoid raising errors.
                """
                if isinstance(res, dict) and "output" in res:
                    out_val = res["output"]
                else:
                    out_val = res

                # If the extracted value is a list of messages, join their content.
                if isinstance(out_val, list):
                    joined = []
                    for m in out_val:
                        if hasattr(m, "content") and getattr(m, "content", None):
                            joined.append(str(getattr(m, "content")))
                        else:
                            joined.append(str(m))
                    out_val = "\n".join(joined)

                return out_val

            final_runnable = agent_with_history | _extract_output | StrOutputParser()

            # 2. Prepare the input for the agent (simple string format for Bedrock compatibility)
            agent_input = {"input": message}
            
            # Configuration for the session history
            config: RunnableConfig = {"configurable": {"session_id": session_id}}

            # 3. Stream the agent's response
            input_tokens = 0
            output_tokens = 0
            content_received = False
            fallback_text: Any = ""
            
            async for event in final_runnable.astream_events(agent_input, config=config, version="v1"):
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
                
                elif kind == "on_tool_start":
                    # Handle tool start - show which tool is being used
                    tool_name = event["data"].get("name", "Unknown Tool")
                    tool_input = event["data"].get("input", "")
                    logging.info(f"🔧 Tool started: {tool_name}")
                    yield json.dumps({
                        "type": "tool_start", 
                        "data": {
                            "tool_name": tool_name,
                            "tool_input": tool_input
                        }
                    })
                        
                elif kind == "on_tool_end":
                    # Handle tool execution results
                    tool_name = event["data"].get("name", "Unknown Tool")
                    tool_output = event["data"].get("output")
                    logging.info(f"✅ Tool completed: {tool_name}")
                    if tool_output:
                        content_received = True
                        yield json.dumps({
                            "type": "tool_result", 
                            "data": {
                                "tool_name": tool_name,
                                "output": str(tool_output)
                            }
                        })
                
                elif kind == "on_tool_error":
                    # Handle tool errors
                    tool_name = event["data"].get("name", "Unknown Tool")
                    error = event["data"].get("error", "Unknown error")
                    logging.error(f"❌ Tool error: {tool_name} - {error}")
                    yield json.dumps({
                        "type": "tool_error", 
                        "data": {
                            "tool_name": tool_name,
                            "error": str(error)
                        }
                    })
                
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