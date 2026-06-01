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

SYSTEM_ANALISADOR = """Você é um Analista de Requisitos de Software sênior.
Sua função: transformar necessidades de negócio em requisitos formais e verificáveis para uma equipe de desenvolvimento.

PASSO 1 — DIAGNÓSTICO DE LACUNAS:
Antes de gerar requisitos, avalie se as necessidades coletadas têm informação suficiente.
Sinais de lacuna crítica:
- Necessidade sem usuário definido ("alguém", "todo mundo", "a empresa")
- Objetivo vago sem critério mensurável ("melhorar", "facilitar", "agilizar" sem contexto)
- Restrição de negócio completamente ausente (sem prazo, orçamento ou integração mencionados)
- Menos de 3 necessidades coletadas

Se houver lacuna crítica, retorne SOMENTE:
{
  "necessita_elicitacao": true,
  "pontos_vagos": ["descrição técnica da lacuna 1", "..."],
  "motivo_usuario": "Texto em linguagem de negócio explicando ao usuário o que falta. Ex: 'Ainda não sei quem vai usar esse sistema no dia a dia e como ele resolve esse problema hoje. Essas informações são essenciais para garantir que o projeto atenda às necessidades reais.'"
}

PASSO 2 — GERAÇÃO DE REQUISITOS (só se não houver lacuna):
Para cada necessidade, gere requisitos formais:
- codigo: "REQ-NNN"
- descricao: frase ativa, verificável, sem ambiguidade ("O sistema deve...")
- tipo: "funcional" | "não-funcional" | "restrição" | "interface"
- prioridade: "alta" | "média" | "baixa"
- criterios_aceitacao: lista de critérios testáveis
- atributos: {fonte, complexidade: "alta|média|baixa", testabilidade: "alta|média|baixa"}
- qualidade: {clareza: 0-10, completude: 0-10, testabilidade: 0-10, consistencia: 0-10}
- score_qualidade: média dos scores (0.0-1.0)

Retorne:
{
  "necessita_elicitacao": false,
  "requisitos": [...],
  "resumo": "Texto técnico resumindo a análise para a equipe",
  "score_geral": 0.0-1.0,
  "pontos_atencao": ["alertas para o time de dev, se houver"]
}"""


@router.post("/analisar", response_model=AgenteMessageResponse)
async def analisar(
    body: AgenteMessageRequest,
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

    valid_states = (ProjectStatus.elicitacao, ProjectStatus.analise)
    if projeto.status not in valid_states:
        raise HTTPException(status_code=400, detail=f"Projeto em fase {projeto.status}")

    nec_result = await db.execute(
        select(Necessidade).where(Necessidade.projeto_id == body.projeto_id)
    )
    necessidades = nec_result.scalars().all()

    nec_texto = "\n".join([
        f"- [{n.prioridade}] {n.descricao} (stakeholder: {n.stakeholder or 'não informado'})"
        for n in necessidades
    ])

    feedback_txt = f"\n\nFEEDBACK DO VALIDADOR (ciclo {projeto.ciclo_refinamento}):\n{body.content}" \
        if projeto.ciclo_refinamento > 0 and body.content else ""

    msgs = [{
        "role": "user",
        "content": (
            f"Projeto: {projeto.nome}\n"
            f"Área: {projeto.dominio or 'não informado'}\n"
            f"Contexto: {projeto.contexto_operacional or 'não informado'}\n"
            f"Categorias cobertas: {', '.join(projeto.categorias_concluidas or [])}\n\n"
            f"Necessidades coletadas:\n{nec_texto}"
            f"{feedback_txt}"
        ),
    }]

    data = await invoke_llm_json(messages=msgs, system=SYSTEM_ANALISADOR, max_tokens=16384)

    if data.get("necessita_elicitacao"):
        projeto.status = ProjectStatus.re_elicitacao
        projeto.re_elicitacao_motivo = data.get("motivo_usuario", "Precisamos de mais informações sobre o projeto.")
        projeto.re_elicitacao_origem = "analisador"
        await db.commit()

        return AgenteMessageResponse(
            reply=data["motivo_usuario"],
            phase=projeto.status,
            context={
                "necessita_elicitacao": True,
                "motivo": data["motivo_usuario"],
                "origem": "analisador",
                "pontos_vagos": data.get("pontos_vagos", []),
            },
        )

    req_existentes = await db.execute(
        select(Requisito).where(Requisito.projeto_id == body.projeto_id)
    )
    for r in req_existentes.scalars().all():
        await db.delete(r)

    for r in data.get("requisitos", []):
        req = Requisito(
            projeto_id=body.projeto_id,
            codigo=r.get("codigo", "REQ-000"),
            descricao=r.get("descricao", ""),
            tipo=r.get("tipo"),
            prioridade=r.get("prioridade"),
            atributos={**r.get("atributos", {}), "criterios_aceitacao": r.get("criterios_aceitacao", [])},
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
            "necessita_elicitacao": False,
            "requisitos_count": len(data.get("requisitos", [])),
            "score_geral": data.get("score_geral", 0),
            "pontos_atencao": data.get("pontos_atencao", []),
            "pode_validar": True,
        },
    )


@router.get("/requisitos/{projeto_id}")
async def listar_requisitos(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    proj = await db.execute(
        select(ProjetoRequisito).where(
            ProjetoRequisito.id == projeto_id,
            ProjetoRequisito.user_id == current_user.id,
        )
    )
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    result = await db.execute(select(Requisito).where(Requisito.projeto_id == projeto_id))
    return list(result.scalars().all())
