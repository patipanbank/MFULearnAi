from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import List, Optional
from pydantic import BaseModel
from config.config import settings
from models.user import User, UserRole
from services.user_service import user_service

class TokenPayload(BaseModel):
    sub: str
    username: str
    nameID: str
    role: str
    firstName: Optional[str] = None
    department: Optional[str] = None
    
http_bearer = HTTPBearer()

def role_guard(allowed_groups: List[str]):
    def dependency(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> TokenPayload:
        token = credentials.credentials
        if not settings.JWT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT_SECRET not configured"
            )
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            token_data = TokenPayload(**payload)
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check role (single source of truth)
        user_role = token_data.role
        
        # Special case for SuperAdmin
        if user_role == "SuperAdmin":
            return token_data
        
        # Check if user role is in allowed roles
        if user_role not in allowed_groups:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{user_role}' not allowed.",
            )
        
        return token_data
    return dependency

def get_current_user_with_roles(allowed_roles: List[UserRole]):
    async def dependency(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)) -> User:
        token = credentials.credentials
        if not settings.JWT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT_SECRET not configured"
            )
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            if "sub" not in payload:
                raise jwt.InvalidTokenError("Missing 'sub' claim for user ID.")
            token_data = TokenPayload(**payload)
        except jwt.PyJWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {e}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = await user_service.get_user_by_id(token_data.sub)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        if user.role == UserRole.SUPER_ADMIN:
            return user

        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. User does not have the required role.",
            )
        
        return user
    return dependency 