from pydantic import BaseModel
from datetime import datetime
from app.models.requisito import ProjectStatus, NecessidadeStatus, RequisitoStatus, ArtifactType


class ProjetoCreate(BaseModel):
    nome: str
    dominio: str | None = None
    contexto_operacional: str | None = None


class ProjetoResponse(BaseModel):
    id: int
    nome: str
    dominio: str | None
    contexto_operacional: str | None
    status: ProjectStatus
    ciclo_refinamento: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NecessidadeResponse(BaseModel):
    id: int
    descricao: str
    stakeholder: str | None
    prioridade: str | None
    status: NecessidadeStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class RequisitoResponse(BaseModel):
    id: int
    codigo: str
    descricao: str
    tipo: str | None
    prioridade: str | None
    atributos: dict | None
    qualidade: dict | None
    score_qualidade: float | None
    tbx_items: list | None
    status: RequisitoStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class ArtefatoResponse(BaseModel):
    id: int
    tipo: ArtifactType
    conteudo: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class AgenteMessageRequest(BaseModel):
    projeto_id: int
    content: str


class AgenteMessageResponse(BaseModel):
    reply: str
    phase: ProjectStatus
    context: dict
