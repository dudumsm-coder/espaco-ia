from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin
from app.models.appointment import Appointment, AppointmentStatus
from app.models.user import User
from app.core.config import settings
from pydantic import BaseModel

router = APIRouter(prefix="/appointments", tags=["appointments"])


class AppointmentCreate(BaseModel):
    scheduled_at: datetime
    topic: str | None = None
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    status: AppointmentStatus | None = None
    notes: str | None = None


@router.get("")
async def list_appointments(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Appointment).where(Appointment.user_id == current_user.id).order_by(Appointment.scheduled_at.desc())
    )
    return list(result.scalars().all())


@router.post("", status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.credits < settings.APPOINTMENT_CREDIT_COST:
        raise HTTPException(status_code=402, detail=f"Créditos insuficientes. Necessário: {settings.APPOINTMENT_CREDIT_COST}")

    appointment = Appointment(
        user_id=current_user.id,
        scheduled_at=body.scheduled_at,
        topic=body.topic,
        notes=body.notes,
    )
    db.add(appointment)
    current_user.credits -= settings.APPOINTMENT_CREDIT_COST
    await db.commit()
    await db.refresh(appointment)
    return appointment


@router.patch("/{appointment_id}")
async def update_appointment(
    appointment_id: int,
    body: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.user_id == current_user.id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(appt, k, v)
    await db.commit()
    await db.refresh(appt)
    return appt


@router.delete("/{appointment_id}", status_code=204)
async def cancel_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.user_id == current_user.id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    appt.status = AppointmentStatus.cancelled
    await db.commit()


@router.get("/admin/all")
async def list_all_appointments(db: AsyncSession = Depends(get_db), _=Depends(get_current_admin)):
    result = await db.execute(select(Appointment).order_by(Appointment.scheduled_at.desc()))
    return list(result.scalars().all())
