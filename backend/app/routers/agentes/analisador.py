from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.requisito import (
    ProjetoRequisito, Necessidade, Requisito, SessaoChat,
    ProjectStatus, RequisitoStatus,
)
from app.schemas.requisito import AgenteMessageRequest, AgenteMessageResponse
from app.services.llm import invoke_llm_json

router = APIRouter(prefix="/analisador", tags=["agentes"])

SYSTEM_ANALISADOR = """Você é o Agente Analisador de requisitos de software (nível sênior).
Transforme necessidades brutas em requisitos formais com atributos A1-A9.

Para cada necessidade, gere um ou mais requisitos com:
- codigo: "REQ-NNN" (incremental)
- descricao: texto claro, verificável, sem ambiguidade
- tipo: "funcional" | "não-funcional" | "restrição" | "interface"
- prioridade: "alta" | "média" | "baixa"
- atributos: {fonte, complexidade, testabilidade, dependencias}
- qualidade: pontuação 0-10 para {clareza, completude, testabilidade, consistencia}
- score_qualidade: média dos scores (0.0-1.0)

Retorne JSON:
{
  "requisitos": [
    {
      "codigo": "REQ-001",
      "descricao": "...",
      "tipo": "funcional",
      "prioridade": "alta",
      "atributos": {"fonte": "...", "complexidade": "alta|média|baixa", "testabilidade": "alta|média|baixa"},
      "qualidade": {"clareza": 8, "completude": 7, "testabilidade": 9, "consistencia": 8},
      "score_qualidade": 0.80
    }
  ],
  "resumo": "texto explicando a análise",
  "score_geral": 0.80
}"""


@router.post("/analisar", response_model=AgenteMessageResponse)
async def analisar(
    body: AgenteMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.id == body.projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if projeto.status not in (ProjectStatus.elicitacao, ProjectStatus.analise):
        raise HTTPException(status_code=400, detail=f"Projeto em fase {projeto.status}, não análise")

    nec_result = await db.execute(
        select(Necessidade).where(Necessidade.projeto_id == body.projeto_id)
    )
    necessidades = nec_result.scalars().all()
    if not necessidades:
        raise HTTPException(status_code=400, detail="Nenhuma necessidade elicitada para analisar")

    nec_texto = "\n".join([f"- [{n.prioridade}] {n.descricao} (stakeholder: {n.stakeholder or 'não informado'})" for n in necessidades])

    feedback = f"\n\nFEEDBACK DO VALIDADOR (ciclo {projeto.ciclo_refinamento}):\n{body.content}" if projeto.ciclo_refinamento > 0 and body.content else ""

    msgs = [{"role": "user", "content": f"Projeto: {projeto.nome}\nDomínio: {projeto.dominio or 'não informado'}\nContexto: {projeto.contexto_operacional or 'não informado'}\n\nNecessidades identificadas:\n{nec_texto}{feedback}"}]

    data = await invoke_llm_json(messages=msgs, system=SYSTEM_ANALISADOR, max_tokens=16384)

    req_existentes = await db.execute(select(Requisito).where(Requisito.projeto_id == body.projeto_id))
    for r in req_existentes.scalars().all():
        await db.delete(r)

    for r in data.get("requisitos", []):
        req = Requisito(
            projeto_id=body.projeto_id,
            codigo=r.get("codigo", "REQ-000"),
            descricao=r.get("descricao", ""),
            tipo=r.get("tipo"),
            prioridade=r.get("prioridade"),
            atributos=r.get("atributos"),
            qualidade=r.get("qualidade"),
            score_qualidade=r.get("score_qualidade"),
            status=RequisitoStatus.analisado,
        )
        db.add(req)

    projeto.status = ProjectStatus.analise
    await db.commit()

    return AgenteMessageResponse(
        reply=data.get("resumo", "Análise concluída."),
        phase=projeto.status,
        context={
            "requisitos_count": len(data.get("requisitos", [])),
            "score_geral": data.get("score_geral", 0),
            "pode_validar": True,
        },
    )


@router.get("/requisitos/{projeto_id}")
async def listar_requisitos(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    proj = await db.execute(select(ProjetoRequisito).where(ProjetoRequisito.id == projeto_id, ProjetoRequisito.user_id == current_user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    result = await db.execute(select(Requisito).where(Requisito.projeto_id == projeto_id))
    return list(result.scalars().all())
