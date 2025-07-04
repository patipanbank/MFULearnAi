#!/usr/bin/env python3
"""
Test script for Web Search API implementation (DuckDuckGo primary, Google fallback)
"""

import os
import sys
import requests

def test_web_search_api():
    """Test Web Search API with DuckDuckGo primary and Google fallback"""
    
    # Test queries
    test_queries = [
        "Jeff Satur Tell Me The Name song lyrics",
        "Python programming tutorial",
        "Thailand weather today"
    ]
    
    print("🔍 Testing Web Search API (DuckDuckGo primary, Google fallback)")
    print("📋 Reading configuration from .env file...")
    
    try:
        # Import the web search function
        from agents.tool_registry import web_search
        
        for i, test_query in enumerate(test_queries, 1):
            print(f"\n{'='*60}")
            print(f"TEST {i}: '{test_query}'")
            print(f"{'='*60}")
            
            # Test the main web_search function
            result = web_search(test_query)
            
            print("\n📋 SEARCH RESULTS:")
            print("-" * 40)
            print(result)
            print("-" * 40)
            
    except Exception as e:
        print(f"❌ Error testing Web Search API: {e}")
        import traceback
        traceback.print_exc()

def test_current_date():
    """Test current_date function fix"""
    print("\n" + "="*60)
    print("TESTING CURRENT DATE FUNCTION")
    print("="*60)
    
    try:
        from agents.tool_registry import get_current_date
        
        # Test with no parameter
        result1 = get_current_date()
        print(f"✅ No parameter: {result1}")
        
        # Test with parameter (should work now)
        result2 = get_current_date("current date")
        print(f"✅ With parameter: {result2}")
        
        print("✅ Current date function fixed successfully!")
        
    except Exception as e:
        print(f"❌ Error testing current_date: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_web_search_api()
    test_current_date() 