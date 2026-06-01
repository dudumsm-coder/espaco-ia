from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.requisito import ProjetoRequisito, Requisito, Necessidade, Artefato, ProjectStatus, ArtifactType
from app.services.llm import invoke_llm_json
from pydantic import BaseModel

router = APIRouter(prefix="/documentador", tags=["agentes"])

SYSTEM_SRS = """Gere um SRS (Software Requirements Specification) completo em JSON:
{
  "titulo": "...", "versao": "1.0", "data": "...",
  "introducao": {"proposito":"...","escopo":"...","definicoes":[]},
  "descricao_geral": {"perspectiva":"...","funcionalidades":[],"restricoes":[]},
  "requisitos_funcionais": [{"id":"...","descricao":"...","prioridade":"...","criterios_aceitacao":[]}],
  "requisitos_nao_funcionais": [{"id":"...","categoria":"...","descricao":"..."}],
  "interfaces_externas": [],
  "restricoes_projeto": []
}"""

SYSTEM_MATRIZ = """Gere uma Matriz de Rastreabilidade de Requisitos em JSON:
{
  "colunas": ["ID","Descrição","Tipo","Prioridade","Stakeholder","Necessidade Origem","Status"],
  "linhas": [["REQ-001","...","funcional","alta","...","NEC-001","validado"]]
}"""

SYSTEM_ARVORE = """Gere uma Árvore de Requisitos hierárquica em JSON:
{
  "nome": "Sistema",
  "filhos": [
    {"nome": "Módulo A", "tipo": "modulo", "filhos": [
      {"nome": "REQ-001: ...", "tipo": "requisito", "prioridade": "alta", "filhos": []}
    ]}
  ]
}"""


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
        select(ProjetoRequisito).where(ProjetoRequisito.id == body.projeto_id, ProjetoRequisito.user_id == current_user.id)
    )
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if projeto.status not in (ProjectStatus.validacao, ProjectStatus.documentacao, ProjectStatus.baseline):
        raise HTTPException(status_code=400, detail="Projeto deve estar em validação ou documentação")

    req_result = await db.execute(select(Requisito).where(Requisito.projeto_id == body.projeto_id))
    requisitos = req_result.scalars().all()
    nec_result = await db.execute(select(Necessidade).where(Necessidade.projeto_id == body.projeto_id))
    necessidades = nec_result.scalars().all()

    req_texto = "\n".join([f"[{r.codigo}] {r.tipo} | {r.prioridade}: {r.descricao}" for r in requisitos])
    nec_texto = "\n".join([f"- {n.descricao} ({n.stakeholder or 'não informado'})" for n in necessidades])
    contexto = f"Projeto: {projeto.nome}\nDomínio: {projeto.dominio or 'não informado'}\nContexto: {projeto.contexto_operacional or ''}\n\nNecessidades:\n{nec_texto}\n\nRequisitos:\n{req_texto}"

    system_map = {
        ArtifactType.srs: SYSTEM_SRS,
        ArtifactType.matriz: SYSTEM_MATRIZ,
        ArtifactType.arvore: SYSTEM_ARVORE,
        ArtifactType.icd: "Gere um ICD (Interface Control Document) em JSON com: {\"interfaces\": [{\"nome\":\"...\",\"tipo\":\"entrada|saída|interna\",\"descricao\":\"...\",\"formato\":\"...\",\"protocolo\":\"...\"}]}",
    }

    data = await invoke_llm_json(
        messages=[{"role": "user", "content": contexto}],
        system=system_map[body.tipo],
        max_tokens=16384,
    )

    art_result = await db.execute(
        select(Artefato).where(Artefato.projeto_id == body.projeto_id, Artefato.tipo == body.tipo)
    )
    existing = art_result.scalar_one_or_none()
    if existing:
        existing.conteudo = data
    else:
        artefato = Artefato(projeto_id=body.projeto_id, tipo=body.tipo, conteudo=data)
        db.add(artefato)

    if projeto.status == ProjectStatus.validacao:
        projeto.status = ProjectStatus.documentacao

    await db.commit()
    return {"tipo": body.tipo, "conteudo": data}


@router.get("/artefatos/{projeto_id}")
async def listar_artefatos(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    proj = await db.execute(select(ProjetoRequisito).where(ProjetoRequisito.id == projeto_id, ProjetoRequisito.user_id == current_user.id))
    if not proj.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    result = await db.execute(select(Artefato).where(Artefato.projeto_id == projeto_id))
    return list(result.scalars().all())


@router.post("/baseline/{projeto_id}")
async def marcar_baseline(
    projeto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(ProjetoRequisito).where(ProjetoRequisito.id == projeto_id, ProjetoRequisito.user_id == current_user.id))
    projeto = result.scalar_one_or_none()
    if not projeto:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    projeto.status = ProjectStatus.baseline
    await db.commit()
    return {"status": "baseline", "message": "Projeto marcado como baseline"}
