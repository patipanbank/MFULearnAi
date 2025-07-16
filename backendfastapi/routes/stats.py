from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any, List, Optional
from datetime import date
from middleware.role_guard import role_guard, TokenPayload
from services.stats_service import stats_service
from pydantic import BaseModel

router = APIRouter()

class DailyStat(BaseModel):
    date: date
    uniqueUsers: int
    totalChats: int
    totalTokens: int

@router.get("/stats", response_model=List[DailyStat])
async def get_daily_stats_route(
    start_date: Optional[date] = Query(None, description="Start date for stats query"),
    end_date: Optional[date] = Query(None, description="End date for stats query"),
    token: TokenPayload = Depends(role_guard(allowed_groups=["SuperAdmin", "Admin"]))
):
    try:
        start_date_str = start_date.isoformat() if start_date else None
        end_date_str = end_date.isoformat() if end_date else None
        stats = await stats_service.get_daily_stats(start_date_str, end_date_str)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/total", response_model=Dict[str, Any])
async def get_total_stats(
    token: TokenPayload = Depends(role_guard(allowed_groups=["SuperAdmin", "Admin"]))
):
    """
    Get total statistics for chats and users.
    """
    total_stats = await stats_service.get_total_stats()
    return total_stats

@router.get("/stats/daily", response_model=Dict[str, Any])
async def get_daily_chat_stats(
    token: TokenPayload = Depends(role_guard(allowed_groups=["SuperAdmin", "Admin"]))
):
    """
    Get daily statistics for chats.
    """
    daily_stats = await stats_service.get_daily_chat_stats()
    return daily_stats 