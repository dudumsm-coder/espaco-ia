/**
 * Agent-specific LLM routing
 *
 * - Entrevista, Ideação, Análise → Gemini 2.5 Flash (via Google AI API diretamente,
 *   ou via Forge se GOOGLE_AI_API_KEY não estiver configurada — fallback automático)
 * - Requisitos, Documentação, Prototipagem → Manus Forge (gemini-2.5-flash padrão)
 */

import { ENV } from "./_core/env";
import { invokeLLM, type Message, type InvokeResult } from "./_core/llm";

// Agentes que usam Gemini 2.0 Flash explicitamente
const GEMINI_FLASH_AGENTS = new Set(["entrevista", "ideacao", "analise"]);

// Modelo para cada grupo
const MODEL_GEMINI_FLASH = "gemini-2.5-flash"; // Gemini 2.5 Flash conforme solicitado
const MODEL_MANUS_DEFAULT = "gemini-2.5-flash"; // padrão do Forge

/**
 * Invoca o LLM correto para o agente especificado.
 * Se GOOGLE_AI_API_KEY estiver disponível, chama a API do Google diretamente
 * para os agentes Gemini Flash. Caso contrário, usa o Forge da Manus como fallback.
 */
export async function invokeAgentLLM(
  agentSlug: string,
  messages: Message[]
): Promise<InvokeResult> {
  const useGeminiFlash = GEMINI_FLASH_AGENTS.has(agentSlug);

  if (useGeminiFlash) {
    const googleKey = process.env.GOOGLE_AI_API_KEY;

    if (googleKey) {
      // Chamada direta à API do Google AI (OpenAI-compatible endpoint)
      return invokeGoogleAI(googleKey, MODEL_GEMINI_FLASH, messages);
    }

    // Fallback: usa o Forge da Manus com model hint
    console.log(`[AgentLLM] GOOGLE_AI_API_KEY não configurada. Usando Forge (${MODEL_GEMINI_FLASH}) para agente: ${agentSlug}`);
    return invokeLLM({ messages, max_tokens: 8192 });
  }

  // Agentes padrão: usa Forge da Manus
  return invokeLLM({ messages, max_tokens: 16384 });
}

/**
 * Chama a API do Google AI diretamente (endpoint compatível com OpenAI)
 */
async function invokeGoogleAI(
  apiKey: string,
  model: string,
  messages: Message[]
): Promise<InvokeResult> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  const normalizedMessages = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  const payload = {
    model,
    messages: normalizedMessages,
    max_tokens: 8192,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Fallback para Forge se a API do Google falhar
    console.warn(`[AgentLLM] Google AI falhou (${response.status}): ${errorText}. Usando Forge como fallback.`);
    return invokeLLM({ messages, max_tokens: 8192 });
  }

  const result = await response.json() as InvokeResult;
  return result;
}

/**
 * Retorna o nome do modelo que será usado para um agente
 * (para exibição na UI / logs)
 */
export function getAgentModelName(agentSlug: string): string {
  if (GEMINI_FLASH_AGENTS.has(agentSlug)) {
    return process.env.GOOGLE_AI_API_KEY
      ? "Gemini 2.5 Flash (Google AI)"
      : "Gemini 2.5 Flash (Manus Forge)";
  }
  return "Gemini 2.5 Flash (Manus Forge)";
}
