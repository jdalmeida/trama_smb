# Trama

App web multi-agente que ajuda **pequenas empresas brasileiras** a encontrar clientes e entender seu mercado.

A interação central é uma conversa com um **agente CEO** que entende o negócio, monta um plano e **delega tarefas a agentes-persona** especializados. O usuário acompanha o time de agentes trabalhando ao vivo.

## Stack

- **Next.js 16** (App Router) — frontend + rotas de servidor.
- **AI SDK 6** (`ai`, `@ai-sdk/react`) — camada de agentes (`ToolLoopAgent` para o CEO).
- **Vercel AI Gateway** — uma chave para vários modelos, com roteamento por tarefa.
- **Vercel Workflows** (`workflow`, `@workflow/ai`) — runs duráveis das personas (`DurableAgent`).
- **Neon Postgres + Drizzle ORM** — Perfil do Negócio e entregáveis.
- **Clerk** — login (e-mail/OAuth).

## Arquitetura (resumo)

- **CEO** = agente de chat interativo em `app/api/chat` (não-durável). Conduz o onboarding,
  extrai o **Perfil do Negócio** (structured output) e propõe/delega tarefas.
- **Personas** = workers **duráveis** rodando como **Vercel Workflows** (`app/workflows`),
  disparados pela tool `delegarTarefa` do CEO. Transmitem status ao vivo para o painel "Time".
- **Skills** = playbooks editáveis em `src/skills/*.md` (frontmatter YAML), carregados em
  runtime para o `instructions` de cada agente.

```
app/            rotas (page, api/chat, api/runs/*), workflows/, steps/, sign-in, sign-up
src/agents/     CEO + personas (definições de agente e tools) + registry
src/skills/     playbooks .md (base de conhecimento por persona)
src/ai/         models + gateway (roteamento de modelo por tier)
src/db/         schema Drizzle + cliente (pg + attachDatabasePool)
src/domain/     schemas zod (Perfil do Negócio, entregáveis, personas)
src/lib/        utilitários (loader de skills)
components/     UI (chat, painel "Time")
```

## Setup

1. **Dependências**
   ```bash
   pnpm install
   ```

2. **Variáveis de ambiente** — copie e preencha:
   ```bash
   cp .env.example .env.local
   ```
   - `AI_GATEWAY_API_KEY` — dashboard da Vercel (AI Gateway).
   - `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — Neon (via Vercel Marketplace).
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk (via Vercel Marketplace).

3. **Banco** (após preencher `DATABASE_URL_UNPOOLED`)
   ```bash
   pnpm db:push      # cria as tabelas (rápido p/ desenvolvimento)
   pnpm db:studio    # inspeciona o banco
   ```

4. **Rodar**
   ```bash
   pnpm dev
   ```

## Scripts

| Script | O quê |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | Build e produção |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:push` | Aplica o schema no banco |
| `pnpm db:generate` / `pnpm db:migrate` | Migrações versionadas |
| `pnpm db:studio` | Drizzle Studio |

## Provisionar serviços (Vercel Marketplace)

Os três serviços têm provisionamento nativo na Vercel:

- **Neon (Postgres)** — Vercel → Storage → Neon. Injeta `DATABASE_URL` (pooled) e
  `DATABASE_URL_UNPOOLED` (direto, usado nas migrações).
- **Clerk (auth)** — Vercel → Integrations → Clerk. Injeta
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
- **AI Gateway** — Vercel → AI → AI Gateway. Em produção o `VERCEL_OIDC_TOKEN` é
  automático; localmente use `AI_GATEWAY_API_KEY` (rode `vercel env pull` para
  sincronizar).

Em produção os Workflows são totalmente gerenciados (Vercel Functions + Queues),
sem configuração extra. Em dev, `pnpm dev` já executa os steps/workflows; use
`npx workflow web` para observar os runs.

## Fluxo de demonstração

1. Faça login (Clerk).
2. No chat, conte sobre o negócio. O **CEO** entrevista e, ao ter o suficiente,
   salva o **Perfil do Negócio** — confirme no card.
3. Peça ajuda (ex.: "quero atrair mais clientes"). O CEO **propõe um plano** e,
   com seu ok, **delega** à persona **Conteúdo & Aquisição**.
4. No painel **Time** (à direita) a persona aparece **trabalhando** ao vivo; ao
   concluir, abra **Ver entregável** (plano de conteúdo e canais).

## Princípios de produto

- Produto em **português brasileiro**.
- Apenas **fontes públicas**; sem coleta de dados privados.
- **Sem outreach automatizado** — o contato com pessoas é sempre do humano (LGPD/CDC).
- Custo controlado via **AI Gateway** (modelo mais barato em tarefas simples).
