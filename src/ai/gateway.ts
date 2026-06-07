import { MODELS, type ModelTier } from './models';

/**
 * Resolve o ID do modelo (string "provider/model") para um tier.
 * No AI SDK 6 essa string é roteada pelo AI Gateway por padrão.
 * Permite override por variável de ambiente: MODEL_REASONING, MODEL_WORKER, MODEL_CHEAP.
 */
export function modelFor(tier: ModelTier): string {
  const override = process.env[`MODEL_${tier.toUpperCase()}`];
  return override && override.length > 0 ? override : MODELS[tier];
}
