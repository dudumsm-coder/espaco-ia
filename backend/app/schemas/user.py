from pydantic import BaseModel
from datetime import datetime
from app.models.user import UserRole


class UserResponse(BaseModel):
    id: int
    clerk_id: str
    name: str
    email: str | None
    role: UserRole
    credits: int
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    name: str | None = None
    role: UserRole | None = None
    credits_adjust: int | None = None
    adjust_reason: str | None = None
