from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.chat import ChatConversation, ChatMessage, MessageRole
from app.schemas.chat import SendMessageRequest, ConversationResponse
from app.services.llm import stream_llm
from app.core.config import settings
import json

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM_PROMPT = """Você é um especialista em IA e transformação digital.
Ajude o usuário com estratégia, implementação e adoção de IA nos negócios.
Seja objetivo, prático e use exemplos reais."""


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatConversation).where(ChatConversation.user_id == current_user.id).order_by(ChatConversation.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/conversations/{conv_id}", response_model=ConversationResponse)
async def get_conversation(
    conv_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatConversation).where(ChatConversation.id == conv_id, ChatConversation.user_id == current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return conv


@router.post("/send")
async def send_message(
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.credits < settings.CHAT_CREDIT_COST:
        raise HTTPException(status_code=402, detail="Créditos insuficientes")

    if body.conversation_id:
        result = await db.execute(
            select(ChatConversation).where(ChatConversation.id == body.conversation_id, ChatConversation.user_id == current_user.id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversa não encontrada")
    else:
        conv = ChatConversation(user_id=current_user.id, title=body.content[:80])
        db.add(conv)
        await db.flush()

    user_msg = ChatMessage(conversation_id=conv.id, role=MessageRole.user, content=body.content)
    db.add(user_msg)
    await db.flush()

    msgs_result = await db.execute(
        select(ChatMessage).where(ChatMessage.conversation_id == conv.id).order_by(ChatMessage.created_at)
    )
    history = [{"role": m.role.value, "content": m.content} for m in msgs_result.scalars().all()]

    current_user.credits -= settings.CHAT_CREDIT_COST
    await db.commit()

    async def generate():
        full_reply = ""
        async for chunk in stream_llm(messages=history, system=SYSTEM_PROMPT):
            full_reply += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"

        assistant_msg = ChatMessage(conversation_id=conv.id, role=MessageRole.assistant, content=full_reply)
        async with AsyncSessionLocal() as session:
            session.add(assistant_msg)
            await session.commit()

        yield f"data: {json.dumps({'done': True, 'conversation_id': conv.id, 'credits': current_user.credits})}\n\n"

    from app.core.database import AsyncSessionLocal
    return StreamingResponse(generate(), media_type="text/event-stream")
