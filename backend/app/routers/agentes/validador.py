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

SYSTEM_VALIDADOR = """Você é um Especialista em Qualidade de Requisitos de Software.

PASSO 1 — VERIFICAR SE PRECISA DE NOVA ELICITAÇÃO:
Avalie se existe um problema FUNDAMENTAL que só mais informação do usuário resolve:
- Requisito descreve algo sem propósito claro de negócio identificável
- Há contradição direta entre dois requisitos que só o usuário pode resolver
- Escopo completamente indefinido em área crítica do sistema

Se sim, retorne SOMENTE:
{
  "necessita_elicitacao": true,
  "motivo_usuario": "Explicação em linguagem de negócio do que falta. Ex: 'Encontramos uma situação em que dois requisitos do projeto pedem coisas diferentes para o mesmo processo. Precisamos que você esclareça qual é a forma correta de funcionar.'"
}

PASSO 2 — VALIDAÇÃO TÉCNICA (se não precisar de elicitação):
Avalie cada requisito pelos critérios C1-C6:
- C1 Necessidade: o requisito é realmente necessário para o negócio?
- C2 Adequação: está alinhado ao domínio e contexto do projeto?
- C3 Clareza: está escrito sem ambiguidade, qualquer dev entende?
- C4 Completude: tem todas as informações para ser implementado?
- C5 Verificabilidade: pode ser testado com critério objetivo?
- C6 Consistência: não contradiz outros requisitos?

Score >= 7 por critério = passa. Score geral >= 0.75 = aprovado.

Se reprovado e ainda há ciclos disponíveis, gere feedback técnico detalhado para o Analisador.

Retorne:
{
  "necessita_elicitacao": false,
  "aprovado": true | false,
  "score_geral": 0.0-1.0,
  "avaliacao_por_requisito": [
    {"codigo":"REQ-001","scores":{"C1":8,"C2":8,"C3":7,"C4":8,"C5":9,"C6":8},"issues":[]}
  ],
  "feedback_analisador": "Instruções técnicas detalhadas para melhorar os requisitos reprovados. Seja específico por requisito.",
  "resumo": "Resumo técnico da validação para registro"
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
        select(ProjetoRequisito).where(
            ProjetoRequisito.id == body.projeto_id,
            ProjetoRequisito.user_id == current_user.id,
        )
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if projeto.status != ProjectStatus.analise:
        raise HTTPException(status_code=400, detail=f"Projeto em fase {projeto.status}, não análise")

    req_result = await db.execute(
        select(Requisito).where(Requisito.projeto_id == body.projeto_id)
    )
    requisitos = req_result.scalars().all()
    if not requisitos:
        raise HTTPException(status_code=400, detail="Execute a análise primeiro.")

    req_texto = "\n".join([
        f"[{r.codigo}] {r.tipo} | Prioridade: {r.prioridade}\n  {r.descricao}"
        for r in requisitos
    ])
    msgs = [{
        "role": "user",
        "content": (
            f"Projeto: {projeto.nome} | Área: {projeto.dominio or 'n/a'}\n"
            f"Ciclo de refinamento: {projeto.ciclo_refinamento}/{MAX_CICLOS}\n\n"
            f"Requisitos para validar:\n{req_texto}"
        ),
    }]

    data = await invoke_llm_json(messages=msgs, system=SYSTEM_VALIDADOR, max_tokens=8192)

    if data.get("necessita_elicitacao"):
        projeto.status = ProjectStatus.re_elicitacao
        projeto.re_elicitacao_motivo = data.get("motivo_usuario", "Precisamos esclarecer um ponto do projeto.")
        projeto.re_elicitacao_origem = "validador"
        await db.commit()

        return AgenteMessageResponse(
            reply=data["motivo_usuario"],
            phase=projeto.status,
            context={
                "necessita_elicitacao": True,
                "motivo": data["motivo_usuario"],
                "origem": "validador",
            },
        )

    aprovado = data.get("aprovado", False)
    score = data.get("score_geral", 0)
    feedback = data.get("feedback_analisador", "")

    if aprovado or projeto.ciclo_refinamento >= MAX_CICLOS:
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
            "necessita_elicitacao": False,
            "aprovado": aprovado,
            "score_geral": score,
            "ciclo": projeto.ciclo_refinamento,
            "feedback": feedback,
            "deve_reanalisar": not aprovado and projeto.status == ProjectStatus.analise,
            "max_ciclos_atingido": projeto.ciclo_refinamento >= MAX_CICLOS,
        },
    )
