# ALL-IN CRM - Guia Completo de Uso

> Documento de referencia para todos os usuarios do sistema ALL-IN CRM.
> Atualizado em: 26/03/2026

---

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Acesso e Login](#2-acesso-e-login)
3. [Navegacao e Interface](#3-navegacao-e-interface)
4. [Dashboard](#4-dashboard)
5. [Inbox (Caixa de Entrada)](#5-inbox-caixa-de-entrada)
6. [Contatos](#6-contatos)
7. [Tags](#7-tags)
8. [Respostas Rapidas](#8-respostas-rapidas)
9. [Tarefas](#9-tarefas)
10. [Chatbot / Dialogos](#10-chatbot--dialogos)
11. [Campanhas](#11-campanhas)
12. [Funil (Pipeline)](#12-funil-pipeline)
13. [Relatorios](#13-relatorios)
14. [NPS (Satisfacao)](#14-nps-satisfacao)
15. [Celulares WhatsApp (Integracoes)](#15-celulares-whatsapp-integracoes)
16. [Configuracoes (Usuarios)](#16-configuracoes-usuarios)
17. [Modulos](#17-modulos)
18. [Suporte](#18-suporte)
19. [Papeis e Permissoes](#19-papeis-e-permissoes)
20. [Dicas e Atalhos](#20-dicas-e-atalhos)

---

## 1. Visao Geral

O ALL-IN CRM e uma plataforma completa de atendimento ao cliente via WhatsApp e outros canais. Ele permite:

- Receber e responder mensagens de clientes em tempo real
- Organizar contatos com tags e funis
- Automatizar atendimento com chatbots
- Enviar campanhas em massa
- Gerar relatorios de performance
- Medir satisfacao com NPS
- Gerenciar equipe com permissoes granulares

### Canais suportados

| Canal | Provedor |
|-------|----------|
| WhatsApp | Evolution API, Meta Cloud API, Twilio, 360dialog, Gupshup |
| Instagram | Via integracao |
| Webchat | Widget embutido |
| Telegram | Via integracao |

---

## 2. Acesso e Login

### Como acessar

1. Abra o navegador e acesse a URL do sistema (ex: `https://all-in-crm.vercel.app`)
2. Digite seu **email** e **senha**
3. Clique em **Entrar**

### Recuperacao de senha

1. Na tela de login, clique em **Esqueci minha senha**
2. Informe seu email cadastrado
3. Verifique sua caixa de entrada e siga o link recebido

### Primeiro acesso

Seu administrador criara sua conta e enviara os dados de acesso. Ao entrar pela primeira vez, recomenda-se alterar a senha em **Perfil > Seguranca**.

---

## 3. Navegacao e Interface

### Barra lateral (Sidebar)

A sidebar e o menu principal, organizada em 4 categorias:

| Categoria | Paginas |
|-----------|---------|
| **Atendimento** | Dashboard, Inbox, Chats Geral, Tarefas |
| **Automacao** | Chatbot, Campanhas |
| **Dados** | Contatos, Tags, Respostas Rapidas, Funil, Relatorios, NPS |
| **Sistema** | Celulares WhatsApp, Modulos, Usuarios, Suporte |

> A sidebar pode ser recolhida clicando no icone de menu no topo.

### Seletor de Projeto

No topo da sidebar, ha um dropdown para selecionar o **projeto ativo**. Ao trocar de projeto:

- O Inbox mostra apenas conversas daquele projeto
- Tags, respostas rapidas e relatorios sao filtrados
- Contatos sao exibidos conforme o projeto

Selecione **"Todos os projetos"** para ver dados globais.

### Barra superior

- **Sino de notificacoes**: Mostra tarefas atrasadas e chats pendentes
- **Toggle de som**: Liga/desliga notificacoes sonoras de novas mensagens
- **Toggle de tema**: Alterna entre modo claro e escuro
- **Indicador de conexao**: Mostra se o sistema esta conectado ao servidor
- **Menu do usuario**: Acessa perfil, configuracoes e logout

---

## 4. Dashboard

O Dashboard e a tela inicial apos o login. Mostra uma visao geral do atendimento.

### Secoes do Dashboard

#### Equipe Online
- Mostra todos os agentes com status em tempo real
- **Verde**: Online | **Amarelo**: Ausente | **Cinza**: Offline
- Exibe o tempo desde a ultima atividade

#### Visao Geral dos Chats
- Tabela com distribuicao de chats por agente
- Colunas: Agente, Aberto, Em Atendimento, Aguardando, Fechado
- Clique em uma celula para abrir o Inbox filtrado

#### Cards de Status
- 5 cards clicaveis mostrando total por status:
  - **Aberto** (novo) - Vermelho
  - **Em Atendimento** (open) - Azul
  - **Aguardando** (pending) - Amarelo
  - **Resolvido** (resolved) - Verde
  - **Fechado** (closed) - Cinza
- Cada card mostra a contagem de nao-lidos
- Clique para filtrar o Inbox por aquele status

#### Graficos de 7 dias
- **Novos Chats**: Grafico de area com novos chats vs novos atendimentos por dia
- **Mensagens**: Grafico de barras com mensagens recebidas vs enviadas por dia

### Analise Avancada (somente Admin)

Abaixo das secoes basicas, admins veem uma area de analise com:

- **Seletor de periodo**: 7 dias, 30 dias, 90 dias ou datas customizadas
- **KPI Cards**: Tempo medio de resposta, tempo de resolucao, NPS, conversao, mensagens por conversa
- **Comparativo de Agentes**: Grafico de barras empilhado (leads por status) + radar chart (performance)
- **Breakdown por Projeto**: Cards com metricas de cada projeto
- **Distribuicao por Canal**: Grafico donut (WhatsApp, Instagram, Webchat, etc.)
- **Distribuicao por Tags**: Grafico de barras horizontal com top 10 tags
- **Heatmap de Atividade**: Grade hora x dia da semana mostrando volume de mensagens
- **Ranking de Agentes**: Tabela sortavel com medalhas para top 3

---

## 5. Inbox (Caixa de Entrada)

O Inbox e o coracao do CRM — onde acontece todo o atendimento.

### Estrutura da Tela

A tela e dividida em 3 paineis:

1. **Lista de Conversas** (esquerda) — todas as conversas
2. **Painel de Chat** (centro) — mensagens da conversa selecionada
3. **Perfil do Contato** (direita) — dados do contato

### Lista de Conversas

#### Filtros disponiveis
- **Busca**: Digite nome ou telefone para encontrar uma conversa
- **Status**: Novo, Aberto, Pendente, Resolvido, Fechado
- **Tags**: Filtre por tags aplicadas
- **Agente**: Filtre por agente responsavel (admin/supervisor)
- **Nao lidas**: Mostra apenas conversas com mensagens nao lidas

#### Badge de nao-lidos
- Cada conversa mostra um badge numerico com mensagens nao lidas
- O badge some ao abrir a conversa

#### Congelar lista
- Clique no icone de **cadeado** para congelar a lista
- Quando congelada, a lista nao reordena nem atualiza automaticamente
- Util para evitar perder a posicao enquanto atende um cliente

### Painel de Chat

#### Enviar mensagens
1. Digite sua mensagem no campo de texto
2. Pressione **Enter** para enviar (ou clique no botao de enviar)
3. Use **Shift + Enter** para quebra de linha

#### Enviar midia
- Clique no icone de **clip/anexo** para enviar:
  - Imagens (JPG, PNG, GIF)
  - Videos (MP4, MOV)
  - Audios (MP3, OGG)
  - Documentos (PDF, DOC, XLS, etc.)
- Videos mostram barra de progresso durante upload

#### Emojis
- Clique no icone de **smile** para abrir o seletor de emojis
- Escolha a categoria e clique no emoji desejado

#### Respostas rapidas
- Digite **/** no campo de mensagem para ver atalhos disponiveis
- Selecione o atalho desejado para inserir o texto automaticamente
- Ex: `/boas-vindas` insere a mensagem de boas-vindas configurada

#### Responder mensagem especifica (Reply)
- Passe o mouse sobre uma mensagem e clique no icone de **responder**
- A mensagem citada aparece acima do campo de texto
- Clique na citacao de uma resposta para **rolar ate a mensagem original** (com destaque visual)

#### Reagir com emoji
- Passe o mouse sobre uma mensagem e clique no icone de **coracao**
- Escolha um emoji para reagir

#### Acoes da conversa (menu superior)

| Acao | Descricao |
|------|-----------|
| **Delegar** | Transferir a conversa para outro agente ou departamento |
| **Mudar status** | Alterar para: Aberto, Pendente, Resolvido, Fechado |
| **Adicionar tag** | Aplicar tags a conversa |
| **Anotacoes** | Adicionar notas internas (visiveis apenas para a equipe) |
| **Marcar como nao lido** | Volta o badge de nao lido (util para lembrar de responder) |

#### Anotacoes internas
1. Clique no icone de **notas** no menu superior
2. Digite sua anotacao e clique em **Salvar**
3. Anotacoes sao visiveis apenas para a equipe, nao para o cliente
4. Voce pode **editar** (icone de lapis) ou **excluir** (icone de X) suas proprias anotacoes

### Perfil do Contato (painel direito)

- **Nome**: Editavel clicando no icone de lapis
- **Telefone**: Exibido com formato internacional
- **Email**: Editavel
- **Tags**: Visualize e gerencie tags do contato
- **Responsavel**: Agente atribuido
- **Historico**: Conversas anteriores do mesmo contato

---

## 6. Contatos

Pagina para gerenciar todos os contatos (leads) do CRM.

### Visualizacao

- **Tabela**: Nome, Telefone, Origem, Tags, Ultimo contato, Responsavel
- **Busca**: Por nome ou telefone
- **Filtros**: Por tag, por origem

### Origens de contato

| Origem | Descricao |
|--------|-----------|
| WhatsApp | Contato veio pelo WhatsApp |
| Instagram | Contato veio pelo Instagram |
| Webchat | Contato veio pelo chat do site |
| Indicacao | Contato indicado por outro |
| Google Ads | Contato veio por anuncio Google |
| Facebook Ads | Contato veio por anuncio Facebook |

### Acoes

| Acao | Como fazer |
|------|-----------|
| **Criar contato** | Botao "+ Novo Contato" > Preencha nome, email, telefone, origem, tags |
| **Importar CSV** | Botao "Importar" > Selecione arquivo CSV com colunas: nome, telefone, email |
| **Exportar CSV** | Botao "Exportar" > Gera CSV com os filtros aplicados |
| **Editar contato** | Clique no contato > Edite os campos desejados |
| **Gerenciar tags** | No detalhe do contato, adicione ou remova tags |

---

## 7. Tags

Tags sao etiquetas coloridas para categorizar contatos e conversas.

### Criar tag

1. Va em **Tags** no menu lateral
2. Clique em **"+ Nova Tag"**
3. Preencha:
   - **Nome**: Ex: "VIP", "Interessado", "Suporte"
   - **Cor**: Escolha entre 10 cores predefinidas
   - **Departamento** (opcional): Associe a um departamento
   - **Projeto** (opcional): Associe a um projeto
4. Clique em **Salvar**

### Gerenciar tags

- **Editar**: Clique no icone de lapis para renomear, mudar cor ou associacao
- **Excluir**: Clique no icone de lixeira (remove a tag de todos os contatos)

### Onde usar tags

- **Inbox**: Adicionar tags a conversas para categorizar
- **Contatos**: Filtrar contatos por tag
- **Relatorios**: Incluir/excluir tags nos filtros
- **Campanhas**: Selecionar destinatarios por tag
- **Funil**: Organizar leads por tag

---

## 8. Respostas Rapidas

Respostas rapidas sao mensagens pre-prontas que podem ser inseridas rapidamente no chat.

### Criar resposta rapida

1. Va em **Respostas Rapidas** no menu lateral
2. Clique em **"+ Nova Resposta"**
3. Preencha:
   - **Atalho**: Nome do comando (ex: `boas-vindas`, `horario`, `preco`)
   - **Mensagem**: Texto completo da resposta (ate 2000 caracteres)
   - **Anexo** (opcional): Imagem, video ou documento
4. Clique em **Salvar**

### Como usar no chat

1. No Inbox, no campo de mensagem, digite **/**
2. Uma lista de atalhos aparece
3. Selecione o desejado ou continue digitando para filtrar
4. O texto e automaticamente inserido no campo de mensagem
5. Voce pode editar antes de enviar

### Gerenciar

- **Editar**: Clique no icone de lapis ao lado da resposta
- **Excluir**: Selecione uma ou mais respostas e clique em **Excluir selecionados**
- **Selecao em massa**: Use os checkboxes para selecionar varias e deletar de uma vez

> As respostas rapidas sao organizadas por projeto. Ao trocar de projeto, as respostas mudam.

---

## 9. Tarefas

Sistema de tarefas para organizar o trabalho da equipe.

### Abas

| Aba | O que mostra |
|-----|-------------|
| **Minhas** | Tarefas atribuidas a voce (pendentes) |
| **Do time** | Todas as tarefas pendentes da equipe |
| **Concluidas** | Historico de tarefas finalizadas |

### Criar tarefa

1. Va em **Tarefas** no menu lateral
2. Clique em **"+ Nova Tarefa"**
3. Preencha:
   - **Titulo**: Descricao curta da tarefa
   - **Descricao**: Detalhes adicionais
   - **Contato relacionado** (opcional): Vincule a um contato
   - **Responsavel**: Quem deve executar
   - **Data de vencimento**: Prazo
   - **Prioridade**: Alta (vermelho), Media (amarelo), Baixa (verde)
4. Clique em **Salvar**

### Visualizacoes

- **Lista**: Tabela com checkbox, titulo, contato, responsavel, prazo, prioridade
- **Calendario**: Grade mensal com tarefas coloridas por prioridade

### Acoes

- **Concluir**: Clique no checkbox da tarefa para marcar como concluida
- **Editar**: Clique na tarefa para abrir o modal de edicao
- **Excluir**: Clique no icone de lixeira

> Tarefas atrasadas aparecem com destaque no **sino de notificacoes** no topo.

---

## 10. Chatbot / Dialogos

O chatbot permite criar fluxos automatizados de atendimento.

### Conceitos

| Conceito | Descricao |
|----------|-----------|
| **Fluxo** | Um conjunto de nos conectados que formam uma conversa automatica |
| **No (Node)** | Uma acao individual dentro do fluxo (mensagem, condicao, etc.) |
| **Trigger** | O que dispara o fluxo (palavra-chave, horario, etc.) |

### Criar um fluxo

1. Va em **Chatbot** no menu lateral
2. Clique em **"+ Novo Fluxo"**
3. Escolha:
   - **Em branco**: Comece do zero
   - **Template**: Use um modelo pronto (boas-vindas, ausencia, etc.)
4. De um nome ao fluxo

### Editor de fluxo

O editor visual permite arrastar e conectar nos:

#### Tipos de nos

| Tipo | Icone | Funcao |
|------|-------|--------|
| **Mensagem** | Balao | Envia uma mensagem de texto ao cliente |
| **Condicao** | Losango | Verifica uma condicao (if/else) para direcionar o fluxo |
| **Acao** | Engrenagem | Executa uma acao (enviar, delegar, etc.) |
| **Delay** | Relogio | Aguarda X segundos antes de continuar |
| **Fechar Chat** | X | Encerra a conversa automaticamente |
| **Webhook** | Globo | Chama uma API externa |
| **NPS** | Estrela | Envia pesquisa de satisfacao ao cliente |

#### Como construir

1. Clique em **"+ Adicionar No"** para criar um no
2. Selecione o tipo de no
3. Configure o conteudo (texto da mensagem, tempo do delay, URL do webhook, etc.)
4. **Conecte os nos**: Arraste uma linha de um no para outro para criar a sequencia
5. O fluxo segue as conexoes de cima para baixo

### Triggers (Gatilhos)

Defina o que ativa o fluxo:

| Trigger | Exemplo |
|---------|---------|
| **Palavra-chave** | Cliente digita "preco" ou "orcamento" |
| **Horario** | Fora do horario comercial |
| **Status** | Quando conversa muda para "novo" |

### Ativar/Desativar

- Use o **toggle** ao lado do nome do fluxo para ativar ou desativar
- Fluxos desativados nao respondem automaticamente

### Organizar em pastas

- Crie pastas para agrupar fluxos por categoria
- Arraste fluxos para dentro das pastas

---

## 11. Campanhas

Envie mensagens em massa para grupos de contatos.

### Criar campanha

1. Va em **Campanhas** no menu lateral
2. Clique em **"+ Nova Campanha"**
3. Preencha:
   - **Nome**: Identificacao da campanha
   - **Descricao**: Objetivo da campanha
   - **Destinatarios**: Selecione por tag, contato individual ou status
   - **Mensagem**: Texto a ser enviado
   - **Agendamento** (opcional): Data e hora para envio automatico

### Gerenciar campanhas

| Acao | Descricao |
|------|-----------|
| **Executar** | Inicia o envio das mensagens |
| **Pausar** | Interrompe o envio (pode ser retomado) |
| **Retomar** | Continua o envio de onde parou |
| **Editar** | Altera configuracoes da campanha |
| **Excluir** | Remove a campanha |

> O sistema respeita limites de envio (rate limiting) para evitar bloqueio do numero no WhatsApp.

---

## 12. Funil (Pipeline)

O funil permite organizar contatos em etapas de um processo comercial.

### Estrutura

- **Funil**: Um pipeline com varias etapas (ex: "Vendas", "Pos-venda")
- **Etapa**: Uma fase do processo (ex: "Primeiro contato", "Proposta enviada", "Fechado")
- **Lead**: Um contato dentro de uma etapa

### Criar funil (Admin)

1. Va em **Funil** no menu lateral
2. Clique em **"+ Novo Funil"**
3. De um nome (ex: "Pipeline de Vendas")
4. Adicione as etapas desejadas

### Visao Kanban

Ao clicar em um funil, abre o **quadro Kanban**:

- Cada **coluna** e uma etapa do funil
- Cada **card** e um contato/lead
- **Arraste e solte** cards entre colunas para mover leads de etapa

### Acoes no Kanban

| Acao | Como fazer |
|------|-----------|
| **Mover lead** | Arraste o card para outra coluna |
| **Adicionar lead** | Clique em "+" na coluna > Busque o contato |
| **Remover lead** | Clique no X do card |
| **Renomear etapa** | Clique no nome da coluna para editar |
| **Reordenar etapas** | Arraste a coluna para mudar a ordem |
| **Excluir etapa** | Clique no icone de lixeira da coluna |

### Wave Chart

Na lista de funis, cada funil mostra um **grafico de onda** com a distribuicao de leads por etapa, facilitando a visualizacao do "afunilamento".

### Exportar

- Clique em **Exportar CSV** para baixar os dados do funil em planilha

---

## 13. Relatorios

Pagina de relatorios avancados para analise de atendimento.

### Filtros disponiveis

| Filtro | Opcoes |
|--------|--------|
| **Periodo** | Hoje, 7 dias, 30 dias, 90 dias, datas customizadas |
| **Agente** | Todos ou agente especifico (admin only) |
| **Status** | Novo, Em Atendimento, Aguardando, Fechado |
| **Numero WhatsApp** | Filtrar por numero de origem |
| **Tags (incluir)** | Mostrar apenas conversas com essas tags |
| **Tags (excluir)** | Esconder conversas com essas tags |
| **Funis (incluir)** | Mostrar apenas leads nesses funis |
| **Funis (excluir)** | Esconder leads nesses funis |
| **Busca** | Por nome ou telefone |

### Resultados

- **Tabela de Leads**: Contato, Telefone, Status, Agente, Tags, Funil, Data
- **Cards de Resumo por Agente**: Distribuicao de status por agente
- **Total de leads encontrados**
- Clique em qualquer lead para **abrir no Inbox**

### Exportar

- Clique em **Exportar CSV** para baixar os resultados filtrados

---

## 14. NPS (Satisfacao)

Meca a satisfacao dos clientes com pesquisas de NPS (Net Promoter Score).

### Como funciona

1. Quando uma conversa e marcada como **Resolvida**, o chatbot pode enviar automaticamente uma pesquisa de satisfacao
2. O cliente responde com uma nota de **1 a 5**
3. O sistema classifica:
   - **Promotores** (4-5): Clientes satisfeitos
   - **Neutros** (3): Clientes indiferentes
   - **Detratores** (1-2): Clientes insatisfeitos

### Visualizacao

- **Gauge Chart**: Semicirculo mostrando o NPS score (-100 a +100)
- **Donut Chart**: Proporcao de Promotores (verde), Neutros (amarelo), Detratores (vermelho)
- **Cards**: Total de respostas, % Promotores, % Neutros, % Detratores
- **Tabela**: Contato, Atendente, Nota, Comentario, Data

### Filtros

- Periodo: 7 dias, 30 dias, 90 dias

### Calculo do NPS

```
NPS = (% Promotores - % Detratores)
```

| Faixa | Classificacao |
|-------|--------------|
| 75 a 100 | Excelente |
| 50 a 74 | Muito bom |
| 0 a 49 | Razoavel |
| -100 a -1 | Critico |

---

## 15. Celulares WhatsApp (Integracoes)

Gerencie os numeros de WhatsApp conectados ao CRM.

### Estrutura

Os numeros sao organizados por **departamento > projeto**:

1. Selecione o **departamento** na lista
2. Selecione o **projeto**
3. Veja os **numeros** associados

### Legenda de Status

| Cor | Status | Descricao |
|-----|--------|-----------|
| Verde | Conectado | Chip online e operacional |
| Vermelho | Desconectado | Chip offline, necessita reconexao |
| Amarelo (pulsante) | Verificando | Checando status do chip |

### Adicionar numero

1. Clique em **"+ Adicionar Numero"**
2. Informe o **nome do aparelho** (ex: "Vendas - Principal")
3. Clique em **Adicionar**
4. **Escaneie o QR Code** com o WhatsApp do celular
5. Aguarde a conexao ser estabelecida

### Acoes por numero

| Acao | Descricao |
|------|-----------|
| **Editar** | Alterar nome, configuracoes |
| **Conectar QR** | Escanear QR Code para reconectar |
| **Sincronizar** | Atualizar numero do telefone detectado |
| **Desconectar** | Desativar o numero (mantendo configuracao) |
| **Excluir** | Remover o numero permanentemente |

### Configuracao avancada (Evolution API)

Para integracao manual com Evolution API:

- **URL da API**: Endereco do servidor Evolution
- **API Key**: Chave de acesso global
- **Nome da instancia**: Identificador unico

### Gerenciar usuarios do projeto

- Clique em **"Usuarios"** para ver/adicionar agentes ao projeto
- Apenas agentes do projeto receberao conversas daquele numero

---

## 16. Configuracoes (Usuarios)

Area administrativa para gerenciar a equipe.

### Aba Empresa

- **Logo**: Alterar logotipo da empresa
- **Nome**: Nome exibido no sistema

### Aba Usuarios

#### Criar usuario

1. Clique em **"+ Novo Usuario"**
2. Preencha: Email, Nome, Papel (admin/supervisor/agente)
3. O usuario recebera um email com os dados de acesso

#### Gerenciar permissoes

Clique em um usuario para editar suas **permissoes granulares**:

| Categoria | Permissoes |
|-----------|-----------|
| **Tags** | Visualizar, atribuir, remover, criar, deletar |
| **Campanhas** | Visualizar, criar, pausar, retomar |
| **Relatorios** | Acesso geral, chats, graficos, mensagens, notas, usuarios, chatbot, dialogos |
| **NPS** | Visualizar, criar, editar, envio manual |
| **Arquivos** | Enviar, legendar, taguear, deletar |
| **Telefones** | Visualizar, vincular |
| **Usuarios** | Visualizar, criar, atribuir |
| **Funis** | Visualizar, criar, editar, mover chats |
| **Chatbot** | Editar dialogos, deletar dialogos |

### Aba Departamentos

- **Criar departamento**: Nome do setor (ex: "Vendas", "Suporte")
- **Editar**: Renomear departamento
- **Excluir**: Remover departamento (cuidado: afeta projetos associados)

---

## 17. Modulos

Gerencie quais modulos estao ativos no seu CRM.

### Modulos disponiveis

| Modulo | Categoria | Status |
|--------|-----------|--------|
| Agendamento de Mensagens | Atendimento | Ativo |
| NPS | Atendimento | Ativo |
| Funil Inteligente | Vendas | Ativo |
| API de Integracao | Integracoes | Ativo |
| Relatorios Graficos | Relatorios | Ativo |
| Adicionar Chat | Atendimento | Disponivel |
| Rodizio de Atendimento | Atendimento | Disponivel |
| Campos Personalizados | Contatos | Disponivel |

> Para ativar modulos adicionais, entre em contato com o suporte.

---

## 18. Suporte

### Canais de atendimento

| Canal | Descricao |
|-------|-----------|
| Documentacao | Wiki com artigos e tutoriais |
| Videos | Treinamentos em video |
| Chat | Conversa direta com suporte |
| Email | Suporte por email |

### Horario de atendimento

Segunda a Sexta, das 9h as 18h.

### Perguntas frequentes (FAQ)

1. **Como conectar o WhatsApp?**
   Va em Celulares WhatsApp > Adicione um numero > Escaneie o QR Code

2. **Como criar respostas automaticas fora do horario?**
   Va em Chatbot > Crie um fluxo > Configure trigger "Fora do horario"

3. **Como exportar contatos?**
   Va em Contatos > Aplique filtros desejados > Clique em "Exportar"

4. **Como configurar o NPS?**
   Va em Chatbot > Adicione um no "NPS" no fluxo > Ative o fluxo

5. **Como transferir um chat?**
   No Inbox > Abra a conversa > Menu "Mais Opcoes" > Delegar

6. **Como criar tags?**
   Va em Tags > "+ Nova Tag" > Preencha nome e cor

---

## 19. Papeis e Permissoes

### Papeis

| Papel | Descricao | Acesso |
|-------|-----------|--------|
| **Admin** | Acesso total ao sistema | Todas as paginas e funcionalidades |
| **Supervisor** | Gestao da equipe | Maioria das paginas (sem config de sistema) |
| **Agente** | Atendimento ao cliente | Inbox (apenas seus chats), Tarefas, Contatos |

### O que cada papel ve

| Funcionalidade | Admin | Supervisor | Agente |
|---------------|-------|-----------|--------|
| Dashboard completo | Sim | Sim | Apenas "Meu Painel" |
| Analise Avancada | Sim | Nao | Nao |
| Inbox (todos os chats) | Sim | Sim | Apenas seus chats |
| Contatos | Sim | Sim | Sim (seu projeto) |
| Campanhas | Sim | Com permissao | Nao |
| Chatbot | Sim | Com permissao | Nao |
| Relatorios | Sim | Com permissao | Nao |
| Tags | Sim | Com permissao | Nao |
| NPS | Sim | Com permissao | Nao |
| Respostas Rapidas | Sim | Sim | Sim |
| Tarefas | Sim | Sim | Sim |
| Funil | Sim | Com permissao | Com permissao |
| Celulares WhatsApp | Sim | Nao | Nao |
| Configuracoes | Sim | Nao | Nao |
| Modulos | Sim | Nao | Nao |

---

## 20. Dicas e Atalhos

### Atalhos do teclado

| Atalho | Acao |
|--------|------|
| **Enter** | Enviar mensagem no chat |
| **Shift + Enter** | Quebra de linha no chat |
| **/** | Abrir respostas rapidas |
| **Esc** | Fechar modais e paineis |

### Dicas de produtividade

1. **Use respostas rapidas** para mensagens repetitivas — economiza tempo
2. **Congele a lista** quando estiver atendendo — evita perder a posicao
3. **Use tags** para categorizar leads — facilita filtragem posterior
4. **Configure chatbots** para fora do horario — seus clientes nunca ficam sem resposta
5. **Verifique o Dashboard** no inicio do dia — entenda o cenario antes de comecar
6. **Use o Funil** para acompanhar vendas — visualize onde cada lead esta
7. **Crie tarefas** para follow-ups — nao esqueca de retornar ao cliente
8. **Marque como "nao lido"** conversas que precisa retornar — serve como lembrete visual
9. **Exporte relatorios** periodicamente — mantenha historico fora do sistema
10. **Acompanhe o NPS** — entenda a satisfacao dos seus clientes

### Boas praticas de atendimento

- Responda rapidamente — o tempo de primeira resposta impacta a experiencia
- Use status corretamente: **Aberto** (em atendimento), **Pendente** (aguardando retorno do cliente), **Resolvido** (problema resolvido)
- Adicione **anotacoes** para contexto interno — ajuda outros agentes
- Nao acumule conversas em "Aberto" — resolva ou mude o status
- Use **tags** consistentemente — facilita relatorios

---

## Glossario

| Termo | Significado |
|-------|-----------|
| **Lead** | Um contato/potencial cliente |
| **Conversa** | Uma thread de mensagens com um contato |
| **Agente** | Membro da equipe que atende clientes |
| **Tag** | Etiqueta colorida para categorizar |
| **Funil** | Pipeline de etapas para acompanhar leads |
| **NPS** | Net Promoter Score — metrica de satisfacao |
| **Chatbot** | Atendente automatico com respostas programadas |
| **Trigger** | Gatilho que ativa um fluxo de chatbot |
| **Webhook** | Chamada a uma API externa |
| **Rate Limiting** | Limite de envio para evitar bloqueio |
| **RLS** | Row Level Security — seguranca de dados por usuario |
| **Evolution API** | Provedor de integracao WhatsApp via QR Code |

---

*ALL-IN CRM v1.0 — Documento gerado em 26/03/2026*
