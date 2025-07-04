import redis
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import asyncio

from config.config import settings

logger = logging.getLogger(__name__)

class RedisMemoryManager:
    """
    Centralized Redis Memory Manager for Chat Sessions
    Best Practices Implementation
    """
    
    # Namespace constants
    NAMESPACE = "mfu:chat"
    SESSION_PREFIX = f"{NAMESPACE}:session"
    MEMORY_PREFIX = f"{NAMESPACE}:memory"
    PUBSUB_PREFIX = f"{NAMESPACE}:pubsub"
    
    # Configuration
    DEFAULT_TTL = 3600  # 1 hour
    MAX_MEMORY_SIZE = 1024 * 1024  # 1MB per session
    MAX_MESSAGES_PER_SESSION = 100
    
    def __init__(self):
        self.redis_url = settings.REDIS_URL
        if not self.redis_url:
            raise ValueError("REDIS_URL must be configured")
        
        # Connection pool configuration
        self.redis_client = redis.Redis.from_url(
            self.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
            max_connections=20
        )
        
        # Test connection
        try:
            self.redis_client.ping()
            logger.info("Redis Memory Manager initialized successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def _get_session_key(self, user_id: str, session_id: str) -> str:
        """Generate consistent session key"""
        return f"{self.SESSION_PREFIX}:{user_id}:{session_id}"
    
    def _get_memory_key(self, user_id: str, session_id: str) -> str:
        """Generate memory key for LangChain"""
        return f"{self.MEMORY_PREFIX}:{user_id}:{session_id}"
    
    def _get_pubsub_channel(self, session_id: str) -> str:
        """Generate pubsub channel name"""
        return f"{self.PUBSUB_PREFIX}:{session_id}"
    
    async def create_session(self, user_id: str, session_id: str, metadata: Dict[str, Any] | None = None) -> bool:
        """Create a new chat session with metadata"""
        try:
            session_key = self._get_session_key(user_id, session_id)
            memory_key = self._get_memory_key(user_id, session_id)
            
            # Use pipeline for atomic operations
            pipe = self.redis_client.pipeline()
            
            # Store session metadata
            session_data: Dict[str, str] = {
                "user_id": user_id,
                "session_id": session_id,
                "created_at": datetime.utcnow().isoformat(),
                "last_activity": datetime.utcnow().isoformat(),
                "message_count": "0",
                "memory_size": "0"
            }
            
            # Add metadata if provided
            if metadata:
                for key, value in metadata.items():
                    session_data[str(key)] = str(value)
            
            pipe.hmset(session_key, session_data)
            pipe.expire(session_key, self.DEFAULT_TTL)
            
            # Initialize memory key
            pipe.set(memory_key, json.dumps([]), ex=self.DEFAULT_TTL)
            
            # Execute pipeline
            pipe.execute()
            
            logger.info(f"Created session {session_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create session {session_id}: {e}")
            return False
    
    async def get_session_info(self, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information"""
        try:
            session_key = self._get_session_key(user_id, session_id)
            data = self.redis_client.hgetall(session_key)
            
            if not data:
                return None
            
            # Convert string values to appropriate types
            result: Dict[str, Any] = {}
            for key, value in data.items():
                if key in ["message_count", "memory_size"]:
                    result[key] = int(value)
                elif key in ["created_at", "last_activity"]:
                    result[key] = datetime.fromisoformat(value)
                else:
                    result[key] = value
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get session info {session_id}: {e}")
            return None
    
    async def update_session_activity(self, user_id: str, session_id: str) -> bool:
        """Update session last activity timestamp"""
        try:
            session_key = self._get_session_key(user_id, session_id)
            self.redis_client.hset(
                session_key, 
                "last_activity", 
                datetime.utcnow().isoformat()
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update session activity {session_id}: {e}")
            return False
    
    async def increment_message_count(self, user_id: str, session_id: str) -> bool:
        """Increment message count for session"""
        try:
            session_key = self._get_session_key(user_id, session_id)
            self.redis_client.hincrby(session_key, "message_count", 1)
            return True
        except Exception as e:
            logger.error(f"Failed to increment message count {session_id}: {e}")
            return False
    
    async def delete_session(self, user_id: str, session_id: str) -> bool:
        """Delete session and all related data"""
        try:
            session_key = self._get_session_key(user_id, session_id)
            memory_key = self._get_memory_key(user_id, session_id)
            pubsub_channel = self._get_pubsub_channel(session_id)
            
            # Use pipeline for atomic deletion
            pipe = self.redis_client.pipeline()
            
            # Delete session data
            pipe.delete(session_key)
            pipe.delete(memory_key)
            
            # Clear any pubsub messages (optional)
            pipe.delete(f"{pubsub_channel}:*")
            
            # Execute pipeline
            deleted_count = pipe.execute()
            
            logger.info(f"Deleted session {session_id}, removed {sum(deleted_count)} keys")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete session {session_id}: {e}")
            return False
    
    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions"""
        try:
            pattern = f"{self.SESSION_PREFIX}:*"
            keys = self.redis_client.keys(pattern)
            
            expired_count = 0
            for key in keys:
                if not self.redis_client.exists(key):
                    # Key has expired, clean up related data
                    parts = key.split(":")
                    if len(parts) >= 4:
                        user_id = parts[2]
                        session_id = parts[3]
                        
                        memory_key = self._get_memory_key(user_id, session_id)
                        self.redis_client.delete(memory_key)
                        expired_count += 1
            
            if expired_count > 0:
                logger.info(f"Cleaned up {expired_count} expired sessions")
            
            return expired_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired sessions: {e}")
            return 0
    
    async def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory usage statistics"""
        try:
            stats = {
                "total_sessions": 0,
                "total_memory_size": 0,
                "active_sessions": 0,
                "expired_sessions": 0
            }
            
            # Count sessions
            session_keys = self.redis_client.keys(f"{self.SESSION_PREFIX}:*")
            stats["total_sessions"] = len(session_keys)
            
            # Calculate memory usage
            for key in session_keys:
                data = self.redis_client.hgetall(key)
                if data:
                    stats["total_memory_size"] += int(data.get("memory_size", 0))
                    stats["active_sessions"] += 1
            
            # Count expired sessions
            stats["expired_sessions"] = await self.cleanup_expired_sessions()
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return {}
    
    def get_langchain_memory_config(self, user_id: str, session_id: str) -> Dict[str, Any]:
        """Get configuration for LangChain RedisChatMessageHistory"""
        memory_key = self._get_memory_key(user_id, session_id)
        return {
            "session_id": memory_key,
            "url": self.redis_url,
            "ttl": self.DEFAULT_TTL,
            "max_messages": self.MAX_MESSAGES_PER_SESSION
        }
    
    async def publish_message(self, session_id: str, message: Dict[str, Any]) -> bool:
        """Publish message to pubsub channel"""
        try:
            channel = self._get_pubsub_channel(session_id)
            self.redis_client.publish(channel, json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Failed to publish message to {session_id}: {e}")
            return False
    
    @asynccontextmanager
    async def session_context(self, user_id: str, session_id: str):
        """Context manager for session operations"""
        try:
            # Update activity
            await self.update_session_activity(user_id, session_id)
            yield self
        except Exception as e:
            logger.error(f"Session context error for {session_id}: {e}")
            raise
        finally:
            # Optional: cleanup if needed
            pass

# Global instance
memory_manager = RedisMemoryManager() 