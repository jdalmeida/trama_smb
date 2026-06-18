---
name: Trama
description: Um time de agentes de IA para pequenas empresas brasileiras crescerem — console claro, marca que se entrelaça.
colors:
  primary: "oklch(0.491 0.27 292.58)"
  primary-dark: "oklch(0.702 0.183 293.54)"
  brand-soft: "oklch(0.943 0.029 294.59)"
  ink: "oklch(0.216 0.006 56.04)"
  canvas: "oklch(0.985 0.002 106.42)"
  surface: "oklch(1 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-ink: "oklch(0.556 0 0)"
  border: "oklch(0.923 0.003 48.72)"
  ring: "oklch(0.606 0.25 292.72)"
  destructive: "oklch(0.577 0.245 27.325)"
  persona-conteudo: "#fbbf77"
  persona-mercado: "#7cc4ff"
  persona-prospeccao: "#86efac"
  persona-conteudo-ink: "oklch(0.565 0.13 65)"
  persona-mercado-ink: "oklch(0.555 0.15 252)"
  persona-prospeccao-ink: "oklch(0.53 0.125 158)"
  landing-night: "#0c0a12"
  landing-violet: "#8b5cf6"
  landing-magenta: "#e879f9"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.625rem, 5.6vw, 4.25rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  card: "16px"
  card-sm: "12px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "oklch(0.491 0.27 292.58 / 0.8)"
    textColor: "{colors.surface}"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    height: "20px"
    padding: "2px 8px"
  tabs-trigger-active:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Design System: Trama

## 1. Overview

**Creative North Star: "A Mesa do Sócio"**

O Trama é a mesa de trabalho de um sócio experiente que torce por você. Nada na tela intimida, nada exige manual; você senta, conversa em português comum e o trabalho aparece resolvido. O sistema visual existe para **sumir** — o protagonista é o negócio do usuário e o time de agentes trabalhando à vista, não a interface. Tudo é claro, plano e arejado, com a personalidade carregada pela tipografia, pelo espaço e por um único roxo que só aparece onde há ação.

Há duas superfícies com personalidades deliberadamente diferentes. O **console** (o produto, onde o trabalho acontece) é luz, calma e precisão: fundo quase-branco, branco puro nos cards, aros finos no lugar de sombras, roxo reservado. A **landing** (a marca, onde a história é contada) é a hora de respirar fundo: noite roxo-profunda, fios em órbita, brilhos sutis — a metáfora têxtil da "trama" tornada visível, sem nunca virar mais-um-SaaS-de-IA.

Este sistema rejeita explicitamente quatro coisas: o **dashboard corporativo frio** (denso, cinza, intimidador), o **SaaS de IA genérico** (roxo-gradiente clichê, hero-metric template, grids de cards idênticos), a **ferramenta técnica de jargão** (nada de "agente", "workflow" ou "token" exposto ao usuário) e o **infantil/fofo demais** (excesso de mascotes e pastel que mina a credibilidade). O calor vem do tom e da clareza, nunca de decoração lúdica.

**Key Characteristics:**
- Plano por padrão: aros de 1px (hairline) carregam separação, não sombras.
- Um roxo só, usado com parcimônia — ação, foco e marca; nunca preenchimento decorativo.
- Tipografia única (Geist) em pesos variados faz toda a hierarquia; mono (Geist Mono) só em detalhes técnicos.
- Cor é código semântico (personas âmbar/azul/verde), nunca o único sinal.
- Console = luz e calma; landing = noite e brilho. Mesma marca, dois registros.

## 2. Colors

Uma paleta neutra-quente e silenciosa no produto, acesa por um único roxo elétrico; a marca leva esse mesmo roxo para um céu noturno.

### Primary
- **Violeta Trama** (`oklch(0.491 0.27 292.58)`): o roxo elétrico da marca. Botões primários, foco, links, badges de ação e o núcleo "CEO". É a única cor saturada do console — sua raridade é o que lhe dá força. No modo escuro clareia para **Violeta Noturno** (`oklch(0.702 0.183 293.54)`) para manter contraste.
- **Lilás Suave** (`oklch(0.943 0.029 294.59)`): fundo de realce do roxo (chips, áreas de destaque leve). Token legado `--color-brand-soft`; usar com moderação.

### Neutral
- **Tinta Quente** (`oklch(0.216 0.006 56.04)`): texto principal e ícones. Quase-preto com um toque quente, nunca preto puro.
- **Quase-Branco** (`oklch(0.985 0.002 106.42)`): o canvas do app. Off-white pouquíssimo quente — base calma que faz o branco dos cards destacar.
- **Branco Puro** (`oklch(1 0 0)`): superfície de cards, popovers e abas ativas. A camada que "flutua" sobre o canvas.
- **Cinza Névoa** (`oklch(0.97 0 0)`): fundos secundários, muted, accent e trilhos de abas.
- **Cinza Médio** (`oklch(0.556 0 0)`): texto secundário e placeholders. **Atenção de contraste** — ver Do's & Don'ts.
- **Cinza Aro** (`oklch(0.923 0.003 48.72)`): bordas e inputs. O hairline que substitui a sombra.

### Tertiary — Cores das Personas
Código de cor das personas e de status ao vivo. **Sempre acompanhadas de ícone e rótulo** — nunca o único sinal. Cada persona tem dois valores: o **tom claro** (pastel, para os brilhos e fios da landing escura) e o **tom de produto** (`-ink`, escurecido para ≥4.5:1 em superfície clara — usado no selo do ícone, na bolinha de lista e em qualquer rótulo). No console, o selo do ícone é o `-ink` a 12% de fundo com o glifo na cor cheia (`bg-persona-*/12 text-persona-*`).
- **Âmbar Conteúdo** (landing `#fbbf77` · produto `oklch(0.565 0.13 65)`): persona Conteúdo & Aquisição.
- **Azul Mercado** (landing `#7cc4ff` · produto `oklch(0.555 0.15 252)`): persona Pesquisa de Mercado.
- **Verde Prospecção** (landing `#86efac` · produto `oklch(0.53 0.125 158)`): persona Vendas / Prospecção.

No modo escuro o `-ink` clareia (Conteúdo `oklch(0.82 0.13 70)`, Mercado `oklch(0.78 0.135 250)`, Prospecção `oklch(0.82 0.15 155)`) para destacar sobre o card escuro. **Status** segue à parte: trabalhando ao vivo = Violeta Trama (o roxo marca trabalho acontecendo agora), concluído = verde-esmeralda, erro = Vermelho Alerta, parado = cinza.

### Marca (landing, modo escuro)
- **Noite Trama** (`#0c0a12`): fundo da landing, quase-preto roxeado.
- **Violeta Marca** (`#8b5cf6`) e **Magenta Sinal** (`#e879f9`): brilhos, fios e pontos de sinal sobre a noite.

### Feedback
- **Vermelho Alerta** (`oklch(0.577 0.245 27.325)`): erros e ações destrutivas. Sempre em superfície tonal suave (`destructive/10`), texto em vermelho — nunca um bloco vermelho sólido.

### Named Rules
**A Regra do Roxo Raro.** O Violeta Trama ocupa ≤10% de qualquer tela do console. Ele marca ação e foco; quando aparece em tudo, deixa de significar algo. Calor e interesse vêm dos neutros e do espaço, não de pintar a tela de roxo.

**A Regra do Sinal Duplo.** Toda cor que comunica estado (persona, status, sucesso/erro) vem com ícone e/ou rótulo. Cor é reforço, nunca o único portador da informação.

## 3. Typography

**Display Font:** Geist (com `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Geist (mesma família, pesos menores)
**Label/Mono Font:** Geist Mono (com `ui-monospace, monospace`)

**Character:** Uma família só, Geist — sans geométrica-humanista, neutra e legível, que parece competente sem ser fria. A hierarquia nasce de peso, tamanho e espaço, não de misturar fontes. Geist Mono entra apenas em detalhes técnicos (rótulos de estado, trechos de código no chat), dando um tempero "ferramenta de verdade" sem jargão visual.

### Hierarchy
- **Display** (800, `clamp(2.625rem, 5.6vw, 4.25rem)`, lh 1, ls -0.045em): só o herói da landing. Teto em ~68px; `text-wrap: balance`.
- **Headline** (600, `clamp(1.5rem, 3vw, 2rem)`, lh 1.15): títulos de seção e de painéis.
- **Title** (500, `1rem`, lh 1.35): títulos de card e cabeçalhos de bloco no console.
- **Body** (400, `0.875rem`, lh 1.55): texto-base do app (14px). Em prosa longa, manter 65–75ch.
- **Label** (Geist Mono, 500, `0.75rem`, ls 0.04em): rótulos técnicos curtos, status, metadados.

### Named Rules
**A Regra da Família Única.** Toda hierarquia sai de Geist em pesos diferentes. Não introduzir uma segunda fonte sans "parecida"; se precisar de contraste, use peso ou tamanho, ou Geist Mono para o registro técnico.

**A Regra do Aperto Controlado.** Letter-spacing de display nunca abaixo de -0.045em (o piso atual). Apertar mais faz as letras se tocarem — cramped, não "designed".

## 4. Elevation

O sistema é **plano por padrão**. A profundidade no console vem de **camadas tonais** (canvas quase-branco → card branco puro → muted cinza) e de **aros de 1px**, não de sombras. Cards usam `ring-1` em `foreground/10` — uma linha de cabelo, não uma sombra projetada. A sombra só aparece como **resposta a estado**: a aba ativa ganha um `shadow-sm` discreto para se destacar do trilho. A landing é a exceção deliberada: ali, brilhos (`box-shadow` largos e difusos em roxo) e `backdrop-filter` criam o céu noturno da marca — recursos reservados a essa superfície.

### Shadow Vocabulary
- **Aro hairline** (`box-shadow`/`ring: 0 0 0 1px oklch(0.216 0.006 56.04 / 0.1)`): separação de cards e superfícies no console. O padrão.
- **Elevação de estado** (`shadow-sm`): aba/segmento ativo; o mínimo para "levantar" do trilho.
- **Brilho de marca** (`0 0 64px -10px oklch(0.491 0.27 292.58 / 0.75)`): só na landing, sob o núcleo e personas. Atmosfera, não UI.

### Named Rules
**A Regra do Plano-por-Padrão.** Superfícies do console são planas em repouso. Aro fino para separar; sombra só como resposta a estado (hover, foco, ativo). Se um card precisa de sombra forte para "aparecer", o problema é a camada tonal, não a sombra.

**A Regra do Brilho Confinado.** Glow e backdrop-filter pertencem à landing. No produto, glassmorphism é proibido — ver Do's & Don'ts.

## 5. Components

A sensação é **refinada e discreta**: hairlines, muito respiro, tipografia carregando a hierarquia, cor reservada. Componentes não competem com o conteúdo.

### Buttons
- **Shape:** cantos suaves de 10px (`rounded-lg`). Altura padrão 32px (`h-8`), compacta.
- **Primary:** fundo Violeta Trama, texto branco; `px-2.5`, ícone 16px. O CTA do sistema.
- **Hover / Focus:** hover escurece para `primary/80`; foco mostra anel triplo `ring-ring/50` + borda `ring`. Active afunda 1px (`translate-y-px`) — um toque tátil mínimo.
- **Secondary / Outline / Ghost:** secondary em Cinza Névoa; outline com Cinza Aro sobre canvas; ghost só ganha fundo muted no hover. Destructive é tonal (`destructive/10` + texto vermelho), nunca bloco sólido.

### Cards / Containers
- **Corner Style:** 14px (`rounded-xl`).
- **Background:** Branco Puro sobre o canvas quase-branco.
- **Shadow Strategy:** sem sombra — `ring-1 ring-foreground/10` (ver Elevation).
- **Border:** o próprio aro é a borda; footer ganha `border-t` e fundo `muted/50`.
- **Internal Padding:** 16px (`--card-spacing`); variante `sm` usa 12px. **Sem cards aninhados.**

### Inputs / Fields
- **Style:** altura 32px, cantos 10px, borda Cinza Aro, fundo transparente.
- **Focus:** borda vira `ring` + anel triplo `ring-ring/50`. Sem glow.
- **Error / Disabled:** `aria-invalid` borda+anel destructive; disabled com opacidade reduzida e fundo `input/50`.
- **Placeholder:** Cinza Médio — **verificar contraste** (Do's & Don'ts).

### Badges / Chips
- **Style:** pílula total (`rounded-4xl`), altura 20px, texto 12px. Variantes default (roxo), secondary, outline, destructive tonal, ghost.
- **State:** usadas para status e contagem; quando codificam persona/estado, acompanham ícone.

### Tabs / Navigation
- **Style:** trilho em Cinza Névoa (`bg-muted`), cantos 10px, padding 3px. Trigger ativo: fundo Branco Puro + `shadow-sm`. Variante `line` usa sublinhado animado (barra `after`) em vez de fundo.
- **States:** inativo em `foreground/60`; hover sobe para foreground cheio; ativo destaca por superfície (default) ou sublinhado (line).
- **Console header:** marca 🧵 + "Trama", sticky, fundo `background/80` com `backdrop-blur`, borda inferior fina.

### Signature — Constelação de Agentes (landing)
Núcleo "CEO" com brilho roxo, anéis girando lentos (80s), fios pontilhados animados ligando o CEO às personas em órbita (cada uma com sua cor). É a tradução visual da "trama": fios que se entrelaçam puxando o negócio. Respeita `prefers-reduced-motion`.

## 6. Do's and Don'ts

### Do:
- **Do** manter a **Regra do Roxo Raro**: Violeta Trama em ≤10% da tela, só em ação/foco/marca.
- **Do** separar superfícies com aro de 1px (`ring-1 ring-foreground/10`) e camadas tonais; sombra só como resposta a estado.
- **Do** carregar hierarquia com peso e tamanho de Geist; usar Geist Mono apenas em rótulos técnicos curtos.
- **Do** acompanhar toda cor de estado/persona com ícone e/ou rótulo (**Regra do Sinal Duplo**), para daltônicos e telas ruins.
- **Do** escrever rótulos na língua do dono ("seu time", "ver entregável"), nunca termos de máquina ("agente", "workflow", "token").
- **Do** garantir contraste AA: texto de corpo ≥4.5:1, incluindo placeholders; se o Cinza Médio chegar perto do limite sobre canvas, puxar para a Tinta Quente.
- **Do** oferecer alternativa em `prefers-reduced-motion` para toda animação (já feito na landing — manter o padrão).

### Don't:
- **Don't** transformar o Trama em **dashboard corporativo frio**: denso, cinza, cheio de tabelas e configuração intimidadora.
- **Don't** cair no **SaaS de IA genérico**: roxo-gradiente clichê, *hero-metric template* (número gigante + label + stats), grids de cards idênticos com ícone+título+texto.
- **Don't** usar **gradient text** (`background-clip: text` sobre gradiente). É proibido no console. Existe um uso legado na palavra "crescer" do herói da landing — tratar como dívida a revisar, não como padrão a repetir.
- **Don't** usar **glassmorphism** como recurso de UI no produto. Glow e `backdrop-filter` ficam confinados à landing (**Regra do Brilho Confinado**).
- **Don't** usar **faixa lateral colorida** (`border-left`/`border-right` >1px) em cards, alertas ou listas. Use borda inteira, fundo tonal ou número/ícone.
- **Don't** aninhar cards, nem repetir grids de cards idênticos como estrutura padrão.
- **Don't** expor jargão técnico nem exigir conhecimento de engenharia para usar qualquer tela.
- **Don't** infantilizar: nada de excesso de mascotes, emojis ou pastel que mine a credibilidade diante de um dono de negócio.
