# Omnichannel Meta — setup (WhatsApp, Instagram, Messenger)

Guia para conectar contas **reais** de WhatsApp, Instagram DM e Messenger ao Trama.
Os três canais são da Meta e usam a mesma base: um **Meta App** + **Facebook Login
for Business** + **Webhooks** da Graph API.

> Sem nenhuma credencial, a aba **Canais** já funciona em **modo de simulação**
> (contas e mensagens de teste) — útil para validar a caixa de entrada antes de
> ter o app aprovado. Este documento é só para o modo real.

## Visão geral do que a integração faz

- **Recebe** mensagens dos 3 canais num inbox unificado.
- O **login** do dono é via OAuth da Meta (descobre Páginas, contas IG e números WhatsApp).
- O **roteamento** do webhook ao negócio certo usa o id externo da conta
  (`phone_number_id` no WhatsApp, `page_id` no Messenger, `ig_id` no Instagram).
- **Envia** mensagens de texto pela própria plataforma, roteando pelo provedor da
  conexão (Cloud API / Send API da Meta, ou Evolution API) — ver seção 7.
- **Rascunha com IA**: o dono pede uma sugestão de resposta (perfil do negócio +
  histórico da conversa), revisa, edita e envia — ver seção 7.

> Guardrail (LGPD/CDC): o contato é sempre conduzido pelo dono. A IA só sugere o
> rascunho; nada de outreach automatizado em massa.

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

## 4.2 Conectar o WhatsApp — dois caminhos

A tela de **"variação de login"** do Login for Business **não** mostra a opção de
WhatsApp Embedded Signup até o app virar **Tech Provider** (produto WhatsApp +
Verificação do Negócio + Partner Solution / *Solution ID*, ~5 dias de revisão).
Por isso há dois caminhos na aba **Canais → Conexões → WhatsApp**:

### A) Manual (Cloud API clássica) — funciona já, sem Tech Provider
Botão **"Conectar manualmente"**. No painel da Meta em **WhatsApp → Configuração
da API**, copie:
- `phone_number_id`
- `waba_id` (WhatsApp Business Account ID)
- um **token** — gere um **System User** (permanente) em *Business Settings →
  Users → System Users* com acesso à WABA, senão o token de teste expira em 24h.

O Trama valida o número, assina o app na WABA (`subscribed_apps`) e salva a
conexão. ⚠️ Neste modo o número roda **só** na Cloud API — o app WhatsApp Business
no celular daquele número deixa de funcionar (use um número dedicado à API).

### B) Embedded Signup (coexistência) — mantém o app no celular
Botão **"Embedded Signup"** (abre o popup da Meta via SDK JS). Provisiona/seleciona
a WABA e o número, mostra o **QR code** de coexistência e devolve os ids + um
`code`. Requer:
- app aprovado como **Tech Provider** e uma config de **Login for Business** do
  tipo coexistência (a variação **"WhatsApp Embedded Signup"**);
- as variáveis **`NEXT_PUBLIC_META_APP_ID`** e **`NEXT_PUBLIC_META_LOGIN_CONFIG_ID`**
  (mesmos valores das `META_*`), para o SDK no browser.

## 4.3 Alternativa não-oficial: WhatsApp via Evolution API (QR)

Se você não quer (ou ainda não pode) usar a Cloud API/Tech Provider, dá para
conectar o WhatsApp **por QR code** usando a **Evolution API** — um servidor
open-source que mantém a sessão do WhatsApp Web (via Baileys) e expõe REST +
webhook. O Trama continua **100% na Vercel**: só fala REST e recebe o webhook.

> ⚠️ **Não-oficial** — usa o protocolo do WhatsApp Web. Há **risco de banimento**
> do número. Use um **número secundário/dedicado** e evite volume alto / mensagens
> não solicitadas.

### Subir a Evolution API (fora da Vercel)
A Evolution precisa de um processo **sempre ligado** — rode num container seu
(Railway, Render, Fly.io ou VPS). Exemplo com Docker:

```bash
docker run -d --name evolution -p 8080:8080 \
  -e AUTHENTICATION_API_KEY="uma-chave-forte" \
  atendai/evolution-api:latest
```

(Para produção, configure também o banco/persistência conforme a doc da Evolution.)

### Configurar no Trama
No `.env.local` (e na Vercel):
```
EVOLUTION_API_URL=https://sua-evolution.exemplo.com
EVOLUTION_API_KEY=uma-chave-forte         # a mesma AUTHENTICATION_API_KEY
EVOLUTION_WEBHOOK_TOKEN=um-token-qualquer  # validamos no webhook
```

### Parear
Aba **Canais → Conexões → WhatsApp → Conectar via QR**: o Trama cria a instância
na Evolution (já apontando o webhook para `/api/channels/evolution/webhook`),
mostra o **QR code** e faz polling até parear. Abra **WhatsApp → Aparelhos
conectados → Conectar aparelho** e escaneie. Mensagens que você enviar pelo
celular chegam como **saída** no inbox (coexistência natural do WhatsApp Web).

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

## 7. Enviar mensagens e rascunho com IA

Na **Caixa de entrada**, ao abrir uma conversa, o dono tem um campo de resposta
com dois botões:

- **Enviar** — manda o texto pelo provedor da conexão:
  - WhatsApp via **Cloud API** → `POST /{phone_number_id}/messages` (texto livre
    dentro da janela de 24h; **fora dela a Meta exige um template aprovado**, não
    coberto aqui);
  - WhatsApp via **Evolution API** → `POST /message/sendText/{instance}` (não há
    janela de 24h, mas vale o aviso de risco de banimento da seção 4.3);
  - Messenger/Instagram via **Send API** → `POST /{page_id|ig_id}/messages`
    (`messaging_type: RESPONSE`, dentro da janela de atendimento).
- **Rascunhar com IA** — gera uma sugestão de resposta a partir do **Perfil do
  Negócio** + histórico recente da conversa. O texto cai no campo para o dono
  **revisar, editar e enviar**. Se já houver algo digitado, ele vira a orientação
  do rascunho (ex.: "ofereça frete grátis").

A mensagem enviada é gravada como **saída** usando o id devolvido pela plataforma;
quando o mesmo texto volta como *echo* (coexistência), o dedupe evita duplicar a
bolha. Em conexões de **teste**, o envio apenas registra a mensagem (sem chamada
externa), útil para validar a UI.

> **Guardrail:** a IA só rascunha. O envio é sempre uma ação manual do dono — sem
> disparo automatizado em massa, coerente com o agente de prospecção.

## Testar sem Meta (simulação)

Na aba **Canais → Conexões**, clique em **Conta de teste** de qualquer plataforma.
Depois, em **Caixa de entrada → Simular**, injete uma mensagem. Ela percorre o
mesmo caminho do webhook real (normalização → ingest) e aparece no inbox. Em
seguida, escreva uma resposta no campo (ou use **Rascunhar com IA**) e clique em
**Enviar** — em conta de teste a saída é só registrada, exercitando o composer.
