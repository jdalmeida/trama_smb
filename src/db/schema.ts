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
