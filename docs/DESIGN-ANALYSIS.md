# Análise de Design (UI/UX) — ALL·IN CRM (bhub)

> Auditoria visual e de experiência realizada em **22/07/2026** pelo ce-design-iterator.
> Método: app rodando localmente (`vite dev`, conta de auditoria admin "Design Audit (TESTE)"), screenshots reais em desktop 1440×900 e mobile 375×812, light + dark mode, cruzados com análise estática de `tailwind.config.ts`, `src/index.css`, `AppLayout.tsx` e componentes de domínio. **Nenhum arquivo de código foi modificado.**
> Screenshots: pasta `docs/design-analysis/`.

---

## 1. Resumo executivo

O produto tem uma **base sólida**: design system shadcn/ui bem configurado com tokens HSL semânticos, dark mode funcional e bem resolvido, sidebar com agrupamento claro por domínio, e padrões de CRM reconhecíveis (inbox em colunas, kanban, gauge de NPS). Os pontos que mais derrubam a nota não são de "gosto visual", são de **consistência sistêmica**: cores semânticas de status que mudam de significado entre telas, CTAs primários em duas cores concorrentes (dourado × verde), wayfinding quebrado na topbar e telas-chave (Login, Kanban) que ignoram os tokens do tema.

**Nota geral média: 6,7 / 10**

| Tela | Nota | Principal problema |
|---|---|---|
| Login / Cadastro | 6,5 | Cores 100% hardcoded fora do DS; contraste do botão falha WCAG AA; sem "Esqueci minha senha" (manual promete) |
| Dashboard | 7,0 | "Aberto" vermelho aqui × verde no Inbox; header de tabela colorido e decorativo |
| Inbox | 7,0 | Painel de filtros sempre expandido (≈45% da altura); tabs de status coladas |
| Contatos | 7,5 | Empty state genérico; telefone sem máscara; "Abrir conversa" termina em dead-end |
| Pipeline (lista) | 5,5 | CTA verde fora do padrão; bloco do funil dark navy quebra o tema light; "Conv: 100%" com 0 leads |
| Funil — Kanban | 5,0 | Topbar diz "Dashboard"; headers de coluna pretos fora do DS; CTA verde |
| Campanhas | 6,5 | Empty state pobre (sem ícone, sem CTA inline) |
| Chatbot (lista) | 8,0 | Melhor empty state do app (templates); alinhamento dos cards irregular |
| FlowEditor | 8,0 | Bom banner de "fluxo inativo" e accordions descritivos; pluralização "3 ação(ões)" |
| Relatórios | 6,0 | 9 filtros sem agrupamento; filtros de *exclusão* em vermelho parecem erro de validação |
| NPS | 7,5 | Bem composto; "0 (0%)" ruidoso; seletor de período duplicado |
| Usuários | 7,0 | Bem organizado; card "Membros da equipe" renderizou vazio (bug?) |
| Integrações | 7,5 | Ótimo empty state orientativo; "Adicionar Aparelho" contradiz a orientação |
| Tags | 7,0 | Simples e funcional |
| Respostas Rápidas | 7,5 | Excelente card "Como Utilizar"; botão salvar verde gigante |
| Perfil | 6,0 | Topbar diz "Dashboard"; sem seção de segurança (manual promete "Perfil > Segurança") |
| Módulos | 8,0 | Claro, bem hierarquizado, badges de status corretos |
| 404 (NotFound) | 4,0 | Em inglês, sem layout do app, alcançável por link real do sino |
| Mobile (geral) | 6,5 | Drawer de navegação bom; filtros do Inbox consomem ~50% da tela |

**Distribuição:** telas de configuração/suporte são as melhores (Módulos, Chatbot, Integrações); as piores são as de vendas (Pipeline/Kanban) e as telas de entrada (Login/404) — exatamente as que formam a primeira impressão.

---

## 2. Análise por tela

### 2.1 Login (`01-login-desktop.png`) e Cadastro (`02-cadastro-desktop.png`)

**O que funciona:** composição limpa, card com `backdrop-blur`, logo bem aplicado, foco visível nos inputs, hierarquia óbvia.

**Problemas:**
1. **Tokens ignorados por completo** — `src/pages/Login.tsx:33,68,75` e `Cadastro.tsx:70,127,134` usam `bg-[#1a1a2e]`, `bg-[#c8944a]`, `hover:bg-[#b8843a]`, `text-[#c8944a]`, `text-gray-400`, `bg-white/5`... nada passa por `hsl(var(--primary))`. O dourado `#c8944a` é *parecido* com o `--primary` (38 62% 51% ≈ `#c9973f`) mas não é o mesmo — drift visual garantido.
2. **Contraste do CTA falha WCAG AA** — o botão usa `#c8944a` com `text-white`: contraste ≈ **2,7:1** (mínimo 4,5:1). O design system resolve isso corretamente com `--primary-foreground: 0 0% 8%` (texto escuro ≈ 6,9:1) — basta usar o `Button` padrão sem override.
3. **Sem "Esqueci minha senha"** — `GUIA-DO-CRM.md` §Recuperação de senha documenta o fluxo a partir da tela de login; o link não existe em `Login.tsx`. Divergência produto × manual.
4. Tela é sempre dark, independente do tema do app — aceitável como escolha estética, mas hoje é acidental (cor fixa), não decisão de design documentada.

### 2.2 Dashboard (`05-dashboard-light.png`, `24-dashboard-dark.png`, mobile `29-dashboard-mobile.png`)

**O que funciona:** estrutura em cards com `card-shadow`, dark mode muito bem resolvido, indicadores de presença (online/ausente/offline), responsivo com grid 2×3 no mobile.

**Problemas:**
1. **"Aberto" é VERMELHO aqui** (`Dashboard.tsx:455` `bg-red-500`, `:534` `text-red-500`; `AgentComparisonChart.tsx:10` `#ef4444`) — no Inbox e no `StatusBadge.tsx:5` o mesmo status `new` é **verde**. Vermelho = erro/destrutivo em todo o resto do sistema. Detalhe: `detail-03-status-dashboard.png`.
2. A faixa colorida "ABERTO | EM ATENDIMENTO | ..." é o *header de uma tabela* que, sem dados, vira uma barra decorativa de 5 cores saturadas gritando "zero dados".
3. Legenda do gráfico "Novos Chats" em vermelho (`Dashboard.tsx:585` `#ef4444`) — de novo vermelho para algo neutro/positivo.
4. Card "Equipe" vazio diz "Nenhum agente no projeto" — mas eu estava logado como agente/admin; ou o card exclui o próprio usuário sem dizer, ou é bug de dados.

### 2.3 Inbox (`03-inbox-desktop-light.png` dark-default, `04-inbox-desktop-lightmode.png`, `25-inbox-dark.png`, mobile `26-inbox-mobile.png`)

**O que funciona:** padrão inbox de CRM correto (lista + painel de leitura), contadores por status clicáveis, tabs de filtro, sub-filtros (Favoritos/Não lidas/Agendados), empty states com ícone, busca com "Congelar lista" (feature esperta de UX), badge de não-lidas verde (`ConversationList.tsx:780`).

**Problemas:**
1. **Painel de filtros expandido por padrão** — `ConversationList.tsx:112-115`: `// default open`, persistido em localStorage. Consome ≈45% da altura da lista no desktop e **≈50% da tela no mobile** (`26-inbox-mobile.png`), escondendo o que importa: as conversas.
2. **Tabs de status coladas** — "AGUARD RESOLV" quase se tocam (detalhe `detail-06-tabs-inbox.png`); falta `gap` e os rótulos truncados ("ATEND", "AGUARD", "RESOLV") perdem legibilidade.
3. Seis cards de contador com "0" recebem peso visual demais — quando tudo é zero, o destaque deveria ser o CTA de conectar WhatsApp, não seis zeros coloridos.
4. "Abrir conversa" a partir de Contatos (`31-chatpanel.png`) só filtra o inbox pelo telefone; sem conversa existente, o fluxo termina em dead-end "Nenhuma conversa" sem oferecer **iniciar conversa** — quebra de jornada (e o módulo "Adicionar Chat" que resolveria isso está inativo em Módulos).

### 2.4 Contatos (`06-contatos-light.png`, modal `07-contatos-novo-modal.png`, lista `08-contatos-lista.png`, mobile `28-contatos-mobile.png`)

**O que funciona:** toolbar completa (busca, tag, origem, importar/exportar), modal de criação com labels + obrigatórios + hint de tags, painel lateral de detalhes editável, adaptação mobile esconde colunas e vira lista (bom), "—" para células vazias.

**Problemas:**
1. **Empty state com copy errada** — `06`: banco vazio exibe "Tente buscar com outro termo ou ajuste os filtros", copy de *busca sem resultado*, não de *primeiro uso*. Deveria ter CTA "Importar contatos" / "Criar primeiro contato".
2. **Telefone sem máscara** — o input promete `(00) 00000-0000`, mas lista e detalhe exibem `11987654321` cru.
3. O hint "Crie em Configurações → Tags" não corresponde à navegação real (menu "Tags" direto na sidebar).
4. No painel de detalhe, "Abrir conversa" (primário dourado) tem mais peso que "Salvar alterações" (outline) mesmo quando há edição pendente — hierarquia de ação discutível.

### 2.5 Pipeline — lista (`09-pipeline-light.png`, modal `10-pipeline-criar-modal.png`, criado `11-pipeline-kanban.png`)

**Problemas (tela mais fraca do app):**
1. **CTA verde** — "Criar novo funil"/"Criar primeiro funil" usam `bg-success` (`Pipeline.tsx:447-452`), enquanto todo o resto do app usa `primary` dourado para ação primária. `success` é token de *feedback*, não de ação. Detalhe: `detail-04-botoes-verdes.png`.
2. **Bloco do funil dark navy em pleno light mode** — `tailwind.config.ts:73-74` define `funnel-dark`/`funnel-darker` fixos; o card do funil (`11`) fica preto-azulado com texto verde-limão (`Pipeline.tsx:73-83` gradiente `#22c55e→#a3e635` hardcoded), destoando de tudo.
3. **"Conv: 100%" com zero leads** — métrica calculada sobre 0/0 exibida como verdade.
4. Modal de criação com labels em CAPS (`uppercase tracking-wide`, `Pipeline.tsx:135`) — padrão diferente dos demais modais do app (que usam `text-xs` capitalizado, ex.: modal de contato).
5. "Etapa 1" vem com valor real "ENTRADA DO LEAD" no input enquanto "Etapa 2" usa placeholder — inconsistente.

### 2.6 Funil — Kanban (`12-funnel-kanban.png`)

1. **Wayfinding quebrado**: topbar exibe "Dashboard" (causa-raiz em §3, achado G1) e nenhum item da sidebar fica ativo — usuário não sabe onde está.
2. **Headers de coluna pretos** (`bg-zinc-900`-like) com texto branco — terceira linguagem visual na mesma página (app light, header preto, CTA verde).
3. "+ Nova Etapa" verde novamente; coluna pontilhada de "Nova Etapa" duplica a ação do botão do topo.
4. Sem dados, as colunas dizem "Nenhum contato" — ok, mas "Adicionar Contato" por coluna + busca + botão de etapa competem sem hierarquia.

### 2.7 Campanhas (`13-campanhas-light.png`)

Empty state mais pobre do app: texto cinza centralizado, **sem ícone e sem CTA inline** (só o "Nova Campanha" no topo). Comparar com Chatbot (ícone + CTA + templates) e Integrações (explicação + CTA) — três níveis de qualidade de empty state no mesmo produto.

### 2.8 Chatbot — lista (`14-chatbot-light.png`) e FlowEditor (`15`, `16-floweditor.png`)

**Melhor experiência do app.** Empty state com ícone, CTA e **templates de partida** (Menu de Boas-vindas, Coleta de Lead, FAQ) — padrão-ouro de primeiro uso. O editor acerta no banner "Fluxo inativo..." (aviso âmbar acionável), accordions com descrição ("Define o evento que inicia..."), ações numeradas com badge de tipo colorido + toggle + delete.

**Problemas menores:** cards de template com alinhamento de texto irregular; "3 ação(ões)" e "0 fluxo(s)" — pluralização manual awkward ("3 ações"); toast de sucesso sobrepõe a topbar; "Salvar" como outline (poderia ser primário, é a ação principal do editor).

### 2.9 Relatórios (`17-relatorios-light.png`)

1. **Nove controles de filtro** na mesma banda sem agrupamento — período, datas, agentes, status, busca, tag/funil/etapa + três "Excluir *".
2. **Filtros de exclusão em vermelho** ("Excluir Tag/Funil/Etapa" com texto/borda vermelhos) — leem-se como *erro de validação*, não como opção. Vermelho destrutivo usado como cor de categoria.
3. Só existe "Relatório de Leads" visível; as permissões (`App.tsx:126`) prometem relatórios de chats, mensagens, anotações, usuários, chatbot, diálogos — sem tabs ou navegação entre eles na UI.

### 2.10 NPS (`18-nps-light.png`)

Bem composto: gauge com zonas de cor, seletor 7/30/90d com estado ativo dourado, cards de distribuição, lista de respostas. Problemas menores: "0 (0%)" deveria ser "—" quando sem dados; o período "30 dias" aparece duas vezes (seletor global + badge no card "Respostas individuais"); gauge "Sem dados" mostra agulha neutra que parece dado real à primeira vista.

### 2.11 Usuários / Configurações (`19-usuarios-light.png`)

Boa organização (tabs Usuários/Departamentos/Tags/Empresa), cards de cargo com descrição, rodízio com cards selecionáveis e toggle explicado. **Bug aparente:** card "Membros da equipe" renderizou vazio mesmo com um usuário admin logado — ou a query falhou silenciosamente (sem empty state, sem erro), ou o próprio usuário é excluído sem aviso. Largura de conteúdo limitada (~850px) adequada para formulários.

### 2.12 Integrações (`20-integracoes-light.png`)

Empty state exemplar: explica o modelo mental ("números são gerenciados dentro das Pastas") e oferece CTA para o lugar certo. Card de API com status, chave mascarada e webhook copiável. **Contradição:** o botão primário "Adicionar Aparelho" permanece no topo, competindo com a orientação de ir para Pastas — se o fluxo correto é via Pastas, o CTA primário deveria ser "Abrir Pastas / Projetos".

### 2.13 Tags (`21-tags-light.png`), Respostas Rápidas (`22`), Módulos (`33`)

- **Tags:** direto ao ponto; paleta de 10 cores hardcoded (`Tags.tsx:18-19` — aceitável por ser dado de usuário, mas as cores não têm variantes dark ajustadas).
- **Respostas Rápidas:** o card lateral "Como Utilizar" com preview do `/atalho` é o melhor padrão de ajuda contextual do app. Problema: "Salvar Resposta Rápida" full-width em `bg-success` verde (`RespostasRapidas.tsx:266-273`) — CTA errado novamente (detalhe `detail-05-salvar-verde.png`).
- **Módulos:** ótimo — stats, categorias, badges Ativo/Inativo, inativos com opacidade reduzida. Serve de referência interna de qualidade.

### 2.14 Perfil (`23-perfil-light.png`) e 404 (`30-tarefas-404.png`)

- **Perfil:** topbar diz "Dashboard" (detalhe `detail-01-topbar-perfil.png`); faltam seções de segurança/senha que o manual promete ("Perfil > Segurança").
- **404:** alcançável pelo sino de notificações (`AppLayout.tsx:285` navega para `/tarefas`, rota que não existe), renderiza **sem layout** (sem sidebar/topbar) e **em inglês** ("Oops! Page not found / Return to Home") num produto 100% pt-BR.

### 2.15 Navegação global e mobile (`26`, `27-mobile-menu.png`)

Drawer mobile funciona bem (overlay, X, item ativo). Ícones da topbar sem label visível em mobile ficam só com `title` (tooltip inacessível em touch). Hamburguer (`AppLayout.tsx:222`) e botões ícone-only (`:251-268`) não têm `aria-label` — só `title` —, o que leitores de tela anunciam mal (o snapshot de a11y mostra `button` sem nome para o hamburger e para o indicador de conexão).

---

## 3. Achados globais (tokens, consistência, acessibilidade)

**G1 — Wayfinding da topbar quebrado (causa-raiz).** `AppLayout.tsx:223-225`:
```tsx
{navItems.find(i => i.to === location.pathname)?.label || 'Dashboard'}
```
O título é derivado *apenas* dos itens de menu; qualquer rota fora do menu (`/perfil`, `/pipeline/:id`, `/folders*`) cai no fallback `'Dashboard'`. Evidências: `detail-01-topbar-perfil.png`, `12-funnel-kanban.png`.

**G2 — Duas escalas de cor de status concorrentes.** O status `new`/"Aberto" é **verde** em `StatusBadge.tsx:5`, `ConversationList.tsx:57`, `AgentLeadsSummary.tsx:51` — e **vermelho** em `Dashboard.tsx:455,534`, `AgentComparisonChart.tsx:10`. O status `closed`/"Fechado" é **vermelho** em `StatusBadge.tsx:9` e **cinza** no Dashboard. Vermelho, que em todo o restante significa destrutivo/erro (`--destructive`), vira cor de categoria. Comparar `detail-02-status-inbox.png` × `detail-03-status-dashboard.png`.

**G3 — CTA primário sem dono: dourado × verde.** O `Button` default é `bg-primary` (dourado) e a maioria das telas o usa (Nova Campanha, Novo contato, Criar fluxo). Mas `Pipeline.tsx:447` e `RespostasRapidas.tsx:267` usam `bg-success` (verde) para as ações primárias. `success` deveria ser restrito a feedback pós-ação (toasts, badges "Conectado").

**G4 — Cores hardcoded fora dos tokens.** `Login.tsx`/`Cadastro.tsx` (hex em 6 lugares), `Dashboard.tsx:585-617` (hex de charts), `Pipeline.tsx:73-83` (gradiente do funil), `tailwind.config.ts:73-74` (`funnel-dark` fixos, sem variante por tema), `Tags.tsx:18-19`, `NPS.tsx:36-101` (hex em SVG/chart — parcialmente justificável por serem dados de visualização, mas sem adaptação dark).

**G5 — Título duplicado sistemático.** A topbar (`h1`, `AppLayout.tsx:223`) + o header interno de cada página (outro `h1`, ex.: `Pipeline.tsx:441`) produzem **dois `<h1>` idênticos por tela** ("Funil"/"Funil", "Campanhas"/"Campanhas") — redundância visual e HTML inválido semanticamente.

**G6 — Emojis no lugar do sistema de ícones.** Notificações usam 🔴💬🎉 (`AppLayout.tsx:286,292,297`) enquanto todo o app usa Lucide — quebra de linguagem visual.

**G7 — Código morto visível para o usuário.** `GlobalSearchCommand.tsx` (busca Cmd+K) não é importado em nenhum lugar — Cmd+K não faz nada. `/tarefas` é linkado no sino mas não existe (→ 404 em inglês). Manual documenta "Tarefas", "Esqueci senha" e "Perfil > Segurança" — nenhum dos três existe na UI.

**G8 — Acessibilidade:** botão do Login com contraste 2,7:1 (falha AA); botões ícone-only da topbar sem `aria-label` (`AppLayout.tsx:222,251,261,276`); labels de grupo da sidebar (`text-sidebar-muted/70`, ~3,1:1) abaixo do ideal para texto de 10px; focus ring existe (Ring `38 62% 51%`) e funciona — ponto positivo.

**G9 — Empty states em três níveis de qualidade** (§2.7): o componente `EmptyState.tsx` não aceita CTA nem variante "primeiro uso × sem resultado de busca" — por isso telas improvisam ou omitem.

**G10 — Idioma:** 404 em inglês; restante em pt-BR consistente. Pluralizações manuais ("0 fluxo(s)", "3 ação(ões)", "1 tarefa(s)") em vários lugares.

---

## 4. Top 10 problemas priorizados (severidade × esforço)

| # | Problema | Severidade | Esforço | Onde |
|---|---|---|---|---|
| 1 | Topbar mostra "Dashboard" em rotas fora do menu (/perfil, /pipeline/:id, /folders) | 🔴 Alta | **Baixo** | `AppLayout.tsx:223-225` |
| 2 | Cor semântica de status divergente (Aberto verde×vermelho; Fechado vermelho×cinza) | 🔴 Alta | Médio | `Dashboard.tsx:455,534`, `AgentComparisonChart.tsx:10-13` × `StatusBadge.tsx:5,9` |
| 3 | CTA primário em verde (`bg-success`) em vez de `primary` dourado | 🟠 Média-alta | **Baixo** | `Pipeline.tsx:447`, `RespostasRapidas.tsx:267`, `Pipeline.tsx` modal/empty |
| 4 | Link do sino → `/tarefas` inexistente; 404 em inglês e sem layout | 🟠 Média-alta | **Baixo** | `AppLayout.tsx:285`, `NotFound.tsx` |
| 5 | Login/Cadastro fora do DS + contraste do CTA 2,7:1 + sem "Esqueci senha" | 🟠 Média-alta | **Baixo** | `Login.tsx:33,68,75`, `Cadastro.tsx:70,127,134` |
| 6 | Painel de filtros do Inbox aberto por padrão (desktop e mobile) | 🟠 Média | **Baixo** | `ConversationList.tsx:112-115` |
| 7 | Dois `<h1>` por tela (topbar + header interno) | 🟠 Média | **Baixo** | `AppLayout.tsx:223` × headers das páginas |
| 8 | Empty states inconsistentes e sem CTA (componente não suporta ação) | 🟠 Média | Médio | `EmptyState.tsx`, `Campanhas.tsx`, `Contatos.tsx` |
| 9 | Telefone sem máscara em lista/detalhe | 🟡 Baixa-média | **Baixo** | `Contatos.tsx` / `ContactProfilePanel.tsx` |
| 10 | Busca global Cmd+K morta (componente não montado) | 🟡 Baixa | **Baixo** | `GlobalSearchCommand.tsx` (órfão) |

Menções honrosas: tabs de status coladas no Inbox; "Conv: 100%" com 0 leads; filtros "Excluir *" vermelhos em Relatórios; "0 (0%)" no NPS; emojis nas notificações; card "Membros da equipe" vazio; `aria-label` ausente nos ícones da topbar.

---

## 5. Plano de refinamento visual (quick wins primeiro)

### Sprint A — Quick wins (1 dia, alto impacto, risco zero)

1. **Corrigir título da topbar** — `AppLayout.tsx:224`: trocar o fallback por um mapa de rotas complementar (`/perfil → "Meu Perfil"`, `/pipeline/:id → nome do funil via contexto`, `/folders* → "Pastas"`). *Antes:* "Dashboard" em 3+ telas. *Depois:* título sempre fiel à rota.
2. **Padronizar CTAs primários** — trocar `bg-success hover:bg-success/90 text-success-foreground` por nada (usar `Button` default = primary) em `Pipeline.tsx:447,452` e `RespostasRapidas.tsx:267`. `success` fica reservado a badges/toasts. *Antes:* verde e dourado competindo. *Depois:* uma única cor de ação.
3. **Fechar filtros do Inbox por padrão em telas < lg** — `ConversationList.tsx:112-115`: default `window.innerWidth < 1024 ? false : true`. *Antes:* 50% da tela mobile em filtros. *Depois:* conversas primeiro.
4. **Máscara de telefone na exibição** — aplicar o formatador já existente (`utils/whatsapp.ts`) na lista e no painel de Contatos. *Antes:* `11987654321`. *Depois:* `(11) 98765-4321`.
5. **NotFound em pt-BR com layout** — "Página não encontrada" + botão "Voltar ao Inbox", dentro do `AppLayout` quando autenticado; corrigir/remover o link `/tarefas` do sino (`AppLayout.tsx:285`).

### Sprint B — Consistência de tokens (2–3 dias)

6. **Unificar escala de status num módulo único** — criar `src/lib/statusTheme.ts` exportando cor/label por status (fonte: o esquema verde/azul/âmbar/roxo/cinza do `StatusBadge`), consumir em Dashboard, AgentComparisonChart, ConversationList e AgentLeadsSummary; aposentar o vermelho para "Aberto" e o vermelho para "Fechado" (Fechado → cinza/slate em todo lugar). *Decisão de produto necessária: fechado = neutro (cinza), não erro.*
7. **Migrar Login/Cadastro para tokens** — trocar `#c8944a/#1a1a2e` por `bg-primary`/`bg-background` + variantes dark, resolvendo o contraste de brinde (primary-foreground escuro = 6,9:1); adicionar link "Esqueci minha senha" (fluxo `resetPasswordForEmail` do Supabase).
8. **Um `<h1>` por tela** — topbar vira `div`/`p` ou o header interno vira `h2`; recomendação: manter `h1` só no conteúdo e transformar o da topbar em breadcrumb/título secundário.
9. **Emojis → Lucide** nas notificações (`AppLayout.tsx:286-297`).

### Sprint C — Elevação de padrão (1 semana)

10. **EmptyState 2.0** — adicionar props `action?: {label, onClick}` e `variant: 'first-use' | 'no-results'`; aplicar em Campanhas (CTA "Nova Campanha"), Contatos (distinguir banco vazio de busca vazia) e Inbox (CTA "Conectar WhatsApp" quando zero conversas).
11. **Tema do bloco de funil** — remover `funnel-dark` fixos; derivar de `card`/`muted` com variante dark, alinhar o gradiente à paleta de status (não verde-limão); esconder "Conv:" quando 0 leads.
12. **Relatórios** — agrupar filtros avançados em `Collapsible`; trocar o vermelho dos "Excluir *" por estilo neutro com ícone de minus-circle; adicionar tabs para os tipos de relatório permitidos.
13. **A11y pass** — `aria-label` em todos os botões ícone-only da topbar; revisar contraste de `sidebar-muted`; anunciar badge de não-lidas com `aria-live`.
14. **Decidir Cmd+K** — montar `GlobalSearchCommand` no `AppLayout` com atalho e hint visual na topbar, ou deletar o arquivo.

---

## 6. Checklist de design system (para o time seguir daqui em diante)

**Cores e tokens**
- [ ] Proibido hex/rgb em componentes: somente tokens `hsl(var(--*))` (`bg-primary`, `text-muted-foreground`…). Exceção documentada: dados de charts, que devem vir de `lib/chartColors.ts` único.
- [ ] `primary` = única cor de ação principal. `success`/`warning`/`destructive` = somente feedback de estado (toast, badge, banner), nunca CTA.
- [ ] Status de conversa têm uma única fonte: `lib/statusTheme.ts` (verde=aberto, azul=atendimento, âmbar=aguardando, roxo=resolvido, cinza=fechado). Vermelho é sempre erro.
- [ ] Toda cor nova precisa de par light/dark definido em `index.css` — nada de valor fixo que ignore o tema (caso `funnel-dark`).

**Componentes**
- [ ] Botões: usar `<Button>` com variants (`default`, `secondary`, `outline`, `ghost`, `destructive`) sem sobrescrever `bg-*` — se precisou de cor custom, o design system está incompleto (abrir exceção).
- [ ] Empty states: sempre via `<EmptyState>` com ícone + título + descrição + CTA quando houver ação óbvia; distinguir "primeiro uso" (ensinar) de "sem resultados" (oferecer limpar filtros).
- [ ] Modais: labels `text-xs` capitalizados (padrão Contatos), obrigatório com `*`, foco inicial no primeiro campo, botão primário à direita.
- [ ] Tabelas/listas: célula vazia = "—"; telefone/documentos sempre formatados para exibição.

**Navegação e estrutura**
- [ ] Um `<h1>` por página; topbar exibe breadcrumb/título fiel à rota (incluindo rotas dinâmicas).
- [ ] Nenhum link interno pode apontar para rota inexistente (teste de fumaça: varrer `navigate('/...')` × rotas do `App.tsx`).
- [ ] Idioma: 100% pt-BR, inclusive 404 e mensagens de erro; pluralização com lógica real (`n === 1 ? 'ação' : 'ações'`), nunca `"ação(ões)"`.
- [ ] Feature nova só entra no menu/atalhos quando montada de fato (caso Cmd+K).

**Acessibilidade mínima (WCAG AA)**
- [ ] Contraste ≥ 4,5:1 em texto (botões inclusos — testar antes de escolher `text-white` sobre `primary`).
- [ ] Todo botão ícone-only tem `aria-label` (não só `title`).
- [ ] Focus ring visível e não removido (`ring` do tema já atende — não desabilitar).
- [ ] Alvos de toque ≥ 40px em mobile; painéis colapsáveis fechados por padrão em viewport < lg.

**Qualidade contínua**
- [ ] Screenshot das telas novas/alteradas em light + dark + mobile 375px antes do PR.
- [ ] Revisão de PR inclui check: "há cor hardcoded nova? há `bg-success` em CTA? empty state tem CTA?"
- [ ] Atualizar `GUIA-DO-CRM.md` junto com a UI (hoje promete Tarefas, recuperação de senha e Perfil > Segurança inexistentes).

---

## Apêndice — Inventário de screenshots (`docs/design-analysis/`)

| Arquivo | Conteúdo |
|---|---|
| `01-login-desktop.png` / `02-cadastro-desktop.png` | Telas de entrada (dark fixo) |
| `03-inbox-desktop-light.png` / `25-inbox-dark.png` | Inbox dark (tema padrão do app) |
| `04-inbox-desktop-lightmode.png` | Inbox light |
| `05-dashboard-light.png` / `24-dashboard-dark.png` / `29-dashboard-mobile.png` | Dashboard |
| `06`–`08` | Contatos (vazio, modal, lista+detalhe) |
| `09`–`12` | Pipeline lista, modal, funil criado, Kanban |
| `13-campanhas-light.png` | Campanhas vazio |
| `14`–`16` | Chatbot lista, template, FlowEditor |
| `17-relatorios-light.png` | Relatório de Leads |
| `18-nps-light.png` | NPS |
| `19-usuarios-light.png` | Usuários/Rodízio |
| `20-integracoes-light.png` | Celulares WhatsApp |
| `21`–`23` | Tags, Respostas Rápidas, Perfil |
| `26`–`28` | Mobile: Inbox, drawer, Contatos |
| `30-tarefas-404.png` | 404 em inglês via link do sino |
| `31-chatpanel.png` | Dead-end "Abrir conversa" |
| `32-cmdk.png` | Cmd+K sem efeito |
| `33-modulos.png` | Módulos (dark) |
| `detail-01`…`detail-06` | Recortes de evidência (topbar errada, cores de status, botões verdes, tabs coladas) |

*Fim do documento. Reexecutar auditoria após as Sprints A–C para medir evolução da nota média (baseline: 6,7).*
