from lib.mongodb import get_database
from datetime import datetime, timedelta
import pytz

class StatsService:
    async def get_total_stats(self):
        db = get_database()
        total_users = await db.users.count_documents({})
        total_chats = await db.chats.count_documents({})
        return {"total_users": total_users, "total_chats": total_chats}

    async def get_daily_chat_stats(self):
        db = get_database()
        # This is a simplified example. A real implementation might use an aggregation pipeline.
        today = datetime.now(pytz.timezone('Asia/Bangkok')).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        # Convert to UTC for MongoDB query
        start_utc = today.astimezone(pytz.utc)
        end_utc = tomorrow.astimezone(pytz.utc)

        query = {"created_at": {"$gte": start_utc, "$lt": end_utc}}
        daily_chats = await db.chats.count_documents(query)
        
        return {"date": today.strftime('%Y-%m-%d'), "total_chats_today": daily_chats}
        
    async def get_daily_stats(self, start_date_str: str | None, end_date_str: str | None):
        db = get_database()
        query = {}
        if start_date_str and end_date_str:
            
            thai_tz = pytz.timezone('Asia/Bangkok')

            # Assume input is 'YYYY-MM-DD' string, treat it as local Thai time
            start_date = thai_tz.localize(datetime.strptime(start_date_str, '%Y-%m-%d'))
            end_date = thai_tz.localize(datetime.strptime(end_date_str, '%Y-%m-%d')).replace(hour=23, minute=59, second=59, microsecond=999999)

            # Convert to UTC for MongoDB query
            start_utc = start_date.astimezone(pytz.utc)
            end_utc = end_date.astimezone(pytz.utc)

            query["date"] = {
                "$gte": start_utc,
                "$lte": end_utc,
            }

        stats_cursor = db.get_collection("chatstats").find(query).sort("date", -1)
        
        stats = []
        for stat in await stats_cursor.to_list(length=None):
            stats.append({
                "date": stat["date"],
                "uniqueUsers": len(stat["uniqueUsers"]),
                "totalChats": stat["totalChats"],
                "totalTokens": stat.get("totalTokens", 0)
            })
            
        return stats

stats_service = StatsService() 