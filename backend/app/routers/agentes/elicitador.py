from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.requisito import ProjetoRequisito, Necessidade, SessaoChat, ProjectStatus, NecessidadeStatus
from app.schemas.requisito import AgenteMessageRequest, AgenteMessageResponse
from app.services.llm import invoke_llm

router = APIRouter(prefix="/elicitador", tags=["agentes"])

SYSTEM_ELICITADOR = """Você é o Agente Elicitador de requisitos de software.
Sua missão: identificar e capturar necessidades dos stakeholders através de perguntas abertas e empáticas.
Técnicas: entrevista, brainstorming, análise de domínio.
Ao identificar uma necessidade clara, extraia: descrição, stakeholder, prioridade (alta/média/baixa).
Formato de resposta: texto conversacional + JSON ao final quando identificar necessidade:
{"necessidade": {"descricao": "...", "stakeholder": "...", "prioridade": "alta|media|baixa"}}
Se não identificou necessidade ainda, só responda com texto conversacional."""


@router.post("/chat", response_model=AgenteMessageResponse)
async def chat_elicitador(
    body: AgenteMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(ProjetoRequisito.id == body.projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if projeto.status not in (ProjectStatus.iniciacao, ProjectStatus.elicitacao):
        raise HTTPException(status_code=400, detail=f"Projeto em fase {projeto.status}, não elicitação")

    if projeto.status == ProjectStatus.iniciacao:
        projeto.status = ProjectStatus.elicitacao
        await db.flush()

    sessao_result = await db.execute(
        select(SessaoChat).where(SessaoChat.projeto_id == body.projeto_id, SessaoChat.agente == "elicitador")
    )
    sessao = sessao_result.scalar_one_or_none()
    if not sessao:
        sessao = SessaoChat(projeto_id=body.projeto_id, agente="elicitador", transcript=[], decisoes=[])
        db.add(sessao)
        await db.flush()

    sessao.transcript.append({"role": "user", "content": body.content})
    reply = await invoke_llm(
        messages=sessao.transcript,
        system=SYSTEM_ELICITADOR + f"\n\nContexto do projeto: {projeto.contexto_operacional or 'não informado'}\nDomínio: {projeto.dominio or 'não informado'}",
    )
    sessao.transcript.append({"role": "assistant", "content": reply})

    import json, re
    json_match = re.search(r'\{.*"necessidade".*\}', reply, re.DOTALL)
    if json_match:
        try:
            extracted = json.loads(json_match.group())
            n_data = extracted.get("necessidade", {})
            necessidade = Necessidade(
                projeto_id=body.projeto_id,
                descricao=n_data.get("descricao", ""),
                stakeholder=n_data.get("stakeholder"),
                prioridade=n_data.get("prioridade"),
                status=NecessidadeStatus.identificada,
            )
            db.add(necessidade)
            sessao.decisoes.append({"necessidade_id": None, "descricao": n_data.get("descricao")})
        except Exception:
            pass

    nec_count_result = await db.execute(
        select(Necessidade).where(Necessidade.projeto_id == body.projeto_id)
    )
    nec_count = len(nec_count_result.scalars().all())

    await db.commit()

    return AgenteMessageResponse(
        reply=reply,
        phase=projeto.status,
        context={"necessidades_count": nec_count, "pode_avancar": nec_count >= 3},
    )
