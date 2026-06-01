from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.models.user import UserRole


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    credits: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


class AdminUserUpdate(BaseModel):
    name: str | None = None
    role: UserRole | None = None
    credits_adjust: int | None = None
    adjust_reason: str | None = None
