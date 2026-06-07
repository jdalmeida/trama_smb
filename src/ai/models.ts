// Tiers de modelo, roteados pelo Vercel AI Gateway.
// No AI SDK 6, uma string "provider/model" é roteada pelo Gateway por padrão.
// Os IDs evoluem rápido — confirme com `gateway.getAvailableModels()` ou no
// dashboard do Gateway. Dá para sobrescrever por env (MODEL_REASONING etc.).
export const MODELS = {
  // Raciocínio / orquestração (CEO) e personas.
  reasoning: 'anthropic/claude-sonnet-4.5',
  worker: 'anthropic/claude-sonnet-4.5',
  // Tarefas simples / extração estruturada barata.
  cheap: 'google/gemini-3.1-flash-lite',
} as const;

export type ModelTier = keyof typeof MODELS;
