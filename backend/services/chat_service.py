from typing import AsyncGenerator, List, Dict, Any, Optional
import json
import re
import logging
import asyncio

from services.bedrock_service import bedrock_service
from services.chroma_service import chroma_service
from services.chat_history_service import chat_history_service
from services.tool_service import tool_service, tools as available_tools, tool_functions
from services.model_service import model_service
from services.system_prompt_service import system_prompt_service
from services.usage_service import usage_service
from models.chat import ImagePayload, Chat as ChatHistory, ChatMessage as Message
from utils.text_utils import get_token_count

class ChatService:
    def __init__(self):
        pass

    async def chat(
        self,
        session_id: str,
        user_id: str,
        message: str,
        model_id: str,
        collection_names: List[str],
        images: Optional[List[ImagePayload]] = None
    ) -> AsyncGenerator[str, None]:
        images = images or []
        chat_history_doc = await chat_history_service.get_chat_by_id(session_id)
        conversation_history = chat_history_doc.messages if chat_history_doc else []

        system_prompt_obj = await system_prompt_service.get_system_prompt()
        system_prompt = system_prompt_obj.prompt if system_prompt_obj else "You are a helpful assistant."

        context_docs = []
        if collection_names:
            query_embedding = []
            if images:
                first_image_b64 = images[0].data
                query_embedding = await bedrock_service.create_image_embedding(first_image_b64, message)
            else:
                query_embedding = await bedrock_service.create_text_embedding(message)
            
            query_tasks = [
                chroma_service.query_collection(
                    collection_name=name,
                    query_embeddings=[query_embedding],
                    n_results=5
                ) for name in collection_names
            ]
            
            query_results = await asyncio.gather(*query_tasks, return_exceptions=True)

            for res in query_results:
                if isinstance(res, dict) and res.get('documents'):
                    docs = res.get('documents')
                    if docs and docs[0]:
                        context_docs.extend(docs[0])
                elif isinstance(res, Exception):
                    logging.error(f"Error querying a collection: {res}")
                    continue

        context = "\\n\\n".join(context_docs)

        if context:
            system_prompt += f"\\n\\nHere is some context from relevant documents to help you answer the user's question:\\n<context>\\n{context}\\n</context>"

        messages_for_claude = self._format_history_for_claude(conversation_history)
        
        user_content_list: List[Dict[str, Any]] = [{"type": "text", "text": message}]
        if images:
            for img in images:
                user_content_list.append({
                    "type": "image",
                    "source": { "type": "base64", "media_type": img.media_type, "data": img.data }
                })
        
        messages_for_claude.append({"role": "user", "content": user_content_list})
        
        try:
            # Start the conversation loop
            while True:
                tool_config = {"tools": available_tools}
                
                response_stream = bedrock_service.converse_stream(
                    model_id=model_id,
                    messages=messages_for_claude,
                    system_prompt=system_prompt,
                    tool_config=tool_config
                )

                # Variables to handle the response
                full_response = ""
                assistant_response_parts = []
                tool_calls = []
                stop_reason = None
                input_tokens = 0
                output_tokens = 0
                
                async for event in response_stream:
                    if 'messageStart' in event:
                        # The model's response starts, role is 'assistant'
                        pass
                    
                    elif 'contentBlockStart' in event:
                        if 'toolUse' in event['contentBlockStart']['start']:
                            tool_use_block = event['contentBlockStart']['start']['toolUse']
                            tool_calls.append({
                                "id": tool_use_block['toolUseId'],
                                "name": tool_use_block['name'],
                                "input": ""
                            })
                    
                    elif 'contentBlockDelta' in event:
                        delta = event['contentBlockDelta']['delta']
                        if 'text' in delta:
                            text_chunk = delta['text']
                            full_response += text_chunk
                            yield json.dumps({"type": "chunk", "data": text_chunk}) + "\\n"
                        elif 'toolUse' in delta:
                            if tool_calls:
                                tool_calls[-1]['input'] += delta['toolUse']['input']
                    
                    elif 'messageStop' in event:
                        stop_reason = event['messageStop']['stopReason']
                        # The 'usage' field is nested within the 'amazon-bedrock-invocationMetrics'
                        if 'amazon-bedrock-invocationMetrics' in event['messageStop']:
                            metrics = event['messageStop']['amazon-bedrock-invocationMetrics']
                            input_tokens = metrics.get('inputTokenCount', 0)
                            output_tokens = metrics.get('outputTokenCount', 0)
                        break # Exit stream processing loop
                
                # Append the full text response from the assistant to the conversation history
                if full_response:
                    assistant_response_parts.append({"type": "text", "text": full_response})

                if stop_reason == 'tool_use':
                    # Append the tool call requests to the history before processing
                    if tool_calls:
                        tool_use_parts = []
                        for call in tool_calls:
                            try:
                                # Claude expects the 'input' to be a JSON object, not a string
                                tool_use_parts.append({
                                    "type": "tool_use", 
                                    "id": call["id"], 
                                    "name": call["name"], 
                                    "input": json.loads(call["input"])
                                })
                            except json.JSONDecodeError:
                                # Fallback if input is not a valid JSON string
                                tool_use_parts.append({
                                    "type": "tool_use", 
                                    "id": call["id"], 
                                    "name": call["name"], 
                                    "input": call["input"]
                                })
                        assistant_response_parts.extend(tool_use_parts)

                    if assistant_response_parts:
                         messages_for_claude.append({"role": "assistant", "content": assistant_response_parts})

                    tool_result_content_blocks = []
                    for call in tool_calls:
                        tool_name = call['name']
                        try:
                            tool_input = json.loads(call['input'])
                        except json.JSONDecodeError:
                            tool_input = {} # or handle error appropriately

                        if tool_name in tool_functions:
                            tool_function = tool_functions[tool_name]
                            tool_output_str = tool_function(**tool_input)
                            
                            try:
                                # If the tool returns a JSON string, parse it to a dict
                                parsed_output = json.loads(tool_output_str)
                                result_content = {"json": parsed_output}
                            except (json.JSONDecodeError, TypeError):
                                # Otherwise, treat it as plain text
                                result_content = {"text": tool_output_str}

                            tool_result_content_blocks.append({
                                "toolResult": {
                                    "toolUseId": call['id'],
                                    "content": [result_content]
                                }
                            })
                        else:
                            tool_result_content_blocks.append({
                                "toolResult": {
                                    "toolUseId": call['id'],
                                    "content": [{"text": f"Error: Tool '{tool_name}' not found."}],
                                    "status": 'error'
                                }
                            })
                    
                    messages_for_claude.append({"role": "user", "content": tool_result_content_blocks})
                    continue
                else: # 'end_turn' or other reasons
                    if assistant_response_parts:
                        messages_for_claude.append({"role": "assistant", "content": assistant_response_parts})
                    
                    simplified_user_message = message + (f" [{len(images)} image(s)]" if images else "")
                    
                    # Add user message
                    user_message = Message(
                        id=len(conversation_history) + 1,
                        role="user",
                        content=simplified_user_message
                    )
                    await chat_history_service.add_message_to_chat(session_id, user_message)
                    
                    # Add assistant message
                    assistant_message = Message(
                        id=len(conversation_history) + 2,
                        role="assistant", 
                        content=full_response
                    )
                    await chat_history_service.add_message_to_chat(session_id, assistant_message)
                    await usage_service.update_usage(user_id, input_tokens, output_tokens)

                    yield json.dumps({ "type": "final", "data": { "inputTokens": input_tokens, "outputTokens": output_tokens } }) + "\\n"
                    break # Exit the while loop

        except Exception as e:
            print(f"Error during Claude chat streaming: {e}")
            error_message = json.dumps({"type": "error", "data": str(e)})
            yield error_message + "\\n"
    
    def _format_history_for_claude(self, messages: list[Message], max_tokens: int = 4000) -> list[dict]:
        """Formats the chat history into the structure required by Claude's Messages API."""
        claude_messages = []
        current_tokens = 0
        # Iterate backwards from the most recent message
        for msg in reversed(messages):
            # Skip empty messages if any
            if not msg.content:
                continue
            
            # Ensure content is a string for token counting
            message_content_str = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
            message_tokens = get_token_count(message_content_str)

            if current_tokens + message_tokens > max_tokens:
                break
            
            claude_messages.insert(0, {
                "role": msg.role,
                "content": msg.content
            })
            current_tokens += message_tokens
            
        return claude_messages

chat_service = ChatService() 