from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class APIKeyResponse(BaseModel):
    id: int
    key: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AnalyticsSummaryResponse(BaseModel):
    total_requests: int
    avg_latency_ms: float
    max_latency_ms: float
    status_breakdown: Dict[int, int]