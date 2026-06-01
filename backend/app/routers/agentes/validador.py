from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.requisito import ProjetoRequisito, Requisito, ProjectStatus, RequisitoStatus
from app.schemas.requisito import AgenteMessageResponse
from app.services.llm import invoke_llm_json
from pydantic import BaseModel

router = APIRouter(prefix="/validador", tags=["agentes"])

MAX_CICLOS = 3

SYSTEM_VALIDADOR = """Você é o Agente Validador de requisitos de software.
Avalie os requisitos segundo critérios C1-C6:
- C1: Necessidade (o requisito é realmente necessário?)
- C2: Adequação (adequado ao domínio e contexto?)
- C3: Clareza (sem ambiguidade?)
- C4: Completude (suficientemente detalhado?)
- C5: Verificabilidade (pode ser testado/verificado?)
- C6: Consistência (sem contradições com outros requisitos?)

Score geral >= 0.75 = aprovado. Abaixo = reprovado com feedback.

Retorne JSON:
{
  "aprovado": true | false,
  "score_geral": 0.0-1.0,
  "avaliacao_por_requisito": [
    {"codigo": "REQ-001", "scores": {"C1":8,"C2":8,"C3":7,"C4":8,"C5":9,"C6":8}, "issues": ["descrição do problema se houver"]}
  ],
  "feedback_analisador": "instruções específicas para melhorar os requisitos reprovados",
  "resumo": "texto resumindo a validação"
}"""


class ValidarRequest(BaseModel):
    projeto_id: int


@router.post("/validar", response_model=AgenteMessageResponse)
async def validar(
    body: ValidarRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.id == body.projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if projeto.status != ProjectStatus.analise:
        raise HTTPException(status_code=400, detail=f"Projeto em fase {projeto.status}, não análise")

    req_result = await db.execute(select(Requisito).where(Requisito.projeto_id == body.projeto_id))
    requisitos = req_result.scalars().all()
    if not requisitos:
        raise HTTPException(status_code=400, detail="Nenhum requisito para validar. Execute a análise primeiro.")

    req_texto = "\n".join([f"[{r.codigo}] {r.tipo} | {r.prioridade}\n  {r.descricao}" for r in requisitos])
    msgs = [{"role": "user", "content": f"Projeto: {projeto.nome}\nCiclo: {projeto.ciclo_refinamento}\n\nRequisitos:\n{req_texto}"}]

    data = await invoke_llm_json(messages=msgs, system=SYSTEM_VALIDADOR, max_tokens=8192)

    aprovado = data.get("aprovado", False)
    score = data.get("score_geral", 0)

    if aprovado:
        for r in requisitos:
            r.status = RequisitoStatus.validado
        projeto.status = ProjectStatus.validacao
    else:
        if projeto.ciclo_refinamento >= MAX_CICLOS:
            for r in requisitos:
                r.status = RequisitoStatus.validado
            projeto.status = ProjectStatus.validacao
            aprovado = True
        else:
            projeto.ciclo_refinamento += 1
            projeto.status = ProjectStatus.analise

    await db.commit()

    return AgenteMessageResponse(
        reply=data.get("resumo", "Validação concluída."),
        phase=projeto.status,
        context={
            "aprovado": aprovado,
            "score_geral": score,
            "ciclo": projeto.ciclo_refinamento,
            "feedback": data.get("feedback_analisador", ""),
            "max_ciclos_atingido": projeto.ciclo_refinamento >= MAX_CICLOS,
            "deve_reanalisar": not aprovado and projeto.ciclo_refinamento < MAX_CICLOS,
        },
    )
