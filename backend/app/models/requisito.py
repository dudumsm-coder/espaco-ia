from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func, Enum, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class ProjectStatus(str, enum.Enum):
    iniciacao = "iniciacao"
    elicitacao = "elicitacao"
    analise = "analise"
    validacao = "validacao"
    documentacao = "documentacao"
    baseline = "baseline"


class NecessidadeStatus(str, enum.Enum):
    identificada = "identificada"
    analisada = "analisada"
    validada = "validada"


class RequisitoStatus(str, enum.Enum):
    rascunho = "rascunho"
    analisado = "analisado"
    validado = "validado"
    aprovado = "aprovado"


class ArtifactType(str, enum.Enum):
    srs = "srs"
    matriz = "matriz"
    arvore = "arvore"
    icd = "icd"


class ProjetoRequisito(Base):
    __tablename__ = "projetos_requisitos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    nome: Mapped[str] = mapped_column(String(500))
    dominio: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contexto_operacional: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.iniciacao)
    ciclo_refinamento: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    necessidades: Mapped[list["Necessidade"]] = relationship("Necessidade", back_populates="projeto", cascade="all, delete-orphan")
    requisitos: Mapped[list["Requisito"]] = relationship("Requisito", back_populates="projeto", cascade="all, delete-orphan")
    artefatos: Mapped[list["Artefato"]] = relationship("Artefato", back_populates="projeto", cascade="all, delete-orphan")
    sessoes: Mapped[list["SessaoChat"]] = relationship("SessaoChat", back_populates="projeto", cascade="all, delete-orphan")


class Necessidade(Base):
    __tablename__ = "necessidades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projeto_id: Mapped[int] = mapped_column(Integer, ForeignKey("projetos_requisitos.id", ondelete="CASCADE"))
    descricao: Mapped[str] = mapped_column(Text)
    stakeholder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prioridade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[NecessidadeStatus] = mapped_column(Enum(NecessidadeStatus), default=NecessidadeStatus.identificada)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projeto: Mapped[ProjetoRequisito] = relationship("ProjetoRequisito", back_populates="necessidades")


class Requisito(Base):
    __tablename__ = "requisitos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projeto_id: Mapped[int] = mapped_column(Integer, ForeignKey("projetos_requisitos.id", ondelete="CASCADE"))
    codigo: Mapped[str] = mapped_column(String(50))
    descricao: Mapped[str] = mapped_column(Text)
    tipo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prioridade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    atributos: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    qualidade: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score_qualidade: Mapped[float | None] = mapped_column(Float, nullable=True)
    tbx_items: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[RequisitoStatus] = mapped_column(Enum(RequisitoStatus), default=RequisitoStatus.rascunho)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    projeto: Mapped[ProjetoRequisito] = relationship("ProjetoRequisito", back_populates="requisitos")


class Artefato(Base):
    __tablename__ = "artefatos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projeto_id: Mapped[int] = mapped_column(Integer, ForeignKey("projetos_requisitos.id", ondelete="CASCADE"))
    tipo: Mapped[ArtifactType] = mapped_column(Enum(ArtifactType))
    conteudo: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projeto: Mapped[ProjetoRequisito] = relationship("ProjetoRequisito", back_populates="artefatos")


class SessaoChat(Base):
    __tablename__ = "sessoes_chat_agentes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    projeto_id: Mapped[int] = mapped_column(Integer, ForeignKey("projetos_requisitos.id", ondelete="CASCADE"))
    agente: Mapped[str] = mapped_column(String(100))
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    decisoes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    projeto: Mapped[ProjetoRequisito] = relationship("ProjetoRequisito", back_populates="sessoes")
