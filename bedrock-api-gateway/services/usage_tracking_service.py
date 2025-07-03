import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, OperationFailure
import json

from config.config import settings
from models.usage import UsageRecord, ApiKeyUsage, DailyUsageStats, SystemMetrics

logger = logging.getLogger(__name__)

class UsageTrackingService:
    """
    Production-ready usage tracking service with MongoDB
    Tracks API usage, performance metrics, and generates statistics
    """
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database = None
        self.connected = False
        self.collections = {}
        
        # Initialize if MongoDB URI is provided
        if settings.MONGODB_URI:
            asyncio.create_task(self.connect())
        else:
            logger.warning("MongoDB URI not provided. Usage tracking disabled.")
    
    async def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=0,
                maxPoolSize=10,
                minPoolSize=1
            )
            
            # Test connection
            await self.client.admin.command('ping')
            
            # Get database
            db_name = settings.MONGODB_URI.split('/')[-1].split('?')[0] or 'bedrock_gateway'
            self.database = self.client[db_name]
            
            # Initialize collections
            self.collections = {
                'usage_records': self.database.usage_records,
                'api_key_usage': self.database.api_key_usage,
                'daily_stats': self.database.daily_stats,
                'system_metrics': self.database.system_metrics
            }
            
            # Create indexes
            await self._create_indexes()
            
            self.connected = True
            logger.info(f"Connected to MongoDB database: {db_name}")
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            self.connected = False
    
    async def _create_indexes(self):
        """Create database indexes for optimal performance"""
        try:
            # Usage records indexes
            await self.collections['usage_records'].create_index([("timestamp", -1)])
            await self.collections['usage_records'].create_index([("api_key", 1)])
            await self.collections['usage_records'].create_index([("endpoint", 1)])
            await self.collections['usage_records'].create_index([("status_code", 1)])
            await self.collections['usage_records'].create_index([("service_type", 1)])
            
            # API key usage indexes
            await self.collections['api_key_usage'].create_index([("api_key_hash", 1)], unique=True)
            await self.collections['api_key_usage'].create_index([("updated_at", -1)])
            
            # Daily stats indexes
            await self.collections['daily_stats'].create_index([("date", -1)])
            await self.collections['daily_stats'].create_index([("api_key", 1), ("date", -1)])
            
            # System metrics indexes
            await self.collections['system_metrics'].create_index([("timestamp", -1)])
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.error(f"Error creating indexes: {e}")
    
    def _mask_api_key(self, api_key: str) -> str:
        """Mask API key for logging/storage"""
        if not api_key or len(api_key) < 8:
            return "unknown"
        return f"{api_key[:4]}...{api_key[-4:]}"
    
    def _hash_api_key(self, api_key: str) -> str:
        """Create hash of API key for tracking"""
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    async def track_request(
        self,
        request_id: str,
        api_key: Optional[str],
        client_ip: str,
        method: str,
        endpoint: str,
        path: str,
        model_id: Optional[str],
        service_type: str,
        processing_time: float,
        status_code: int,
        request_size: int = 0,
        response_size: int = 0,
        user_agent: Optional[str] = None,
        query_params: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Track a single API request"""
        if not self.connected:
            return
        
        try:
            # Create usage record
            usage_record = UsageRecord(
                request_id=request_id,
                api_key=self._mask_api_key(api_key) if api_key else None,
                client_ip=client_ip,
                user_agent=user_agent,
                method=method,
                endpoint=endpoint,
                path=path,
                query_params=query_params,
                model_id=model_id,
                service_type=service_type,
                request_size=request_size,
                response_size=response_size,
                processing_time=processing_time,
                status_code=status_code,
                success=success,
                error_message=error_message,
                metadata=metadata
            )
            
            # Insert usage record
            await self.collections['usage_records'].insert_one(usage_record.dict(by_alias=True))
            
            # Update API key usage stats (async)
            if api_key:
                asyncio.create_task(self._update_api_key_usage(
                    api_key, service_type, processing_time, success, request_size, response_size
                ))
            
            # Update daily stats (async)
            asyncio.create_task(self._update_daily_stats(
                api_key, service_type, processing_time, success, client_ip, status_code, request_size, response_size
            ))
            
        except Exception as e:
            logger.error(f"Error tracking request {request_id}: {e}")
    
    async def _update_api_key_usage(
        self,
        api_key: str,
        service_type: str,
        processing_time: float,
        success: bool,
        request_size: int,
        response_size: int
    ):
        """Update API key usage statistics"""
        try:
            api_key_hash = self._hash_api_key(api_key)
            masked_key = self._mask_api_key(api_key)
            now = datetime.now(timezone.utc)
            
            # Prepare update operations
            update_ops = {
                '$inc': {
                    'total_requests': 1,
                    'total_request_size': request_size,
                    'total_response_size': response_size,
                },
                '$set': {
                    'api_key': masked_key,
                    'last_request': now,
                    'updated_at': now
                },
                '$setOnInsert': {
                    'api_key_hash': api_key_hash,
                    'first_request': now,
                    'created_at': now,
                    'min_processing_time': processing_time
                }
            }
            
            # Update success/failure counts
            if success:
                update_ops['$inc']['successful_requests'] = 1
            else:
                update_ops['$inc']['failed_requests'] = 1
            
            # Update service type counts
            service_field = f"{service_type}_requests"
            update_ops['$inc'][service_field] = 1
            
            # Update processing time stats
            update_ops['$max'] = {'max_processing_time': processing_time}
            update_ops['$min'] = {'min_processing_time': processing_time}
            
            # Upsert API key usage record
            await self.collections['api_key_usage'].update_one(
                {'api_key_hash': api_key_hash},
                update_ops,
                upsert=True
            )
            
            # Update average processing time
            await self._update_avg_processing_time(api_key_hash, processing_time)
            
        except Exception as e:
            logger.error(f"Error updating API key usage: {e}")
    
    async def _update_avg_processing_time(self, api_key_hash: str, processing_time: float):
        """Update average processing time for API key"""
        try:
            # Get current stats
            stats = await self.collections['api_key_usage'].find_one({'api_key_hash': api_key_hash})
            if stats:
                total_requests = stats.get('total_requests', 1)
                current_avg = stats.get('avg_processing_time', 0.0)
                
                # Calculate new average
                new_avg = ((current_avg * (total_requests - 1)) + processing_time) / total_requests
                
                # Update average
                await self.collections['api_key_usage'].update_one(
                    {'api_key_hash': api_key_hash},
                    {'$set': {'avg_processing_time': new_avg}}
                )
        except Exception as e:
            logger.error(f"Error updating average processing time: {e}")
    
    async def _update_daily_stats(
        self,
        api_key: Optional[str],
        service_type: str,
        processing_time: float,
        success: bool,
        client_ip: str,
        status_code: int,
        request_size: int,
        response_size: int
    ):
        """Update daily usage statistics"""
        try:
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            
            # Global daily stats
            await self._update_daily_stats_record(
                today, None, service_type, processing_time, success, client_ip, status_code, request_size, response_size
            )
            
            # API key specific daily stats
            if api_key:
                masked_key = self._mask_api_key(api_key)
                await self._update_daily_stats_record(
                    today, masked_key, service_type, processing_time, success, client_ip, status_code, request_size, response_size
                )
                
        except Exception as e:
            logger.error(f"Error updating daily stats: {e}")
    
    async def _update_daily_stats_record(
        self,
        date: str,
        api_key: Optional[str],
        service_type: str,
        processing_time: float,
        success: bool,
        client_ip: str,
        status_code: int,
        request_size: int,
        response_size: int
    ):
        """Update a specific daily stats record"""
        filter_query = {'date': date}
        if api_key:
            filter_query['api_key'] = api_key
        
        update_ops = {
            '$inc': {
                'total_requests': 1,
                'total_request_size': request_size,
                'total_response_size': response_size,
                f'{service_type}_requests': 1,
                f'status_code_counts.{status_code}': 1
            },
            '$set': {
                'updated_at': datetime.now(timezone.utc)
            },
            '$setOnInsert': {
                'date': date,
                'created_at': datetime.now(timezone.utc)
            },
            '$addToSet': {
                'unique_clients': client_ip
            }
        }
        
        if api_key:
            update_ops['$setOnInsert']['api_key'] = api_key
        
        # Update success/failure counts
        if success:
            update_ops['$inc']['successful_requests'] = 1
        else:
            update_ops['$inc']['failed_requests'] = 1
        
        # Update processing time stats
        update_ops['$max'] = {'max_processing_time': processing_time}
        
        await self.collections['daily_stats'].update_one(
            filter_query,
            update_ops,
            upsert=True
        )
    
    async def track_rate_limit_hit(self, api_key: Optional[str], client_ip: str):
        """Track rate limit violation"""
        if not self.connected:
            return
        
        try:
            # Update API key stats
            if api_key:
                api_key_hash = self._hash_api_key(api_key)
                await self.collections['api_key_usage'].update_one(
                    {'api_key_hash': api_key_hash},
                    {'$inc': {'rate_limit_hits': 1}}
                )
            
            # Update daily stats
            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            await self.collections['daily_stats'].update_one(
                {'date': today, 'api_key': self._mask_api_key(api_key) if api_key else None},
                {'$inc': {'rate_limit_hits': 1}},
                upsert=True
            )
            
        except Exception as e:
            logger.error(f"Error tracking rate limit hit: {e}")
    
    async def get_usage_summary(self, days: int = 7) -> Dict[str, Any]:
        """Get usage summary for the last N days"""
        if not self.connected:
            return {"error": "Database not connected"}
        
        try:
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            # Aggregate usage data
            pipeline = [
                {
                    '$match': {
                        'timestamp': {'$gte': start_date, '$lte': end_date}
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total_requests': {'$sum': 1},
                        'successful_requests': {'$sum': {'$cond': ['$success', 1, 0]}},
                        'failed_requests': {'$sum': {'$cond': ['$success', 0, 1]}},
                        'avg_processing_time': {'$avg': '$processing_time'},
                        'max_processing_time': {'$max': '$processing_time'},
                        'total_request_size': {'$sum': '$request_size'},
                        'total_response_size': {'$sum': '$response_size'},
                        'unique_api_keys': {'$addToSet': '$api_key'},
                        'unique_clients': {'$addToSet': '$client_ip'}
                    }
                }
            ]
            
            result = await self.collections['usage_records'].aggregate(pipeline).to_list(1)
            
            if result:
                summary = result[0]
                summary.pop('_id', None)
                
                # Convert sets to counts
                summary['unique_api_keys'] = len([k for k in summary.get('unique_api_keys', []) if k])
                summary['unique_clients'] = len(summary.get('unique_clients', []))
                
                return summary
            
            return {"total_requests": 0}
            
        except Exception as e:
            logger.error(f"Error getting usage summary: {e}")
            return {"error": str(e)}
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get health status of usage tracking service"""
        if not self.connected:
            return {
                "connected": False,
                "status": "disconnected",
                "error": "MongoDB not connected"
            }
        
        try:
            # Test database connection
            await self.client.admin.command('ping')
            
            # Get collection stats
            stats = {}
            for name, collection in self.collections.items():
                count = await collection.count_documents({})
                stats[name] = count
            
            return {
                "connected": True,
                "status": "healthy",
                "collection_counts": stats,
                "database": self.database.name
            }
            
        except Exception as e:
            return {
                "connected": False,
                "status": "error",
                "error": str(e)
            }

# Global usage tracking service instance
usage_tracking_service = UsageTrackingService() 