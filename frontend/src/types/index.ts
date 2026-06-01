export type UserRole = "user" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  credits: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  title: string | null;
  created_at: string;
  messages: ChatMessage[];
}

export type ProjectStatus =
  | "iniciacao"
  | "elicitacao"
  | "re_elicitacao"
  | "analise"
  | "validacao"
  | "documentacao"
  | "baseline";

export interface ProjetoRequisito {
  id: number;
  nome: string;
  dominio: string | null;
  contexto_operacional: string | null;
  status: ProjectStatus;
  ciclo_refinamento: number;
  created_at: string;
  updated_at: string;
}

export interface Necessidade {
  id: number;
  descricao: string;
  stakeholder: string | null;
  prioridade: string | null;
  status: "identificada" | "analisada" | "validada";
  created_at: string;
}

export interface Requisito {
  id: number;
  codigo: string;
  descricao: string;
  tipo: string | null;
  prioridade: string | null;
  atributos: Record<string, unknown> | null;
  qualidade: Record<string, unknown> | null;
  score_qualidade: number | null;
  status: "rascunho" | "analisado" | "validado" | "aprovado";
  created_at: string;
}

export interface CreditPackage {
  id: number;
  name: string;
  credits: number;
  price_brl: number;
  is_popular: boolean;
}

export interface AgenteMessageResponse {
  reply: string;
  phase: ProjectStatus;
  context: Record<string, unknown>;
}
