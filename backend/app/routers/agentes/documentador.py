from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.services.credits import deduct_credits
from app.models.requisito import (
    ProjetoRequisito, Requisito, Necessidade, Artefato,
    ProjectStatus, ArtifactType,
)
from app.services.llm import invoke_llm_json
from pydantic import BaseModel
import json

router = APIRouter(prefix="/documentador", tags=["agentes"])

SYSTEM_SRS = """Você é um Analista de Sistemas gerando documentação técnica para uma equipe de desenvolvimento.
Gere um SRS (Software Requirements Specification) completo e profissional.
A linguagem deve ser TÉCNICA — para desenvolvedores, não para o usuário de negócio.
Cada requisito deve ter critérios de aceitação testáveis.

Retorne JSON:
{
  "titulo": "SRS — [Nome do Projeto]",
  "versao": "1.0",
  "data": "[data]",
  "introducao": {
    "proposito": "...",
    "escopo": "...",
    "definicoes": [{"termo": "...", "definicao": "..."}],
    "publico_alvo": "Equipe de desenvolvimento, QA e stakeholders técnicos"
  },
  "descricao_geral": {
    "perspectiva": "...",
    "funcionalidades_principais": ["..."],
    "restricoes": ["..."],
    "premissas": ["..."]
  },
  "requisitos_funcionais": [
    {
      "id": "RF-001",
      "nome": "...",
      "descricao": "O sistema deve...",
      "prioridade": "Alta|Média|Baixa",
      "criterios_aceitacao": ["Dado X, quando Y, então Z"],
      "dependencias": []
    }
  ],
  "requisitos_nao_funcionais": [
    {"id": "RNF-001", "categoria": "Performance|Segurança|Usabilidade|Disponibilidade", "descricao": "..."}
  ],
  "interfaces_externas": [],
  "restricoes_tecnicas": []
}"""

SYSTEM_MATRIZ = """Gere uma Matriz de Rastreabilidade completa para entrega ao time de desenvolvimento.
Linguagem técnica. Garanta rastreabilidade bidirecional: necessidade de negócio → requisito → critério.

Retorne JSON:
{
  "titulo": "Matriz de Rastreabilidade — [Projeto]",
  "descricao": "Mapeamento bidirecional necessidade→requisito→critério de aceitação",
  "colunas": ["ID Req","Descrição","Tipo","Prioridade","Necessidade Origem","Stakeholder","Critério Principal","Status"],
  "linhas": [["REQ-001","...","Funcional","Alta","Descrição da necessidade","Stakeholder","Critério testável","Aprovado"]]
}"""

SYSTEM_ARVORE = """Gere uma Árvore de Requisitos hierárquica para planejamento de sprints.
Agrupe por módulos funcionais lógicos. Use linguagem técnica.

Retorne JSON:
{
  "titulo": "Árvore de Requisitos — [Projeto]",
  "descricao": "Hierarquia de requisitos organizada por módulos para planejamento de sprints",
  "sistema": {
    "nome": "[Nome do Sistema]",
    "modulos": [
      {
        "nome": "Módulo: [Nome]",
        "descricao": "...",
        "sprint_sugerida": 1,
        "requisitos": [
          {"id":"REQ-001","descricao":"...","tipo":"funcional","prioridade":"alta","esforco_estimado":"P|M|G|XG"}
        ]
      }
    ]
  }
}"""

SYSTEM_ICD = """Gere um ICD (Interface Control Document) para o time de desenvolvimento.
Documente todas as interfaces internas e externas do sistema.
Linguagem técnica — para devs e arquitetos.

Retorne JSON:
{
  "titulo": "ICD — [Projeto]",
  "descricao": "Documento de controle de interfaces do sistema",
  "interfaces": [
    {
      "id": "INT-001",
      "nome": "...",
      "tipo": "UI|API|Database|External|Integration",
      "direcao": "entrada|saída|bidirecional",
      "descricao": "...",
      "formato": "...",
      "protocolo": "...",
      "autenticacao": "...",
      "observacoes": "..."
    }
  ],
  "dependencias_externas": [],
  "restricoes_integracao": []
}"""


def _build_context(projeto: ProjetoRequisito, necessidades, requisitos) -> str:
    nec = "\n".join([f"- [{n.prioridade}] {n.descricao} | Stakeholder: {n.stakeholder or 'n/a'}" for n in necessidades])
    req = "\n".join([f"[{r.codigo}] {r.tipo} | {r.prioridade}: {r.descricao}" for r in requisitos])
    return (
        f"Projeto: {projeto.nome}\n"
        f"Área/Domínio: {projeto.dominio or 'não informado'}\n"
        f"Contexto operacional: {projeto.contexto_operacional or 'não informado'}\n\n"
        f"NECESSIDADES DE NEGÓCIO:\n{nec}\n\n"
        f"REQUISITOS FORMAIS APROVADOS:\n{req}"
    )


def _json_to_markdown(tipo: ArtifactType, data: dict, projeto_nome: str) -> str:
    if tipo == ArtifactType.srs:
        return _srs_to_md(data, projeto_nome)
    elif tipo == ArtifactType.matriz:
        return _matriz_to_md(data)
    elif tipo == ArtifactType.arvore:
        return _arvore_to_md(data)
    elif tipo == ArtifactType.icd:
        return _icd_to_md(data)
    return f"# {tipo.upper()}\n\n```json\n{json.dumps(data, ensure_ascii=False, indent=2)}\n```"


def _srs_to_md(d: dict, nome: str) -> str:
    intro = d.get("introducao", {})
    geral = d.get("descricao_geral", {})
    md = f"# {d.get('titulo', f'SRS — {nome}')}\n\n"
    md += f"**Versão:** {d.get('versao','1.0')} | **Data:** {d.get('data','—')} | **Status:** Aprovado\n\n"
    md += "---\n\n## 1. Introdução\n\n"
    md += f"**Propósito:** {intro.get('proposito','')}\n\n"
    md += f"**Escopo:** {intro.get('escopo','')}\n\n"
    if intro.get("definicoes"):
        md += "**Definições:**\n" + "".join([f"- **{d['termo']}**: {d['definicao']}\n" for d in intro["definicoes"]]) + "\n"
    md += "## 2. Descrição Geral\n\n"
    md += f"{geral.get('perspectiva','')}\n\n"
    if geral.get("funcionalidades_principais"):
        md += "**Funcionalidades principais:**\n" + "".join([f"- {f}\n" for f in geral["funcionalidades_principais"]]) + "\n"
    if geral.get("restricoes"):
        md += "**Restrições:**\n" + "".join([f"- {r}\n" for r in geral["restricoes"]]) + "\n"
    md += "## 3. Requisitos Funcionais\n\n"
    for rf in d.get("requisitos_funcionais", []):
        md += f"### {rf.get('id','RF-?')} — {rf.get('nome','')}\n\n"
        md += f"**Prioridade:** {rf.get('prioridade','')}\n\n"
        md += f"{rf.get('descricao','')}\n\n"
        if rf.get("criterios_aceitacao"):
            md += "**Critérios de Aceitação:**\n" + "".join([f"- [ ] {c}\n" for c in rf["criterios_aceitacao"]]) + "\n"
    md += "## 4. Requisitos Não-Funcionais\n\n"
    for rnf in d.get("requisitos_nao_funcionais", []):
        md += f"- **{rnf.get('id','')} [{rnf.get('categoria','')}]:** {rnf.get('descricao','')}\n"
    return md


def _matriz_to_md(d: dict) -> str:
    md = f"# {d.get('titulo','Matriz de Rastreabilidade')}\n\n"
    md += f"_{d.get('descricao','')}_\n\n"
    cols = d.get("colunas", [])
    if cols:
        md += "| " + " | ".join(cols) + " |\n"
        md += "| " + " | ".join(["---"] * len(cols)) + " |\n"
        for row in d.get("linhas", []):
            md += "| " + " | ".join(str(c) for c in row) + " |\n"
    return md


def _arvore_to_md(d: dict) -> str:
    md = f"# {d.get('titulo','Árvore de Requisitos')}\n\n"
    md += f"_{d.get('descricao','')}_\n\n"
    sistema = d.get("sistema", {})
    for mod in sistema.get("modulos", []):
        md += f"## {mod.get('nome','')} _(Sprint {mod.get('sprint_sugerida','?')})_\n\n"
        md += f"{mod.get('descricao','')}\n\n"
        for req in mod.get("requisitos", []):
            md += f"- **{req.get('id','')}** [{req.get('tipo','').upper()}] [{req.get('prioridade','').upper()}] `{req.get('esforco_estimado','?')}` — {req.get('descricao','')}\n"
        md += "\n"
    return md


def _icd_to_md(d: dict) -> str:
    md = f"# {d.get('titulo','ICD')}\n\n"
    md += f"_{d.get('descricao','')}_\n\n"
    for iface in d.get("interfaces", []):
        md += f"## {iface.get('id','')} — {iface.get('nome','')}\n\n"
        md += f"| Campo | Valor |\n|---|---|\n"
        for k, v in iface.items():
            if k not in ("id", "nome") and v:
                md += f"| {k.replace('_',' ').title()} | {v} |\n"
        md += "\n"
    if d.get("dependencias_externas"):
        md += "## Dependências Externas\n\n" + "".join([f"- {dep}\n" for dep in d["dependencias_externas"]]) + "\n"
    return md


class DocumentarRequest(BaseModel):
    projeto_id: int
    tipo: ArtifactType


@router.post("/gerar")
async def gerar_artefato(
    body: DocumentarRequest,
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
    if projeto.status not in (ProjectStatus.validacao, ProjectStatus.documentacao, ProjectStatus.baseline):
        raise HTTPException(status_code=400, detail="Execute validação primeiro")

    req_result = await db.execute(select(Requisito).where(Requisito.projeto_id == body.projeto_id))
    necessidades_result = await db.execute(select(Necessidade).where(Necessidade.projeto_id == body.projeto_id))
    requisitos = req_result.scalars().all()
    necessidades = necessidades_result.scalars().all()

    await deduct_credits(db, current_user, settings.DOCUMENTADOR_CREDIT_COST,
        f"Documentador — geração de {body.tipo.value.upper()}")

    context = _build_context(projeto, necessidades, requisitos)
    system_map = {
        ArtifactType.srs: SYSTEM_SRS,
        ArtifactType.matriz: SYSTEM_MATRIZ,
        ArtifactType.arvore: SYSTEM_ARVORE,
        ArtifactType.icd: SYSTEM_ICD,
    }

    data = await invoke_llm_json(
        messages=[{"role": "user", "content": context}],
        system=system_map[body.tipo],
        max_tokens=16384,
    )

    markdown = _json_to_markdown(body.tipo, data, projeto.nome)

    art_result = await db.execute(
        select(Artefato).where(
            Artefato.projeto_id == body.projeto_id,
            Artefato.tipo == body.tipo,
        )
    )
    existing = art_result.scalar_one_or_none()
    if existing:
        existing.conteudo = {**data, "_markdown": markdown}
    else:
        db.add(Artefato(projeto_id=body.projeto_id, tipo=body.tipo, conteudo={**data, "_markdown": markdown}))

    if projeto.status == ProjectStatus.validacao:
        projeto.status = ProjectStatus.documentacao

    await db.commit()
    return {"tipo": body.tipo, "conteudo": data, "markdown": markdown, "credits_remaining": current_user.credits, "credits_used": settings.DOCUMENTADOR_CREDIT_COST}


@router.get("/artefatos/{projeto_id}")
async def listar_artefatos(
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
    result = await db.execute(select(Artefato).where(Artefato.projeto_id == projeto_id))
    arts = result.scalars().all()
    return [{"id": a.id, "tipo": a.tipo, "created_at": a.created_at} for a in arts]


@router.get("/artefatos/{projeto_id}/{tipo}/markdown", response_class=PlainTextResponse)
async def download_markdown(
    projeto_id: int,
    tipo: ArtifactType,
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
    result = await db.execute(
        select(Artefato).where(Artefato.projeto_id == projeto_id, Artefato.tipo == tipo)
    )
    art = result.scalar_one_or_none()
    if not art:
        raise HTTPException(status_code=404, detail="Artefato não gerado ainda")
    md = art.conteudo.get("_markdown", "")
    return PlainTextResponse(content=md, media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{tipo.value}-{projeto_id}.md"'})


@router.post("/baseline/{projeto_id}")
async def marcar_baseline(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ProjetoRequisito).where(
            ProjetoRequisito.id == projeto_id,
            ProjetoRequisito.user_id == current_user.id,
        )
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    projeto.status = ProjectStatus.baseline
    await db.commit()
    return {"status": "baseline", "message": "Projeto concluído e documentado"}
