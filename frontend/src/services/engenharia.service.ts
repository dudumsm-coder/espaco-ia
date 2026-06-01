import api from "@/lib/api";
import type { ProjetoRequisito, AgenteMessageResponse } from "@/types";

export const engenhariaService = {
  listarProjetos: () =>
    api.get<ProjetoRequisito[]>("/engenharia/projetos").then((r) => r.data),

  getProjeto: (id: number) =>
    api.get<ProjetoRequisito>(`/engenharia/projetos/${id}`).then((r) => r.data),

  criarProjeto: (data: { nome: string; dominio?: string; contexto_operacional?: string }) =>
    api.post<ProjetoRequisito>("/engenharia/projetos", data).then((r) => r.data),

  avancarFase: (id: number) =>
    api.post(`/engenharia/projetos/${id}/avancar`).then((r) => r.data),

  chatElicitador: (projeto_id: number, content: string) =>
    api.post<AgenteMessageResponse>("/agentes/elicitador/chat", { projeto_id, content }).then((r) => r.data),
};
