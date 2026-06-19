import { ToolLoopAgent, stepCountIs } from 'ai';
import { modelFor } from '@/src/ai/gateway';
import { buildInstructions } from '@/src/lib/skills';
import { ceoTools, type CeoContext } from './tools';

/**
 * Agente CEO — orquestrador interativo que conversa com o usuário.
 *
 * Usa o tier "reasoning" (decisões/planejamento), instruções vindas do playbook
 * `ceo` e as tools de orquestração (perfil, plano, delegação). O loop de tools
 * é limitado a 16 passos para evitar laços longos numa única resposta.
 */
export function getCeoAgent(ctx: CeoContext): ToolLoopAgent {
  return new ToolLoopAgent({
    model: modelFor('reasoning'),
    instructions: buildInstructions('ceo'),
    tools: ceoTools(ctx),
    stopWhen: stepCountIs(16),
  });
}

/**
 * Modo autônomo do CEO: reage a SINAIS que o atendimento detectou numa conversa
 * com piloto automático. Aqui o CEO NÃO conversa com o dono — ele age. O dono já
 * autorizou ao ligar o piloto, então as travas de "espere aprovação" do playbook
 * de onboarding não se aplicam às ações internas (CRM, pesquisa).
 */
const INSTRUCAO_REATIVA = [
  '## Modo autônomo (reação a sinais do atendimento)',
  '',
  'Você está rodando em segundo plano, sem o dono na conversa. O piloto automático',
  'está atendendo um lead e te repassou sinais. Aja agora, sozinho:',
  '',
  '- As mensagens anteriores desta conversa são as SUAS próprias reações a este mesmo',
  '  lead (sinais que já chegaram e o que você já fez). Leve-as em conta: NÃO repita',
  '  ações já tomadas — não recrie o card que já existe, não redispare a mesma pesquisa.',
  '  Aja só sobre o que MUDOU desde a última reação; se nada mudou, não faça nada.',
  '- Use `consultarCrm` para ver como o funil está montado antes de mexer.',
  '- Se os sinais indicam evolução comercial (interesse de compra, pedido de orçamento,',
  '  agendamento, dados de cadastro), use `delegarAoCrm` com um pedido claro: criar/mover',
  '  o card do lead no funil certo, registrar o contexto e os dados informados. Identifique',
  '  o lead pelo nome/contato que aparece no contexto.',
  '- Se há `mencao_concorrente` ou `oportunidade_mercado` que valha investigar, dispare',
  '  `delegarTarefa` com a persona `pesquisa-mercado` e uma tarefa específica (rodam em',
  '  paralelo). Não dispare pesquisa para algo trivial ou já conhecido.',
  '- Se algo for durável e útil para o time, registre com `salvarNaMemoria`.',
  '- Se nenhum sinal justifica ação, não faça nada.',
  '',
  'NÃO responda o lead (quem fala com ele é o atendimento). NÃO peça aprovação — aja.',
  'Ao terminar, escreva só um resumo curto (1 a 3 linhas) do que você fez, em português.',
].join('\n');

export function getCeoReativoAgent(ctx: CeoContext): ToolLoopAgent {
  return new ToolLoopAgent({
    model: modelFor('reasoning'),
    instructions: buildInstructions('ceo', INSTRUCAO_REATIVA),
    tools: ceoTools(ctx),
    stopWhen: stepCountIs(12),
  });
}
