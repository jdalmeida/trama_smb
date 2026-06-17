// Tiers de modelo, roteados pelo Vercel AI Gateway.
// No AI SDK 6, uma string "provider/model" é roteada pelo Gateway por padrão.
// Os IDs evoluem rápido — confirme com `gateway.getAvailableModels()` ou no
// dashboard do Gateway. Dá para sobrescrever por env (MODEL_REASONING etc.).
export const MODELS = {
  // Raciocínio / orquestração (CEO) e personas.
  reasoning: "google/gemini-3.5-flash",
  worker: "zai/glm-5.2",
  // Tarefas simples / extração estruturada barata.
  cheap: "openai/gpt-4o-mini",
} as const;

export type ModelTier = keyof typeof MODELS;
