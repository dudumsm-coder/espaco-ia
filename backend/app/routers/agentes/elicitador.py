from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.requisito import (
    ProjetoRequisito, Necessidade, SessaoChat,
    ProjectStatus, NecessidadeStatus,
)
from app.schemas.requisito import AgenteMessageRequest, AgenteMessageResponse
from app.services.llm import invoke_llm
import json
import re

router = APIRouter(prefix="/elicitador", tags=["agentes"])

CATEGORIAS = ["contexto", "negocio", "usuarios", "restricoes", "sucesso"]

CATEGORIA_LABELS = {
    "contexto": "Contexto da Necessidade",
    "negocio": "O Negócio e o Problema",
    "usuarios": "Quem Usa e Como Usa Hoje",
    "restricoes": "Restrições e Condições",
    "sucesso": "Critérios de Sucesso",
}

SYSTEM_BASE = """Você é um consultor de negócios sênior conduzindo uma entrevista de levantamento de necessidades.

REGRAS ABSOLUTAS:
- Linguagem 100% de negócio — NUNCA use termos técnicos (não use: API, endpoint, banco de dados, backend, frontend, deploy, sprint, stack, framework, etc.)
- Tom consultivo e profissional — como um consultor experiente em transformação digital
- Faça UMA pergunta por vez, mas pode fazer uma pergunta de aprofundamento se a resposta for vaga
- Seja direto e objetivo
- Quando identificar uma necessidade clara, extraia-a em JSON ao final da resposta

FORMATO DE EXTRAÇÃO (quando identificar necessidade):
Adicione ao final: <!--NEED:{"descricao":"...","stakeholder":"...","prioridade":"alta|media|baixa","categoria":"..."}-->

IMPORTANTE: Use apenas se tiver necessidade clara para extrair. Não inclua em perguntas de aprofundamento."""

PROMPTS_CATEGORIA = {
    "contexto": """CATEGORIA ATUAL: Contexto da Necessidade

Seu objetivo nesta etapa: entender a situação atual que motivou este projeto.
Perguntas-chave para explorar:
- Qual é a situação atual que gerou essa necessidade?
- O que acontece hoje sem esse projeto?
- Há quanto tempo esse problema existe?

Comece com uma pergunta aberta e acolhedora sobre o contexto atual do projeto.""",

    "negocio": """CATEGORIA ATUAL: O Negócio e o Problema Central

Seu objetivo: entender o problema de negócio e seu impacto real.
Perguntas-chave para explorar:
- Qual é o problema central que este projeto resolve?
- Qual é o impacto financeiro, operacional ou estratégico desse problema?
- Por que resolver isso agora é importante?

Faça uma pergunta direta sobre o problema principal.""",

    "usuarios": """CATEGORIA ATUAL: Quem Usa e Como Usa Hoje

Seu objetivo: mapear os usuários e o processo atual.
Perguntas-chave para explorar:
- Quem são as pessoas que vão usar ou se beneficiar deste projeto?
- Como essas pessoas resolvem esse problema hoje (mesmo que de forma manual ou ineficiente)?
- Quais são as principais dificuldades delas no processo atual?

Pergunte sobre quem são os usuários e como trabalham hoje.""",

    "restricoes": """CATEGORIA ATUAL: Restrições e Condições do Projeto

Seu objetivo: entender limitações e condicionantes.
Perguntas-chave para explorar:
- Existe um prazo definido para esse projeto entrar em funcionamento?
- Há um orçamento disponível ou limitações de recursos?
- Existem sistemas ou processos atuais que esse projeto precisa se conectar?

Pergunte sobre prazos e condições importantes.""",

    "sucesso": """CATEGORIA ATUAL: Como o Sucesso Será Medido

Seu objetivo: definir critérios claros de aceitação do negócio.
Perguntas-chave para explorar:
- Como você saberá que este projeto funcionou como esperado?
- Que resultado concreto você espera ver nos primeiros 90 dias?
- Existe algum indicador de desempenho que este projeto precisa melhorar?

Pergunte como o usuário medirá o sucesso do projeto.""",
}

SYSTEM_RE_ELICITACAO = """Você é um consultor de negócios sênior. Uma análise preliminar identificou uma lacuna importante nas informações coletadas.

CONTEXTO: {motivo}
ORIGEM: {origem}

Seu objetivo agora é fazer perguntas FOCADAS para esclarecer ESPECIFICAMENTE essa lacuna.
- Explique brevemente por que essa informação é importante (em linguagem de negócio)
- Faça no máximo 2 perguntas diretamente relacionadas à lacuna
- Não mude de assunto

Linguagem 100% de negócio — sem jargões técnicos."""


def _build_system(projeto: ProjetoRequisito, categoria: str) -> str:
    base = SYSTEM_BASE + "\n\n" + PROMPTS_CATEGORIA.get(categoria, "")
    base += f"\n\nCONTEXTO DO PROJETO: {projeto.nome}"
    if projeto.dominio:
        base += f" | Área: {projeto.dominio}"
    return base


def _next_categoria(concluidas: list) -> str | None:
    for cat in CATEGORIAS:
        if cat not in concluidas:
            return cat
    return None


def _extract_need(text: str) -> dict | None:
    match = re.search(r'<!--NEED:(.*?)-->', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            return None
    return None


def _clean_text(text: str) -> str:
    return re.sub(r'<!--NEED:.*?-->', '', text, flags=re.DOTALL).strip()


@router.post("/chat", response_model=AgenteMessageResponse)
async def chat_elicitador(
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

    valid_states = (ProjectStatus.iniciacao, ProjectStatus.elicitacao, ProjectStatus.re_elicitacao)
    if projeto.status not in valid_states:
        raise HTTPException(status_code=400, detail=f"Fase {projeto.status} não permite elicitação")

    is_re = projeto.status == ProjectStatus.re_elicitacao
    concluidas: list = projeto.categorias_concluidas or []

    if projeto.status == ProjectStatus.iniciacao:
        projeto.status = ProjectStatus.elicitacao
        concluidas = []
        projeto.categorias_concluidas = concluidas

    sessao_result = await db.execute(
        select(SessaoChat).where(
            SessaoChat.projeto_id == body.projeto_id,
            SessaoChat.agente == ("re_elicitador" if is_re else "elicitador"),
        )
    )
    sessao = sessao_result.scalar_one_or_none()
    if not sessao:
        agente_nome = "re_elicitador" if is_re else "elicitador"
        sessao = SessaoChat(projeto_id=body.projeto_id, agente=agente_nome, transcript=[], decisoes=[])
        db.add(sessao)
        await db.flush()

    if is_re:
        system = SYSTEM_RE_ELICITACAO.format(
            motivo=projeto.re_elicitacao_motivo or "Informação insuficiente",
            origem=projeto.re_elicitacao_origem or "análise",
        )
        categoria_atual = "re_elicitacao"
    else:
        categoria_atual = _next_categoria(concluidas) or "sucesso"
        system = _build_system(projeto, categoria_atual)

    if body.content:
        sessao.transcript.append({"role": "user", "content": body.content})

    reply_raw = await invoke_llm(messages=sessao.transcript, system=system, max_tokens=1024)
    need = _extract_need(reply_raw)
    reply = _clean_text(reply_raw)
    sessao.transcript.append({"role": "assistant", "content": reply})

    if need and need.get("descricao"):
        necessidade = Necessidade(
            projeto_id=body.projeto_id,
            descricao=need["descricao"],
            stakeholder=need.get("stakeholder"),
            prioridade=need.get("prioridade", "media"),
            status=NecessidadeStatus.identificada,
        )
        db.add(necessidade)

        if not is_re and need.get("categoria") == categoria_atual:
            if categoria_atual not in concluidas:
                concluidas.append(categoria_atual)
                projeto.categorias_concluidas = list(concluidas)

    nec_result = await db.execute(select(Necessidade).where(Necessidade.projeto_id == body.projeto_id))
    total_nec = len(nec_result.scalars().all())
    prox = _next_categoria(concluidas)
    todas_concluidas = prox is None

    if is_re and need:
        projeto.status = ProjectStatus.analise
        projeto.re_elicitacao_motivo = None
        projeto.re_elicitacao_origem = None

    await db.commit()

    return AgenteMessageResponse(
        reply=reply,
        phase=projeto.status,
        context={
            "categorias_concluidas": concluidas,
            "categoria_atual": categoria_atual if not is_re else "re_elicitacao",
            "proxima_categoria": prox,
            "todas_categorias_concluidas": todas_concluidas,
            "necessidades_count": total_nec,
            "pode_avancar": todas_concluidas and total_nec >= 3,
            "is_re_elicitacao": is_re,
            "motivo_re_elicitacao": projeto.re_elicitacao_motivo,
        },
    )


@router.get("/necessidades/{projeto_id}")
async def listar_necessidades(
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
    result = await db.execute(select(Necessidade).where(Necessidade.projeto_id == projeto_id))
    return list(result.scalars().all())
