import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from config.config import settings

# Setup logging
logging.basicConfig(level=settings.LOG_LEVEL.upper())
logger = logging.getLogger(__name__)

client: Optional[AsyncIOMotorClient] = None

async def connect_to_mongo():
    global client
    logger.info("Connecting to MongoDB...")
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        await client.admin.command('ping')
        logger.info("Successfully connected to MongoDB.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        # Depending on the desired behavior, you might want to raise the exception
        # or handle it in a way that allows the application to exit gracefully.
        raise

async def close_mongo_connection():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")

def get_database():
    if client is None:
        raise Exception("MongoDB client not initialized. Call connect_to_mongo first.")
    # Extract database name from URI if it exists, otherwise raise an error or use a default
    db_name = client.get_database().name
    if not db_name:
        raise ValueError("MongoDB database name not found in URI and no default is set.")
    return client[db_name] 