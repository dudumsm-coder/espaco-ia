from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.requisito import ProjetoRequisito, Necessidade, Requisito, ProjectStatus
from app.schemas.requisito import ProjetoCreate, ProjetoResponse

router = APIRouter(prefix="/engenharia", tags=["engenharia"])

MAX_REFINAMENTO_CICLOS = 3


@router.post("/projetos", response_model=ProjetoResponse, status_code=201)
async def criar_projeto(
    body: ProjetoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projeto = ProjetoRequisito(
        user_id=current_user.id,
        nome=body.nome,
        dominio=body.dominio,
        contexto_operacional=body.contexto_operacional,
    )
    db.add(projeto)
    await db.commit()
    await db.refresh(projeto)
    return projeto


@router.get("/projetos", response_model=list[ProjetoResponse])
async def listar_projetos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.user_id == current_user.id).order_by(ProjetoRequisito.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/projetos/{projeto_id}", response_model=ProjetoResponse)
async def get_projeto(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.id == projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return projeto


@router.post("/projetos/{projeto_id}/avancar")
async def avancar_fase(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.id == projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    transitions = {
        ProjectStatus.iniciacao: ProjectStatus.elicitacao,
        ProjectStatus.elicitacao: ProjectStatus.analise,
        ProjectStatus.analise: ProjectStatus.validacao,
        ProjectStatus.validacao: ProjectStatus.documentacao,
        ProjectStatus.documentacao: ProjectStatus.baseline,
    }

    if projeto.status == ProjectStatus.elicitacao:
        nec_result = await db.execute(select(func.count()).where(Necessidade.projeto_id == projeto_id))
        count = nec_result.scalar()
        if count < 3:
            raise HTTPException(status_code=400, detail=f"Mínimo 3 necessidades. Atual: {count}")

    if projeto.status not in transitions:
        raise HTTPException(status_code=400, detail="Projeto já em fase final (baseline)")

    projeto.status = transitions[projeto.status]
    await db.commit()
    return {"status": projeto.status, "message": f"Avançado para fase {projeto.status}"}


@router.post("/projetos/{projeto_id}/refinamento")
async def solicitar_refinamento(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.id == projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if projeto.ciclo_refinamento >= MAX_REFINAMENTO_CICLOS:
        raise HTTPException(status_code=400, detail=f"Máximo {MAX_REFINAMENTO_CICLOS} ciclos de refinamento atingido")

    projeto.status = ProjectStatus.analise
    projeto.ciclo_refinamento += 1
    await db.commit()
    return {"ciclo": projeto.ciclo_refinamento, "status": projeto.status}
