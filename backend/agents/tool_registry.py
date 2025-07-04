from __future__ import annotations

from typing import Dict, Any, List
from langchain_core.tools import Tool
from langchain.tools.retriever import create_retriever_tool
from langchain_core.embeddings import Embeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
import json
import os
from datetime import datetime

# Import existing tools
from services.web_scraper_service import web_scraper_service
from services.tool_service import tool_service

# Memory tool for chat history
class ChatMemoryTool:
    def __init__(self):
        self.vector_stores: Dict[str, Chroma] = {}
        self.embeddings = None  # Will be initialized when needed
        
    def _get_embeddings(self):
        """Lazy initialization of embeddings"""
        if self.embeddings is None:
            from langchain_aws import BedrockEmbeddings
            import boto3
            from botocore.config import Config
            from config.config import settings
            
            boto3_config = Config(read_timeout=900, retries={"max_attempts": 3, "mode": "standard"})
            bedrock_client = boto3.client(
                service_name="bedrock-runtime",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=boto3_config,
            )
            self.embeddings = BedrockEmbeddings(client=bedrock_client)
        return self.embeddings
    
    def add_chat_memory(self, session_id: str, messages: List[Dict[str, Any]]):
        """Add chat messages to memory with embeddings (avoid duplicates)"""
        try:
            # Get existing message IDs to avoid duplicates
            existing_ids = set()
            if session_id in self.vector_stores:
                try:
                    # Get existing documents to check for duplicates
                    existing_docs = self.vector_stores[session_id].get()
                    if existing_docs and 'metadatas' in existing_docs:
                        for metadata in existing_docs['metadatas']:
                            if metadata and 'message_id' in metadata:
                                existing_ids.add(metadata['message_id'])
                except Exception as e:
                    print(f"⚠️ Could not check existing messages: {e}")
            
            # Create documents from new messages only
            documents = []
            new_message_count = 0
            for msg in messages:
                if msg.get('role') in ['user', 'assistant']:
                    content = msg.get('content', '')
                    message_id = msg.get('id', '')
                    
                    # Skip if message already exists
                    if message_id in existing_ids:
                        continue
                        
                    if content.strip():
                        # Create document with metadata
                        doc = Document(
                            page_content=content,
                            metadata={
                                'session_id': session_id,
                                'role': msg.get('role'),
                                'timestamp': msg.get('timestamp', datetime.utcnow().isoformat()),
                                'message_id': message_id
                            }
                        )
                        documents.append(doc)
                        new_message_count += 1
            
            if documents:
                # Create or update vector store for this session
                embeddings = self._get_embeddings()
                if session_id in self.vector_stores:
                    # Add only new documents to existing vector store
                    self.vector_stores[session_id].add_documents(documents)
                    print(f"📚 Added {new_message_count} new messages to existing memory for session {session_id}")
                else:
                    # Create new vector store
                    self.vector_stores[session_id] = Chroma.from_documents(
                        documents=documents,
                        embedding=embeddings,
                        collection_name=f"chat_memory_{session_id}"
                    )
                    print(f"📚 Created new memory with {new_message_count} messages for session {session_id}")
            else:
                print(f"📚 No new messages to add for session {session_id}")
                
        except Exception as e:
            print(f"❌ Error adding chat memory: {e}")
    
    def search_chat_memory(self, session_id: str, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Search through chat memory for relevant context"""
        try:
            if session_id not in self.vector_stores:
                return []
            
            # Search in vector store
            docs = self.vector_stores[session_id].similarity_search(query, k=k)
            
            # Format results
            results = []
            for doc in docs:
                results.append({
                    'content': doc.page_content,
                    'role': doc.metadata.get('role'),
                    'timestamp': doc.metadata.get('timestamp'),
                    'relevance_score': doc.metadata.get('score', 0.0),
                    'message_id': doc.metadata.get('message_id', '')
                })
            
            return results
            
        except Exception as e:
            print(f"❌ Error searching chat memory: {e}")
            return []
    
    def get_recent_messages(self, session_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent messages from memory (excluding the last 10 which are in Redis)"""
        try:
            if session_id not in self.vector_stores:
                return []
            
            # Get all documents and sort by timestamp
            docs = self.vector_stores[session_id].get()
            if not docs or 'documents' not in docs:
                return []
            
            # Combine documents with metadata
            messages = []
            for i, doc in enumerate(docs['documents']):
                metadata = docs['metadatas'][i] if docs['metadatas'] and i < len(docs['metadatas']) else {}
                messages.append({
                    'content': doc,
                    'role': metadata.get('role'),
                    'timestamp': metadata.get('timestamp'),
                    'message_id': metadata.get('message_id', '')
                })
            
            # Sort by timestamp (oldest first) and return recent ones
            messages.sort(key=lambda x: x.get('timestamp', ''))
            return messages[-limit:] if len(messages) > limit else messages
            
        except Exception as e:
            print(f"❌ Error getting recent messages: {e}")
            return []
    
    def get_all_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all messages from memory (useful when Redis memory is expired)"""
        try:
            if session_id not in self.vector_stores:
                return []
            
            # Get all documents and sort by timestamp
            docs = self.vector_stores[session_id].get()
            if not docs or 'documents' not in docs:
                return []
            
            # Combine documents with metadata
            messages = []
            for i, doc in enumerate(docs['documents']):
                metadata = docs['metadatas'][i] if docs['metadatas'] and i < len(docs['metadatas']) else {}
                messages.append({
                    'content': doc,
                    'role': metadata.get('role'),
                    'timestamp': metadata.get('timestamp'),
                    'message_id': metadata.get('message_id', '')
                })
            
            # Sort by timestamp (oldest first)
            messages.sort(key=lambda x: x.get('timestamp', ''))
            return messages
            
        except Exception as e:
            print(f"❌ Error getting all messages: {e}")
            return []
    
    def clear_chat_memory(self, session_id: str):
        """Clear chat memory for a specific session"""
        try:
            if session_id in self.vector_stores:
                # Delete the collection from Chroma
                self.vector_stores[session_id].delete_collection()
                del self.vector_stores[session_id]
                print(f"🧹 Cleared chat memory for session {session_id}")
        except Exception as e:
            print(f"❌ Error clearing chat memory: {e}")
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics about memory usage"""
        stats = {
            'total_sessions': len(self.vector_stores),
            'total_messages': 0,
            'sessions': {}
        }
        
        for session_id, vector_store in self.vector_stores.items():
            try:
                collection = vector_store._collection
                count = collection.count() if collection else 0
                stats['total_messages'] += count
                
                # Get message distribution by role
                role_distribution = {'user': 0, 'assistant': 0}
                try:
                    docs = vector_store.get()
                    if docs and 'metadatas' in docs:
                        for metadata in docs['metadatas']:
                            if metadata and 'role' in metadata:
                                role = metadata['role']
                                if role in role_distribution:
                                    role_distribution[role] += 1
                except Exception as e:
                    print(f"⚠️ Could not get role distribution: {e}")
                
                stats['sessions'][session_id] = {
                    'message_count': count,
                    'role_distribution': role_distribution,
                    'created_at': getattr(vector_store, '_created_at', 'unknown'),
                    'collection_name': f"chat_memory_{session_id}"
                }
            except Exception as e:
                stats['sessions'][session_id] = {'error': str(e)}
        
        return stats

# Initialize memory tool
chat_memory_tool = ChatMemoryTool()

# Create the memory tool for LangChain
def create_memory_tool(session_id: str) -> List[Tool]:
    """Create a memory tool for a specific chat session"""
    def search_memory(query: str) -> str:
        """Search through chat history for relevant context"""
        results = chat_memory_tool.search_chat_memory(session_id, query)
        if not results:
            return "No relevant chat history found."
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results, 1):
            role_emoji = "👤" if result['role'] == 'user' else "🤖"
            formatted_results.append(
                f"{i}. {role_emoji} {result['role'].title()}: {result['content'][:200]}..."
            )
        
        return f"Found {len(results)} relevant messages from chat history:\n" + "\n".join(formatted_results)
    
    def get_recent_context() -> str:
        """Get recent context from memory (excluding last 10 messages which are in Redis)"""
        results = chat_memory_tool.get_recent_messages(session_id, limit=10)
        if not results:
            return "No recent context found in memory."
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results, 1):
            role_emoji = "👤" if result['role'] == 'user' else "🤖"
            formatted_results.append(
                f"{i}. {role_emoji} {result['role'].title()}: {result['content'][:150]}..."
            )
        
        return f"Recent context from memory (excluding last 10 messages in Redis):\n" + "\n".join(formatted_results)
    
    def get_full_context() -> str:
        """Get full context from memory (useful when Redis memory is expired)"""
        results = chat_memory_tool.get_all_messages(session_id)
        if not results:
            return "No context found in memory."
        
        # Format results
        formatted_results = []
        for i, result in enumerate(results, 1):
            role_emoji = "👤" if result['role'] == 'user' else "🤖"
            formatted_results.append(
                f"{i}. {role_emoji} {result['role'].title()}: {result['content'][:150]}..."
            )
        
        return f"Full conversation context from memory ({len(results)} messages):\n" + "\n".join(formatted_results)
    
    # Create tools
    search_tool = Tool(
        name=f"search_chat_memory_{session_id}",
        description=f"Search through the current chat session history to find relevant context. Use this when you need to reference previous conversations or maintain context. Session ID: {session_id}",
        func=search_memory
    )
    
    recent_tool = Tool(
        name=f"get_recent_context_{session_id}",
        description=f"Get recent context from memory (excluding last 10 messages which are in Redis). Use this to understand the conversation flow. Session ID: {session_id}",
        func=get_recent_context
    )
    
    full_context_tool = Tool(
        name=f"get_full_context_{session_id}",
        description=f"Get full conversation context from memory (useful when Redis memory is expired). Use this to understand the complete conversation history. Session ID: {session_id}",
        func=get_full_context
    )
    
    return [search_tool, recent_tool, full_context_tool]

# Existing tools
def web_search(query: str) -> str:
    """Search the web for current information using DuckDuckGo API with Hugging Face fallback"""
    try:
        # Try DuckDuckGo first (more reliable for web search)
        result = web_search_duckduckgo(query)
        if result and "No specific results found" not in result:
            return result
        
        # If DuckDuckGo fails, try Hugging Face API
        return web_search_huggingface(query)
            
    except Exception as e:
        return f"Error performing web search: {str(e)}"

def web_search_huggingface(query: str) -> str:
    """Web search using Hugging Face API"""
    try:
        import requests
        from config.config import settings
        
        # Get API key from settings
        api_key = settings.HUGGINGFACE_API_KEY
        if not api_key:
            return "Error: HUGGINGFACE_API_KEY not configured"
        
        # Use Hugging Face Inference API with a text generation model
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Use a model that's good for information retrieval and summarization
        model_url = "https://api-inference.huggingface.co/models/google/flan-t5-large"
        
        # Create a prompt that asks for information about the query
        prompt = f"Answer this question with current information: {query}"
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_length": 300,
                "do_sample": False,
                "temperature": 0.7,
                "return_full_text": False
            }
        }
        
        response = requests.post(model_url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get('generated_text', '')
                if generated_text:
                    return f"Information about '{query}': {generated_text}"
                else:
                    return f"Search for '{query}' - Model response: {str(result[0])}"
            else:
                return f"Search for '{query}' - Response: {str(result)}"
        elif response.status_code == 503:
            return f"Search for '{query}' - Hugging Face model is loading. Please try again later."
        else:
            return f"Search for '{query}' - Hugging Face API returned status {response.status_code}."
            
    except requests.exceptions.Timeout:
        return f"Search for '{query}' - Hugging Face API request timed out."
    except requests.exceptions.RequestException as e:
        return f"Search for '{query}' - Hugging Face API network error: {str(e)}"
    except Exception as e:
        return f"Error with Hugging Face API: {str(e)}"

def web_search_duckduckgo(query: str) -> str:
    """Web search using DuckDuckGo API"""
    try:
        import requests
        
        # Use DuckDuckGo Instant Answer API (free, no API key required)
        search_url = "https://api.duckduckgo.com/"
        
        params = {
            'q': query,
            'format': 'json',
            'no_html': '1',
            'skip_disambig': '1'
        }
        
        response = requests.get(search_url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract relevant information
            results = []
            
            # Get abstract (summary)
            if data.get('Abstract'):
                results.append(f"Summary: {data['Abstract']}")
                if data.get('AbstractURL'):
                    results.append(f"Source: {data['AbstractURL']}")
            
            # Get related topics
            if data.get('RelatedTopics') and len(data['RelatedTopics']) > 0:
                topics = data['RelatedTopics'][:3]  # Limit to 3 topics
                topic_texts = []
                for topic in topics:
                    if isinstance(topic, dict) and topic.get('Text'):
                        topic_texts.append(topic['Text'])
                if topic_texts:
                    results.append(f"Related topics: {'; '.join(topic_texts)}")
            
            # Get answer if available
            if data.get('Answer'):
                results.append(f"Direct answer: {data['Answer']}")
            
            if results:
                return f"Web search results for '{query}':\n" + "\n".join(results)
            else:
                return f"No specific results found for '{query}'. Try rephrasing your search query."
        else:
            return f"Web search for '{query}' - DuckDuckGo API returned status {response.status_code}. Please try again."
            
    except requests.exceptions.Timeout:
        return f"Web search for '{query}' - DuckDuckGo request timed out. Please try again."
    except requests.exceptions.RequestException as e:
        return f"Web search for '{query}' - DuckDuckGo network error: {str(e)}"
    except Exception as e:
        return f"Error with DuckDuckGo API: {str(e)}"

def calculate(expression: str) -> str:
    """Calculate mathematical expressions"""
    try:
        # Simple calculation using eval (be careful with this in production)
        result = eval(expression)
        return f"Result: {result}"
    except Exception as e:
        return f"Error calculating: {str(e)}"

# Tool registry
TOOL_REGISTRY: Dict[str, Tool] = {
    "web_search": Tool(
        name="web_search",
        description="Search the web for current information. Use this when you need up-to-date information that's not in your training data.",
        func=web_search
    ),
    "calculator": Tool(
        name="calculator",
        description="Calculate mathematical expressions. Use this for any mathematical calculations.",
        func=calculate
    )
}

# Function to get tools for a specific session
def get_tools_for_session(session_id: str) -> List[Tool]:
    """Get all tools including memory tools for a specific session"""
    tools = list(TOOL_REGISTRY.values())
    
    # Add memory tools for this session
    memory_tools = create_memory_tool(session_id)
    tools.extend(memory_tools)
    
    return tools

# Function to add chat memory
def add_chat_memory(session_id: str, messages: List[Dict[str, Any]]):
    """Add chat messages to memory"""
    chat_memory_tool.add_chat_memory(session_id, messages)

# Function to clear chat memory
def clear_chat_memory(session_id: str):
    """Clear chat memory for a session"""
    chat_memory_tool.clear_chat_memory(session_id)

# Function to get memory stats
def get_memory_stats() -> Dict[str, Any]:
    """Get memory usage statistics"""
    return chat_memory_tool.get_memory_stats() 