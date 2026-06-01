import api from "@/lib/api";
import type { AgenteMessageResponse } from "@/types";

export const AGENT_COSTS = {
  elicitador: 5,
  analisador: 60,
  validador: 40,
  documentador: 50,
} as const;

export const agentesService = {
  chatElicitador: (projeto_id: number, content: string) =>
    api.post<AgenteMessageResponse>("/agentes/elicitador/chat", { projeto_id, content }).then(r => r.data),

  analisar: (projeto_id: number, feedback = "") =>
    api.post<AgenteMessageResponse>("/agentes/analisador/analisar", { projeto_id, content: feedback }).then(r => r.data),

  validar: (projeto_id: number) =>
    api.post<AgenteMessageResponse>("/agentes/validador/validar", { projeto_id }).then(r => r.data),

  gerarArtefato: (projeto_id: number, tipo: "srs" | "matriz" | "arvore" | "icd") =>
    api.post("/agentes/documentador/gerar", { projeto_id, tipo }).then(r => r.data),

  listarArtefatos: (projeto_id: number) =>
    api.get("/agentes/documentador/artefatos/" + projeto_id).then(r => r.data),

  listarRequisitos: (projeto_id: number) =>
    api.get("/agentes/analisador/requisitos/" + projeto_id).then(r => r.data),

  marcarBaseline: (projeto_id: number) =>
    api.post("/agentes/documentador/baseline/" + projeto_id).then(r => r.data),
};
