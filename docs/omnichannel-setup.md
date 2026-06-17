# Omnichannel Meta — setup (WhatsApp, Instagram, Messenger)

Guia para conectar contas **reais** de WhatsApp, Instagram DM e Messenger ao Trama.
Os três canais são da Meta e usam a mesma base: um **Meta App** + **Facebook Login
for Business** + **Webhooks** da Graph API.

> Sem nenhuma credencial, a aba **Canais** já funciona em **modo de simulação**
> (contas e mensagens de teste) — útil para validar a caixa de entrada antes de
> ter o app aprovado. Este documento é só para o modo real.

## Visão geral do que esta leva faz

- **Recebe** mensagens dos 3 canais num inbox unificado read-only.
- O **login** do dono é via OAuth da Meta (descobre Páginas, contas IG e números WhatsApp).
- O **roteamento** do webhook ao negócio certo usa o id externo da conta
  (`phone_number_id` no WhatsApp, `page_id` no Messenger, `ig_id` no Instagram).

O **envio** de mensagens e o **rascunho assistido por IA** ficam para as próximas levas.

## 1. Criar o Meta App

1. Acesse <https://developers.facebook.com/apps> → **Criar app** → tipo **Business**.
2. Anote o **App ID** e o **App Secret** (em *Configurações → Básico*).
3. Preencha em `.env.local`:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   META_WEBHOOK_VERIFY_TOKEN=<uma string qualquer, definida por você>
   META_GRAPH_VERSION=v21.0
   META_OAUTH_REDIRECT_BASE=https://SEU_DOMINIO   # em produção
   ```

## 2. Adicionar os produtos

No painel do app, adicione:

- **WhatsApp** → gera um número de teste e uma WABA. Para produção, adicione um
  número verificado.
- **Messenger** → vincule a(s) **Página(s)** do Facebook.
- **Instagram** → conecte a conta **profissional** do Instagram vinculada à Página.

## 3. Configurar o Webhook

Para cada produto (WhatsApp, Messenger, Instagram), configure o webhook:

- **Callback URL:** `https://SEU_DOMINIO/api/channels/webhook`
- **Verify token:** o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN`.
- **Campos (subscriptions):**
  - WhatsApp: `messages` e, para **coexistência**, também `smb_message_echoes`,
    `history` e `smb_app_state_sync` (ver seção abaixo).
  - Messenger: `messages`, `messaging_postbacks`
  - Instagram: `messages`

A verificação (GET) responde o `hub.challenge` automaticamente quando o token bate.
A entrega (POST) é validada por assinatura `x-hub-signature-256` (HMAC com o App Secret).

> A rota `/api/channels/webhook` é **pública** no `proxy.ts` — a Meta chama sem
> sessão de usuário, e o negócio é resolvido pelo id externo da conta.

## 4. Login / permissões (OAuth)

O botão **Conectar** na aba Canais redireciona para o OAuth da Meta. As permissões
pedidas:

- `business_management`, `pages_show_list`, `pages_messaging`
- `instagram_basic`, `instagram_manage_messages`
- `whatsapp_business_management`, `whatsapp_business_messaging`

Para o fluxo de **Embedded Signup** (recomendado para WhatsApp), crie uma
configuração de **Facebook Login for Business** e preencha:
```
META_LOGIN_CONFIG_ID=...
```
Com `config_id`, as permissões vêm da configuração; sem ele, usamos os scopes acima.

Adicione a URL de redirect autorizada em *Facebook Login → Configurações*:
`https://SEU_DOMINIO/api/channels/callback`

## 4.1 Coexistência (WhatsApp) — recomendado para SMB

A **coexistência** (Coexistence / "Coex") permite que o mesmo número rode **ao
mesmo tempo** no app **WhatsApp Business** (celular) e na **Cloud API**. O dono
continua atendendo manualmente pelo app, e o Trama recebe as conversas em
paralelo. É o caminho ideal para pequenos negócios, que não querem largar o app.

**Onboarding:** no Embedded Signup de coexistência, o dono escaneia um **QR code**
com o app WhatsApp Business e autoriza. Pode compartilhar o **histórico** (até ~6
meses de conversas 1:1 e ~2 semanas de mídia), importado automaticamente.

**O que o Trama trata** (já implementado em `src/domain/channels.ts`):

| Webhook (subscription) | O que é | Como aparece no Trama |
| --- | --- | --- |
| `messages` | Mensagens recebidas do cliente | Entrada (bolha à esquerda) |
| `smb_message_echoes` | Mensagens que o dono envia **pelo app do celular** | Saída (bolha à direita) |
| `history` | Conversas anteriores importadas no onboarding | Entrada/saída, sem acender "não lidas" |
| `smb_app_state_sync` | Contatos do app | Enriquecem o nome do interlocutor |

**Pré-requisitos da Meta:**
- Use uma configuração de **Facebook Login for Business / Embedded Signup** do
  tipo **coexistência** (feature de onboarding de usuários do WhatsApp Business
  app) e informe-a em `META_LOGIN_CONFIG_ID`.
- Assine os 4 campos acima no painel do webhook do WhatsApp.
- **Elegibilidade por país:** a coexistência foi liberada gradualmente (UE, Reino
  Unido e outros em nov/2025; os últimos países, como Brasil/África do Sul/Nigéria,
  ao longo de 2026). Confirme a disponibilidade para o número antes de prometer ao cliente.

> O roteamento ao negócio continua pelo `phone_number_id` (em `metadata`), igual
> ao `messages`. Echoes/history idempotentes por `id` da mensagem (dedupe).

## 5. App Review

Para uso fora dos usuários de teste, a Meta exige **App Review** das permissões
acima e (no WhatsApp) número/processo de verificação do negócio. Enquanto estiver
em desenvolvimento, só contas com papel no app (admin/dev/tester) conseguem conectar.

## 6. Banco de dados

As 3 tabelas (`channel_connections`, `channel_conversations`, `channel_messages`)
são aditivas. Aplique com:
```
pnpm db:push
```
(O projeto não usa migrações versionadas — ver o roadmap do CRM.)

## Testar sem Meta (simulação)

Na aba **Canais → Conexões**, clique em **Conta de teste** de qualquer plataforma.
Depois, em **Caixa de entrada → Simular**, injete uma mensagem. Ela percorre o
mesmo caminho do webhook real (normalização → ingest) e aparece no inbox.
