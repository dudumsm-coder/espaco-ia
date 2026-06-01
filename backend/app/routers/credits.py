from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.credit import CreditPackage, CreditTransaction, TransactionType
import stripe

router = APIRouter(prefix="/credits", tags=["credits"])
stripe.api_key = settings.STRIPE_SECRET_KEY


@router.get("/balance")
async def get_balance(current_user: User = Depends(get_current_user)):
    return {"credits": current_user.credits}


@router.get("/packages")
async def list_packages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CreditPackage).where(CreditPackage.active == True))
    return list(result.scalars().all())


@router.post("/checkout/{package_id}")
async def create_checkout(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CreditPackage).where(CreditPackage.id == package_id, CreditPackage.active == True))
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Pacote não encontrado")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": pkg.stripe_price_id, "quantity": 1}],
        mode="payment",
        success_url=f"{settings.FRONTEND_URL}/credits?success=true",
        cancel_url=f"{settings.FRONTEND_URL}/credits?cancelled=true",
        metadata={"user_id": str(current_user.id), "credits": str(pkg.credits)},
    )
    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook inválido")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = int(session["metadata"]["user_id"])
        credits = int(session["metadata"]["credits"])

        from app.repositories.user_repo import UserRepository
        user = await UserRepository.update_credits(db, user_id, credits)
        tx = CreditTransaction(
            user_id=user_id,
            type=TransactionType.credit,
            amount=credits,
            balance_after=user.credits,
            description=f"Compra via Stripe — {credits} créditos",
            stripe_payment_intent_id=session.get("payment_intent"),
        )
        db.add(tx)
        await db.commit()

    return {"received": True}
