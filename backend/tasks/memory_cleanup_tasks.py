"""
Background tasks for Redis memory management
"""
import asyncio
import logging
from celery_app import celery
from utils.redis_memory_manager import memory_manager

logger = logging.getLogger(__name__)

@celery.task(name="cleanup_expired_sessions")
def cleanup_expired_sessions():
    """Clean up expired chat sessions from Redis"""
    try:
        # Run cleanup in async context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        expired_count = loop.run_until_complete(
            memory_manager.cleanup_expired_sessions()
        )
        
        logger.info(f"Cleaned up {expired_count} expired sessions")
        return expired_count
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired sessions: {e}")
        return 0
    finally:
        loop.close()

@celery.task(name="get_memory_stats")
def get_memory_stats():
    """Get Redis memory usage statistics"""
    try:
        # Run stats collection in async context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        stats = loop.run_until_complete(
            memory_manager.get_memory_stats()
        )
        
        logger.info(f"Memory stats: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get memory stats: {e}")
        return {}
    finally:
        loop.close()

# Schedule cleanup task to run every hour
@celery.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(
        3600.0,  # Every hour
        cleanup_expired_sessions.s(),
        name='cleanup-expired-sessions-hourly'
    )
    
    sender.add_periodic_task(
        300.0,  # Every 5 minutes
        get_memory_stats.s(),
        name='get-memory-stats-every-5min'
    ) 