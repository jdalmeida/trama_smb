import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import type { BusinessProfile } from '@/src/domain/business-profile';
import type { DeliverableContent } from '@/src/domain/deliverable';
import type { PersonaId, PersonaStatus } from '@/src/domain/persona';
import type {
  CrmFieldEntity,
  CrmFieldType,
  CrmStageTipo,
  CrmValores,
} from '@/src/domain/crm';
import type {
  CrmAcao,
  CrmAutomationRunStatus,
  CrmCondicao,
  CrmTrigger,
} from '@/src/domain/crm-automation';
import type { CrmActivityTipo } from '@/src/domain/crm-activity';
import type {
  ChannelAnexo,
  ChannelConnectionStatus,
  ChannelPlatform,
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  MessageType,
} from '@/src/domain/channels';
import type {
  LeadSignalPrioridade,
  LeadSignalStatus,
  LeadSignalTipo,
} from '@/src/domain/channel-autopilot';
import type {
  SocialPostOrigin,
  SocialPostResult,
  SocialPostStatus,
  SocialPostTarget,
} from '@/src/domain/social-posts';

/** Um negócio pertence a um usuário do Clerk (escopo de tenancy do MVP). */
export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: text('owner_user_id').notNull(),
    nome: text('nome'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('businesses_owner_idx').on(t.ownerUserId)],
);

/** Perfil do Negócio estruturado (jsonb) extraído pelo CEO. */
export const businessProfiles = pgTable(
  'business_profiles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    profile: jsonb('profile').$type<BusinessProfile>().notNull(),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('business_profiles_business_idx').on(t.businessId)],
);

/** Entregável produzido por uma persona. */
export const deliverables = pgTable(
  'deliverables',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    personaId: varchar('persona_id', { length: 64 }).$type<PersonaId>().notNull(),
    titulo: text('titulo').notNull(),
    /** Tarefa em linguagem natural que originou o entregável — usada p/ retomar. */
    tarefa: text('tarefa'),
    status: varchar('status', { length: 32 })
      .$type<PersonaStatus>()
      .notNull()
      .default('working'),
    /**
     * Checkpoint: rascunho do agente já gerado. Se um run falha após produzir o
     * rascunho mas antes de estruturar o entregável, a retomada reaproveita
     * este texto em vez de regenerar com o LLM.
     */
    rascunho: text('rascunho'),
    content: jsonb('content').$type<DeliverableContent>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deliverables_business_idx').on(t.businessId)],
);

/**
 * Uma conversa com o CEO. O chat deixou de ser um fio único e contínuo: o
 * usuário cria várias conversas e navega entre elas, e cada uma carrega só o
 * seu próprio histórico (o "contexto necessário"). A memória da empresa
 * (artifacts/perfil/entregáveis) continua compartilhada entre todas.
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** Título curto, derivado da 1ª mensagem do usuário (ou renomeado por ele). */
    titulo: text('titulo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('conversations_business_idx').on(t.businessId)],
);

/** Histórico do chat com o CEO — uma linha por UIMessage (jsonb completa). */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /**
     * Conversa a que a mensagem pertence. Nullable por compatibilidade com
     * linhas antigas (pré-conversas); a aplicação sempre grava com valor.
     */
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    role: varchar('role', { length: 16 }).notNull(),
    message: jsonb('message').$type<UIMessage>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chat_messages_business_idx').on(t.businessId),
    index('chat_messages_conversation_idx').on(t.conversationId),
  ],
);

/** Categorias de artefato na memória da empresa. */
export type ArtifactCategoria =
  | 'nota'
  | 'pesquisa'
  | 'decisao'
  | 'referencia';

/** Quem criou o artefato: o CEO, uma persona ou o próprio dono. */
export type ArtifactAutor = 'ceo' | 'usuario' | PersonaId;

/**
 * Repositório de artefatos — a "memória da empresa". Guarda contexto durável
 * (notas, achados de pesquisa, decisões, referências) que o CEO e as personas
 * consultam antes de trabalhar e alimentam ao concluir, para que cada run
 * aproveite o que já foi aprendido sobre o negócio.
 */
export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    autor: varchar('autor', { length: 64 }).$type<ArtifactAutor>().notNull(),
    titulo: text('titulo').notNull(),
    categoria: varchar('categoria', { length: 32 })
      .$type<ArtifactCategoria>()
      .notNull()
      .default('nota'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    conteudo: text('conteudo').notNull(),
    /** runId do Workflow que originou o artefato, quando veio de uma persona. */
    runId: text('run_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('artifacts_business_idx').on(t.businessId)],
);

/** Mapeia um run de Workflow (durável) à persona/entregável, p/ reconectar streams. */
export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    personaId: varchar('persona_id', { length: 64 }).$type<PersonaId>().notNull(),
    runId: text('run_id').notNull(),
    status: varchar('status', { length: 32 })
      .$type<PersonaStatus>()
      .notNull()
      .default('working'),
    deliverableId: uuid('deliverable_id').references(() => deliverables.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('runs_business_idx').on(t.businessId),
    index('runs_run_idx').on(t.runId),
  ],
);

/* ================================================================== *
 * CRM data-driven
 *
 * O dono molda o CRM conforme o negócio: vários funis (pipelines), com seus
 * pontos do funil (stages) e os CAMPOS dos cards/contatos definidos por ele
 * (crm_fields). Os valores desses campos ficam em `jsonb` (coluna `valores`),
 * validados contra as definições em src/domain/crm.ts. Tudo escopado por
 * businessId (mesmo tenancy do resto do app).
 * ================================================================== */

/** Funil (pipeline). Um negócio pode ter vários (ex.: Vendas, Pós-venda). */
export const crmPipelines = pgTable(
  'crm_pipelines',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    descricao: text('descricao'),
    ordem: integer('ordem').notNull().default(0),
    arquivado: boolean('arquivado').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_pipelines_business_idx').on(t.businessId)],
);

/** Ponto do funil (coluna do kanban). Ordenável dentro do pipeline. */
export const crmStages = pgTable(
  'crm_stages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => crmPipelines.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    cor: varchar('cor', { length: 24 }).notNull().default('#64748b'),
    tipo: varchar('tipo', { length: 16 })
      .$type<CrmStageTipo>()
      .notNull()
      .default('aberto'),
    ordem: integer('ordem').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_stages_pipeline_idx').on(t.pipelineId)],
);

/**
 * Definição de um campo customizável (o "data-driven"). Pertence a cards ou
 * contatos. Para cards, `pipelineId` pode restringir o campo a um funil
 * específico; null = vale para os cards de todos os funis.
 */
export const crmFields = pgTable(
  'crm_fields',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    entidade: varchar('entidade', { length: 16 })
      .$type<CrmFieldEntity>()
      .notNull(),
    pipelineId: uuid('pipeline_id').references(() => crmPipelines.id, {
      onDelete: 'cascade',
    }),
    chave: varchar('chave', { length: 48 }).notNull(),
    rotulo: text('rotulo').notNull(),
    tipo: varchar('tipo', { length: 16 }).$type<CrmFieldType>().notNull(),
    opcoes: jsonb('opcoes').$type<string[]>().notNull().default([]),
    obrigatorio: boolean('obrigatorio').notNull().default(false),
    ordem: integer('ordem').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_fields_business_idx').on(t.businessId),
    index('crm_fields_pipeline_idx').on(t.pipelineId),
  ],
);

/** Cadastro de contato/empresa (data-driven, reutilizável entre funis). */
export const crmContacts = pgTable(
  'crm_contacts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    valores: jsonb('valores').$type<CrmValores>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('crm_contacts_business_idx').on(t.businessId)],
);

/**
 * Card (negócio/lead) num ponto do funil. Referencia (opcionalmente) um
 * contato reutilizável. Os valores dos campos customizados ficam em `valores`.
 *
 * FK de stage é NO ACTION de propósito: apagar um stage com cards é barrado —
 * a lib reatribui os cards antes (evita perda acidental). Apagar o pipeline
 * cascateia tudo.
 */
export const crmCards = pgTable(
  'crm_cards',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => crmPipelines.id, { onDelete: 'cascade' }),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => crmStages.id),
    contatoId: uuid('contato_id').references(() => crmContacts.id, {
      onDelete: 'set null',
    }),
    titulo: text('titulo').notNull(),
    valores: jsonb('valores').$type<CrmValores>().notNull().default({}),
    ordem: integer('ordem').notNull().default(0),
    /** Quando o card entrou no ponto atual — base do gatilho temporal "parado há N dias". */
    stageChangedAt: timestamp('stage_changed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_cards_business_idx').on(t.businessId),
    index('crm_cards_pipeline_idx').on(t.pipelineId),
    index('crm_cards_stage_idx').on(t.stageId),
  ],
);

/**
 * Automação do CRM (Leva 2): regra "gatilho → condições → ações" do dono,
 * por funil. Configurável via UI ou pelo agente. Gatilhos/condições/ações em
 * `jsonb`, avaliados pelo motor em src/lib/crm-automation.ts.
 */
export const crmAutomations = pgTable(
  'crm_automations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => crmPipelines.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    trigger: varchar('trigger', { length: 32 }).$type<CrmTrigger>().notNull(),
    /** Só para `card_movido`: ponto de entrada que dispara; null = qualquer. */
    triggerStageId: uuid('trigger_stage_id').references(() => crmStages.id, {
      onDelete: 'cascade',
    }),
    /** Só para `card_parado`: nº de dias parado no ponto que dispara. */
    triggerDias: integer('trigger_dias'),
    condicoes: jsonb('condicoes').$type<CrmCondicao[]>().notNull().default([]),
    acoes: jsonb('acoes').$type<CrmAcao[]>().notNull().default([]),
    ordem: integer('ordem').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_automations_business_idx').on(t.businessId),
    index('crm_automations_pipeline_idx').on(t.pipelineId),
  ],
);

/** Histórico de execução das automações — uma linha por disparo efetivado. */
export const crmAutomationRuns = pgTable(
  'crm_automation_runs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    automationId: uuid('automation_id').references(() => crmAutomations.id, {
      onDelete: 'set null',
    }),
    cardId: uuid('card_id').references(() => crmCards.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 16 })
      .$type<CrmAutomationRunStatus>()
      .notNull(),
    mensagem: text('mensagem').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_automation_runs_business_idx').on(t.businessId),
    index('crm_automation_runs_automation_idx').on(t.automationId),
  ],
);

/**
 * Atividade da agenda (Leva 3): tarefa, follow-up, ligação, reunião. Pode estar
 * ligada a um card e/ou contato (ambos somem do vínculo se forem apagados, mas
 * a atividade permanece). Alimenta a visão de agenda/calendário.
 */
export const crmActivities = pgTable(
  'crm_activities',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id').references(() => crmCards.id, { onDelete: 'set null' }),
    contatoId: uuid('contato_id').references(() => crmContacts.id, {
      onDelete: 'set null',
    }),
    tipo: varchar('tipo', { length: 16 }).$type<CrmActivityTipo>().notNull(),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    inicioEm: timestamp('inicio_em', { withTimezone: true }).notNull(),
    fimEm: timestamp('fim_em', { withTimezone: true }),
    diaInteiro: boolean('dia_inteiro').notNull().default(false),
    concluida: boolean('concluida').notNull().default(false),
    concluidaEm: timestamp('concluida_em', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('crm_activities_business_idx').on(t.businessId),
    index('crm_activities_card_idx').on(t.cardId),
    index('crm_activities_inicio_idx').on(t.inicioEm),
  ],
);

/* ================================================================== *
 * Omnichannel (Meta: WhatsApp, Instagram DM, Messenger)
 *
 * Leva 1 (fundação): o dono conecta suas contas e o app RECEBE as conversas
 * num inbox unificado read-only. Tudo escopado por businessId (mesmo tenancy).
 * Envio e disparo assistido por IA ficam para as próximas levas.
 * ================================================================== */

/**
 * Conta conectada de uma plataforma. Para WhatsApp Cloud API a unidade é um
 * número (phone_number_id dentro de uma WABA); para Messenger é uma Página
 * (page_id) e para Instagram a conta profissional vinculada (ig_id). O
 * `externalId` é a chave que o webhook usa para rotear o evento de volta ao
 * negócio certo, por isso é indexado junto da plataforma.
 */
export const channelConnections = pgTable(
  'channel_connections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 16 }).$type<ChannelPlatform>().notNull(),
    status: varchar('status', { length: 16 })
      .$type<ChannelConnectionStatus>()
      .notNull()
      .default('conectado'),
    /** Nome amigável: número do WhatsApp, nome da Página ou @ do Instagram. */
    nomeExibicao: text('nome_exibicao').notNull(),
    /** phone_number_id (WhatsApp) | page_id (Messenger) | ig_id (Instagram). */
    externalId: text('external_id').notNull(),
    /** Token de acesso da Meta para esta conta. */
    accessToken: text('access_token'),
    tokenExpiraEm: timestamp('token_expira_em', { withTimezone: true }),
    /** Dados extras da Meta (waba_id, business id, scopes, etc.). */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    /** Conexão criada pelo modo de simulação (sem Meta real). */
    simulada: boolean('simulada').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('channel_connections_business_idx').on(t.businessId),
    // Roteamento do webhook: acha a conexão por (plataforma, id externo).
    index('channel_connections_external_idx').on(t.platform, t.externalId),
  ],
);

/**
 * Conversa (thread) com um interlocutor externo numa conexão. `externalUserId`
 * é o telefone E.164 (WhatsApp), PSID (Messenger) ou IGSID (Instagram). Pode
 * ser vinculada (opcionalmente) a um contato/card do CRM.
 */
export const channelConversations = pgTable(
  'channel_conversations',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => channelConnections.id, { onDelete: 'cascade' }),
    /** Denormalizado da conexão para facilitar a montagem do inbox. */
    platform: varchar('platform', { length: 16 }).$type<ChannelPlatform>().notNull(),
    externalUserId: text('external_user_id').notNull(),
    nomeContato: text('nome_contato'),
    contatoId: uuid('contato_id').references(() => crmContacts.id, {
      onDelete: 'set null',
    }),
    cardId: uuid('card_id').references(() => crmCards.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 16 })
      .$type<ConversationStatus>()
      .notNull()
      .default('aberta'),
    naoLidas: integer('nao_lidas').notNull().default(0),
    ultimaPrevia: text('ultima_previa'),
    ultimaMensagemEm: timestamp('ultima_mensagem_em', { withTimezone: true }),
    /**
     * Piloto automático: quando true, o agente de atendimento responde o lead
     * sozinho e manda sinais ao CEO. Só pode ser ligado depois que o dono já
     * iniciou a conversa (guardrail) — ver src/lib/channel-autopilot.ts.
     */
    autopilot: boolean('autopilot').notNull().default(false),
    /** Diretriz do dono para o piloto (tom, limites, objetivo). */
    autopilotInstrucao: text('autopilot_instrucao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('channel_conversations_business_idx').on(t.businessId),
    index('channel_conversations_connection_idx').on(t.connectionId),
    index('channel_conversations_ultima_idx').on(t.ultimaMensagemEm),
    // Dedupe de thread: uma conversa por interlocutor dentro de uma conexão.
    index('channel_conversations_dedupe_idx').on(t.connectionId, t.externalUserId),
  ],
);

/**
 * Mensagem de uma conversa. `direction` separa o que o lead mandou (entrada) do
 * que o dono enviar (saida, próxima leva). `externalMessageId` é o id da
 * mensagem na plataforma — usado para ignorar reentregas do webhook (dedupe
 * idempotente).
 */
export const channelMessages = pgTable(
  'channel_messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => channelConversations.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 8 })
      .$type<MessageDirection>()
      .notNull(),
    tipo: varchar('tipo', { length: 16 }).$type<MessageType>().notNull().default('texto'),
    texto: text('texto'),
    anexos: jsonb('anexos').$type<ChannelAnexo[]>().notNull().default([]),
    /** Só para mensagens de saída (preparado para a próxima leva). */
    status: varchar('status', { length: 16 }).$type<MessageStatus>(),
    /**
     * Saída gerada e enviada pelo piloto automático (não pelo dono). Marca a
     * bolha como "respondida pela IA" no inbox — transparência do guardrail.
     */
    automatica: boolean('automatica').notNull().default(false),
    /** Id da mensagem na plataforma — dedupe de reentregas do webhook. */
    externalMessageId: text('external_message_id'),
    enviadaEm: timestamp('enviada_em', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('channel_messages_business_idx').on(t.businessId),
    index('channel_messages_conversation_idx').on(t.conversationId),
    index('channel_messages_external_idx').on(t.externalMessageId),
  ],
);

/**
 * Sinal extraído pelo agente de atendimento numa conversa com piloto automático.
 * É a "mensagem" que o atendimento manda ao CEO: cada linha descreve algo que o
 * lead sinalizou (interesse, pedido de orçamento, objeção, menção a concorrente)
 * e carrega o que o CEO fez ao reagir (`acaoCeo`). Alimenta o painel de sinais
 * do inbox e fecha o loop entre os subsistemas (atendimento → CEO → CRM/pesquisa).
 */
export const channelSignals = pgTable(
  'channel_signals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => channelConversations.id, { onDelete: 'cascade' }),
    /** Mensagem do lead que originou o sinal (quando aplicável). */
    messageId: uuid('message_id').references(() => channelMessages.id, {
      onDelete: 'set null',
    }),
    tipo: varchar('tipo', { length: 32 }).$type<LeadSignalTipo>().notNull(),
    resumo: text('resumo').notNull(),
    prioridade: varchar('prioridade', { length: 8 })
      .$type<LeadSignalPrioridade>()
      .notNull()
      .default('media'),
    status: varchar('status', { length: 16 })
      .$type<LeadSignalStatus>()
      .notNull()
      .default('novo'),
    /** Resumo do que o CEO fez ao reagir (mexer no CRM, disparar pesquisa...). */
    acaoCeo: text('acao_ceo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processadoEm: timestamp('processado_em', { withTimezone: true }),
  },
  (t) => [
    index('channel_signals_business_idx').on(t.businessId),
    index('channel_signals_conversation_idx').on(t.conversationId),
    index('channel_signals_status_idx').on(t.status),
  ],
);

/**
 * Conversa (durável) do CEO em modo autônomo SOBRE um lead — uma "thread" por
 * conversa do canal. Antes o CEO reagia a cada rodada de sinais sem memória do
 * que já tinha feito (e podia repetir a mesma decisão). Agora cada reação é um
 * turno aqui: a linha `user` traz os sinais que o atendimento repassou e a linha
 * `assistant` traz o resumo do que o CEO decidiu/executou. Ao reagir de novo, o
 * CEO lê esta thread e vê o que já fez e como os sinais evoluíram. Alimenta o
 * painel "Conversa do CEO" no inbox. Escopada por businessId.
 */
export const channelCeoMessages = pgTable(
  'channel_ceo_messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => channelConversations.id, { onDelete: 'cascade' }),
    /** 'user' = sinais repassados pelo atendimento; 'assistant' = decisão do CEO. */
    role: varchar('role', { length: 16 }).$type<'user' | 'assistant'>().notNull(),
    conteudo: text('conteudo').notNull(),
    /** Sinais que este turno cobriu (rastreio; preenchido nas linhas 'user'). */
    signalIds: jsonb('signal_ids').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('channel_ceo_messages_conversation_idx').on(t.conversationId),
  ],
);

/* ================================================================== *
 * Publicações sociais (posts no feed do Facebook / Instagram)
 *
 * Leva 3: a persona de Conteúdo & Aquisição (ou o dono) rascunha um post; ele
 * entra na fila como 'rascunho' e só vai para a rede quando o dono revisa,
 * escolhe as redes e APROVA. A IA nunca publica sozinha (guardrail). A
 * publicação reusa as channel_connections: a conexão `messenger` representa a
 * Página do Facebook e a `instagram` a conta profissional vinculada — daí os
 * resultados/alvos guardarem 'facebook'/'instagram'.
 * ================================================================== */
export const socialPosts = pgTable(
  'social_posts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 })
      .$type<SocialPostStatus>()
      .notNull()
      .default('rascunho'),
    origem: varchar('origem', { length: 16 })
      .$type<SocialPostOrigin>()
      .notNull()
      .default('manual'),
    /** Legenda/copy do post. */
    texto: text('texto').notNull(),
    /** URL pública da imagem (obrigatória para publicar no Instagram). */
    imageUrl: text('image_url'),
    /** Redes-alvo escolhidas pelo dono. */
    alvos: jsonb('alvos').$type<SocialPostTarget[]>().notNull().default([]),
    /** Resultado da publicação por rede (id externo, permalink, erro). */
    resultados: jsonb('resultados').$type<SocialPostResult[]>().notNull().default([]),
    /** Canal sugerido pela IA (ex.: "Instagram") — só orientação. */
    canalSugerido: text('canal_sugerido'),
    /** Origem opcional do rascunho: deliverableId/runId da persona. */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    publicadoEm: timestamp('publicado_em', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('social_posts_business_idx').on(t.businessId)],
);
