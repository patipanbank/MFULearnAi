#!/usr/bin/env python3
"""
Test script for web search functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agents.tool_registry import web_search, web_search_duckduckgo

def test_web_search():
    """Test web search functionality"""
    print("🔍 Testing Web Search Tool")
    print("=" * 50)
    
    # Test queries
    test_queries = [
        "What is artificial intelligence?",
        "machine learning",
        "Python programming language",
        "latest news about AI",
        "COVID-19 vaccine information"
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{i}. Testing query: '{query}'")
        print("-" * 30)
        
        try:
            result = web_search(query)
            print(f"Result: {result[:300]}..." if len(result) > 300 else f"Result: {result}")
        except Exception as e:
            print(f"Error: {e}")
        
        print()

def test_duckduckgo_fallback():
    """Test DuckDuckGo fallback directly"""
    print("\n🦆 Testing DuckDuckGo Fallback")
    print("=" * 50)
    
    query = "What is blockchain technology?"
    print(f"Query: '{query}'")
    
    try:
        result = web_search_duckduckgo(query)
        print(f"Result: {result[:300]}..." if len(result) > 300 else f"Result: {result}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_web_search()
    test_duckduckgo_fallback()
    print("\n✅ Web search testing completed!") 