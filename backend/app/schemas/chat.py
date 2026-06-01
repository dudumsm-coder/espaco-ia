from pydantic import BaseModel
from datetime import datetime
from app.models.chat import MessageRole


class ChatMessageResponse(BaseModel):
    id: int
    role: MessageRole
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: int
    title: str | None
    created_at: datetime
    messages: list[ChatMessageResponse] = []

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    conversation_id: int | None = None
    content: str


class SendMessageResponse(BaseModel):
    conversation_id: int
    message: ChatMessageResponse
    reply: ChatMessageResponse
    credits_remaining: int
