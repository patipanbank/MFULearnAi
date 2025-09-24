#!/usr/bin/env python3
"""
Test script for LangMem integration
"""

import os
import json
import asyncio
from langmem import create_manage_memory_tool, create_search_memory_tool

# Set environment variable
os.environ["ANTHROPIC_API_KEY"] = os.getenv("ANTHROPIC_API_KEY", "your-api-key-here")

async def test_langmem():
    """Test LangMem functionality"""

    print("Testing LangMem integration...")

    # Create tools with namespace
    memory_tool = create_manage_memory_tool("mfu_chatbot")
    search_tool = create_search_memory_tool("mfu_chatbot")

    session_id = "test_session_123"

    try:
        # Test 1: Store memory
        print("\n1. Testing memory storage...")
        result = memory_tool.invoke({
            "command": "store",
            "user_id": session_id,
            "memory": "User is interested in AI and machine learning topics"
        })
        print(f"Store result: {result}")

        # Test 2: Store another memory
        result = memory_tool.invoke({
            "command": "store",
            "user_id": session_id,
            "memory": "User prefers detailed technical explanations"
        })
        print(f"Store result: {result}")

        # Test 3: Search memory
        print("\n2. Testing memory search...")
        result = search_tool.invoke({
            "query": "AI machine learning",
            "user_id": session_id,
            "limit": 5
        })
        print(f"Search result: {result}")

        # Test 4: Search with different query
        result = search_tool.invoke({
            "query": "technical explanations",
            "user_id": session_id,
            "limit": 3
        })
        print(f"Search result: {result}")

        print("\nLangMem test completed successfully!")

    except Exception as e:
        print(f"Error during LangMem test: {e}")
        return False

    return True

if __name__ == "__main__":
    asyncio.run(test_langmem())