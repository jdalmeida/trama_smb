# Product

## Register

product

## Users

Donos de **pequenas empresas brasileiras** — geralmente tocando o negócio sozinhos ou com equipe enxuta, sem time de marketing, sem analista de dados e sem tempo. Usam o Trama no intervalo entre atender cliente, fechar venda e cuidar da operação: querem resultado, não ferramenta para configurar.

O trabalho a ser feito (jobs-to-be-done): **encontrar mais clientes** e **entender o próprio mercado** sem precisar virar especialista em marketing nem em tecnologia. O usuário chega com uma dor de negócio em linguagem simples ("quero atrair mais clientes") e espera sair com um plano e entregáveis concretos — não com um painel para preencher.

## Product Purpose

O Trama é um app web multi-agente: o usuário conversa com um **agente CEO** que entende o negócio, monta um plano e **delega tarefas a agentes-persona** especializados (Conteúdo & Aquisição, Mercado, Prospecção). O diferencial é o **trabalho à vista** — o usuário acompanha o time de agentes trabalhando ao vivo no painel "Time" e recebe entregáveis prontos (planos de conteúdo, pesquisa de mercado, CRM, publicações sociais).

Ao redor do chat existe um console de trabalho: **CRM** (board, contatos, agenda, automações), **Canais** (omnichannel — WhatsApp/Instagram/Messenger, inbox, publicações), **Entregáveis** e **Memórias**. O sucesso é o dono fechar o app sentindo que tem um time competente cuidando do crescimento — e que ele continua no controle de cada decisão.

## Brand Personality

Três palavras: **próximo, encorajador, direto**.

- **Voz**: fala como um sócio experiente que torce por você, não como um software corporativo nem como um engenheiro. Português brasileiro natural, frases curtas, zero jargão técnico ("seu time", "montar meu time", "ver entregável"). Explica o *porquê* em termos de negócio, nunca em termos de IA.
- **Tom**: calmo e confiante. Tira o medo da tecnologia sem infantilizar; entrega o que importa sem encher de buzzword. Caloroso, mas com credibilidade de ferramenta séria.
- **Emoções a evocar**: confiança ("isto é sério e seguro"), alívio ("não preciso fazer tudo sozinho"), controle ("eu decido, eles executam") e um pouco de orgulho de ver o time trabalhando.

## Anti-references

Evitar, em ordem do que mais ameaça a marca:

- **Dashboard corporativo frio**: ERP/admin genérico, denso, cinza, cheio de tabelas e configurações intimidadoras. O oposto de acessível para quem toca o negócio sozinho.
- **SaaS de IA genérico**: o roxo-gradiente clichê de IA, *hero-metric template* (número gigante + label + stats), grids de cards idênticos com ícone+título+texto, "mais um wrapper de chatbot". Gradient text decorativo e glassmorphism gratuito entram aqui.
- **Ferramenta técnica / jargão**: linguagem de engenheiro, setup complexo, termos como "agente", "workflow", "tokens", "modelo" expostos ao usuário. Nada deve exigir conhecimento técnico para usar.
- **Infantil ou fofo demais**: excesso de mascotes, emojis e pastel que mina a credibilidade diante de um dono de negócio. O calor vem do tom e da clareza, não de decoração lúdica.

O equilíbrio da marca vive **entre** esses extremos: nem frio-corporativo, nem fofo-infantil; nem técnico-intimidador, nem mais-um-SaaS-de-IA.

## Design Principles

1. **Você no comando, o time no trabalho.** Transparência radical: o humano sempre vê o que está acontecendo e aprova antes de qualquer ação externa (a IA nunca faz outreach sozinha). O painel "Time" mostra os agentes trabalhando ao vivo — confiança vem de ver, não de prometer.
2. **Fala de dono, não de engenheiro.** Toda copy, rótulo e estado é escrito na língua de quem toca o negócio. Esconda a máquina (modelos, workflows, tokens); mostre o resultado de negócio. Se uma tela precisa de explicação técnica, ela está errada.
3. **Mostrar, não prometer.** Entregáveis concretos e trabalho ao vivo carregam o produto — não estatísticas infladas nem buzzwords de IA. Prefira a prova (o plano pronto, a mensagem rascunhada) à promessa.
4. **Confiança por padrão.** Só fontes públicas, conformidade LGPD/CDC visível e decisões reversíveis. A segurança é comunicada com calma, não escondida nem usada para assustar.
5. **Leve, mas com credibilidade.** Acessível e caloroso sem ser infantil; capaz e sofisticado sem ser frio. Cada escolha de design é testada contra os dois lados: "isto intimida?" e "isto parece brinquedo?".

## Accessibility & Inclusion

- **WCAG 2.1 AA** como piso: contraste ≥ 4.5:1 em texto de corpo (incluindo placeholders), ≥ 3:1 em texto grande e em componentes/estados interativos.
- **Sinal nunca só por cor.** As personas e estados usam cor como código (Conteúdo = âmbar, Mercado = azul, Prospecção = verde; status ao vivo). Toda diferença sinalizada por cor deve vir acompanhada de ícone e/ou rótulo textual, para daltônicos e leitura em telas ruins.
- **Movimento opcional.** A landing tem animação significativa (órbitas, glow, pulsos); todo movimento precisa de alternativa em `prefers-reduced-motion: reduce` (já parcialmente implementado na landing — manter o padrão em todo movimento novo).
- **Toque e tela pequena.** O público acessa muito por celular entre uma tarefa e outra; alvos de toque confortáveis e layouts que não quebram em telas estreitas.
