# PRD — Refinamento do Sistema Multi-Agente de Engenharia de Requisitos
**Versão:** 1.1 | **Data:** 2026-06-01 | **Status:** Aprovado

## 1. Visão do Produto
Sistema de engenharia de requisitos guiado por IA para usuários de negócio sem background técnico.
O usuário completa um ciclo consultivo com 4 agentes e recebe documentação pronta para entrega a uma equipe de desenvolvimento — transformando necessidade de negócio em projeto aplicável.

## 2. Usuários
| Perfil | Contexto | Necessidade principal |
|--------|----------|----------------------|
| Gestor / Empreendedor | Quer digitalizar um processo ou criar um produto, sem saber como especificar | Transformar ideia em documento técnico sem precisar de consultor externo |
| Analista de Negócios | Precisa documentar requisitos de forma estruturada | Agilizar elicitação e garantir rastreabilidade |

## 3. Funcionalidades — MVP Refinado

### F01 — Elicitador Guiado por Categorias
- **Descrição:** Chat consultivo que percorre 5 categorias obrigatórias, extraindo necessidades estruturadas
- **Categorias:**
  1. Contexto da Necessidade — situação atual que motivou o projeto
  2. Negócio — problema central + impacto se não resolvido
  3. Usuários — quem usa + como resolve hoje (sem o sistema)
  4. Restrições — prazo, orçamento, integrações existentes
  5. Sucesso — métricas e critérios de aceitação do negócio
- **Tom:** Consultivo — como consultor de negócios experiente
- **User Story:** Como gestor, quero ser guiado por perguntas claras para que eu consiga descrever meu projeto sem precisar de vocabulário técnico
- **Critérios de Aceite:**
  - [ ] Cada categoria tem pelo menos 1 necessidade capturada antes de avançar
  - [ ] Linguagem 100% de negócio — zero jargão técnico
  - [ ] Progresso das categorias visível ao usuário
  - [ ] Modo re-elicitação: quando chamado por outro agente, foca na lacuna específica com contexto

### F02 — Comunicação Bidirecional entre Agentes
- **Descrição:** Fluxo não-linear onde Analisador e Validador podem acionar o Elicitador
- **Fluxo:**
  - Analisador detecta lacuna → pausa → explica ao usuário em linguagem de negócio → ativa Elicitador focado → retoma análise com novo contexto
  - Validador detecta lacuna fundamental → visível ao usuário → explica motivo → ativa Elicitador
  - Loop Analisador ↔ Validador por qualidade → background, máx 3 ciclos
- **User Story:** Como usuário, quero ser avisado quando minha resposta gerou dúvidas no sistema, para que eu possa complementar sem perder o contexto
- **Critérios de Aceite:**
  - [ ] Banner de re-elicitação mostra motivo em linguagem de negócio
  - [ ] Elicitador no modo re-elicitação faz perguntas focadas na lacuna
  - [ ] Loop Analisador↔Validador invisível — só resultado final aparece
  - [ ] Máximo 3 re-elicitações externas por projeto

### F03 — Documentação para Entrega a Dev
- **Descrição:** 4 artefatos gerados automaticamente, prontos para abertura de projeto com equipe técnica
- **Artefatos:**
  - SRS (Software Requirements Specification) — spec técnica completa
  - Matriz de Rastreabilidade — necessidade → requisito → critério
  - Árvore de Requisitos — hierarquia para planejamento de sprints
  - ICD (Interface Control Document) — integrações e interfaces externas
- **Exportação:** Markdown (GitHub/docs) + PDF (impressão/envio)
- **User Story:** Como gestor, quero receber um documento completo que minha equipe de dev possa usar diretamente, sem precisar de reuniões extras de alinhamento
- **Critérios de Aceite:**
  - [ ] Linguagem dos artefatos é técnica (para devs), não para o usuário de negócio
  - [ ] Markdown com formatação correta para GitHub
  - [ ] PDF gerado via conversão do Markdown
  - [ ] Todos os artefatos gerados antes de marcar baseline

## 4. Fora do Escopo (MVP)
- Integração direta com Jira/Trello/GitHub Issues
- Colaboração multi-usuário no mesmo projeto
- Versionamento de artefatos
- Exportação para DOCX/Excel

## 5. Estados do Fluxo
```
iniciacao → elicitacao → analise → [re_elicitacao ↔ analise] → validacao → [re_elicitacao] → documentacao → baseline
```
Novo estado: `re_elicitacao` — elicitação adicional acionada por Analisador ou Validador

## 6. Requisitos Não-Funcionais
- **Linguagem:** Elicitador usa linguagem de negócio; Documentador usa linguagem técnica
- **UX:** Progresso das categorias visível; banner claro em re-elicitação
- **Performance:** Análise completa < 30s; cada artefato < 45s
- **Exportação:** Markdown direto; PDF via conversão server-side

## 7. Métricas de Sucesso
| Métrica | Meta 30d | Meta 12m |
|---------|----------|----------|
| Projetos chegando ao baseline | 60% dos iniciados | 75% |
| Re-elicitações por projeto | ≤ 2 em média | ≤ 1 |
| Score de qualidade dos requisitos | ≥ 0.75 | ≥ 0.85 |

## 8. Próximos Passos
- [x] Implementar Elicitador guiado por categorias com tom consultivo
- [x] Implementar fluxo bidirecional (estado `re_elicitacao`)
- [x] Refinar prompts do Analisador e Validador
- [x] Adicionar exportação Markdown dos artefatos
- [ ] Implementar exportação PDF
