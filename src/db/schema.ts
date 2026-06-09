import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { UIMessage } from 'ai';
import type { BusinessProfile } from '@/src/domain/business-profile';
import type { DeliverableContent } from '@/src/domain/deliverable';
import type { PersonaId, PersonaStatus } from '@/src/domain/persona';

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
    status: varchar('status', { length: 32 })
      .$type<PersonaStatus>()
      .notNull()
      .default('working'),
    content: jsonb('content').$type<DeliverableContent>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('deliverables_business_idx').on(t.businessId)],
);

/** Histórico do chat com o CEO — uma linha por UIMessage (jsonb completa). */
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(),
    message: jsonb('message').$type<UIMessage>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_messages_business_idx').on(t.businessId)],
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
