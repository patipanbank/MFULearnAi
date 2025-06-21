#!/usr/bin/env python3
"""
Quick Test Script for LangChain Agent
====================================

A simplified test script for quick verification of basic functionality.
Use this for rapid testing during development.

Usage: python quick_test.py
"""

import asyncio
import websockets
import json
import logging
import secrets
from datetime import datetime, timedelta
import jwt

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET = "cd343ae6f65f6b6e164289b860c89442edc01c7c8ef327d3959e56d542fffbc15065cd1e88e10c8e15754997d252aaedfde3a38a3733f55dcdabfdcf1e27098a"
WS_URL_DIRECT = "ws://localhost:5000/ws"

def generate_test_ids():
    """Generate valid MongoDB ObjectId format for testing"""
    return secrets.token_hex(12)  # 24-character hex string

def create_test_jwt_token(user_id: str):
    """Create a test JWT token"""
    payload = {
        "sub": user_id,
        "username": "quick_test_user", 
        "role": "STUDENTS",
        "department": "Computer Science",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token

async def test_websocket_connection():
    """Test WebSocket connection and basic message sending"""
    
    print("="*40)
    logger.info("🚀 Starting Quick Test...")
    
    # Generate test data
    user_id = generate_test_ids()
    session_id = generate_test_ids()
    
    logger.info(f"User ID: {user_id}")
    logger.info(f"Session ID: {session_id}")
    
    # Create JWT token
    token = create_test_jwt_token(user_id)
    logger.info(f"JWT Token: {token[:50]}...")
    
    # Test message
    test_message = {
        "session_id": session_id,
        "message": "What's the weather like today?",  # This should trigger weather tool
        "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0",  # Changed back to Claude 3.5 Sonnet
        "collection_names": [],
        "images": []
    }
    
    # Test Direct Backend Connection
    logger.info(f"\n🔗 Trying Direct Backend: {WS_URL_DIRECT}?token={token}")
    
    try:
        async with websockets.connect(f"{WS_URL_DIRECT}?token={token}") as websocket:
            logger.info("✅ Direct Backend WebSocket connected successfully!")
            
            # Send test message
            await websocket.send(json.dumps(test_message))
            logger.info("📤 Message sent")
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                response_data = json.loads(response)
                logger.debug(f"📥 Received: {response_data}")
                
                if response_data.get("type") == "error":
                    logger.error(f"❌ Error: {response_data.get('data')}")
                    return False
                elif response_data.get("type") == "content":
                    content = response_data.get('data', '')
                    display_content = str(content)[:100] if content else ''
                    logger.info(f"✅ Success! Received content: {display_content}...")
                    return True
                else:
                    data = response_data.get('data', '')
                    display_data = str(data)[:100] if data else ''
                    logger.info(f"📦 Received: {response_data.get('type')} - {display_data}...")
                    
                    # Continue listening for more messages
                    while True:
                        try:
                            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                            response_data = json.loads(response)
                            logger.debug(f"📥 Received: {response_data}")
                            
                            if response_data.get("type") == "content":
                                content = response_data.get('data', '')
                                display_content = str(content)[:100] if content else ''
                                logger.info(f"✅ Success! Content: {display_content}...")
                            elif response_data.get("type") == "end":
                                logger.info("🏁 Stream ended successfully!")
                                return True
                            elif response_data.get("type") == "error":
                                logger.error(f"❌ Error: {response_data.get('data')}")
                                return False
                                
                        except asyncio.TimeoutError:
                            logger.info("⏰ No more messages received")
                            break
                            
                    return True
                    
            except asyncio.TimeoutError:
                logger.error("⏰ Timeout waiting for response")
                return False
                
    except Exception as e:
        logger.error(f"❌ Direct Backend connection failed: {e}")
        return False

async def main():
    """Main test function"""
    success = await test_websocket_connection()
    
    if success:
        print("\n✅ Quick test passed!")
        print("LangChain Agent system is working correctly!")
    else:
        print("\n❌ Quick test failed!")
        print("Please check your setup and try again.")

if __name__ == "__main__":
    asyncio.run(main()) 