

# Chatbot Hibrido (Fluxo + IA)

## Visao Geral

O chatbot vai funcionar como um **construtor visual de dialogos** onde voce monta fluxos de atendimento com nos (etapas). Cada no pode ser uma mensagem automatica, uma pergunta ao cliente, ou uma chamada de IA para respostas inteligentes. Quando o bot nao resolve, ele transfere para um atendente humano.

## Como vai funcionar na pratica

1. **Voce acessa a pagina "Dialogos / Chatbot"** e ve a lista de fluxos criados (ou o estado vazio para criar o primeiro)
2. **Ao criar um novo fluxo**, voce define um nome (ex: "Atendimento Principal") e comeca a montar as etapas
3. **Cada etapa e um "no"** com um tipo:
   - **Mensagem**: Envia um texto automatico (ex: saudacao)
   - **Menu de opcoes**: Mostra botoes numerados para o cliente escolher (ex: "1 - Vendas, 2 - Suporte")
   - **Coleta de dados**: Pede informacoes ao cliente (nome, e-mail, telefone) e salva no contato
   - **Resposta IA**: Envia a mensagem do cliente para a IA responder com base em instrucoes que voce define
   - **Encaminhar para atendente**: Transfere a conversa para um membro do time
   - **Condicao de horario**: Verifica se esta dentro do horario de atendimento; se nao, envia mensagem de fora do horario
4. **Os nos se conectam em sequencia**, formando o caminho que o cliente percorre

## Estrutura da Pagina

A pagina tera 3 abas:

### Aba 1 - Meus Fluxos
- Lista de fluxos criados com nome, status (ativo/inativo) e data de criacao
- Botao "Criar novo fluxo"
- Toggle para ativar/desativar cada fluxo
- Apenas um fluxo pode estar ativo por vez

### Aba 2 - Editor de Fluxo (ao clicar em um fluxo)
- Lista vertical de etapas (nos) na ordem de execucao
- Botao "Adicionar etapa" entre cada no
- Cada etapa mostra seu tipo, conteudo resumido e botoes de editar/excluir/mover
- Modal de edicao ao clicar em uma etapa

### Aba 3 - Configuracoes Gerais
- **Horario de atendimento**: Dias da semana + hora inicio/fim
- **Mensagem fora do horario**: Texto personalizado
- **Instrucoes da IA**: Prompt base que define o comportamento da IA (ex: "Voce e um assistente de vendas da empresa X...")
- **Timeout**: Tempo de inatividade para encerrar conversa automaticamente

## Detalhes Tecnicos

### Banco de Dados - Novas tabelas

**chatbot_flows** - Armazena os fluxos
- id, company_id, name, is_active, business_hours (jsonb), offline_message, ai_instructions, timeout_minutes, created_at, updated_at

**chatbot_nodes** - Armazena as etapas de cada fluxo
- id, flow_id, company_id, position, node_type (enum: message, menu, collect_data, ai_response, transfer, condition), config (jsonb com conteudo especifico de cada tipo), created_at

O campo `config` (jsonb) armazena dados diferentes conforme o tipo:
- message: `{ "text": "Ola! Bem-vindo..." }`
- menu: `{ "text": "Escolha:", "options": [{"label": "Vendas", "next_position": 3}, ...] }`
- collect_data: `{ "fields": ["name", "email", "phone"], "prompt": "Por favor, informe seu nome:" }`
- ai_response: `{ "context": "instrucoes adicionais para esta etapa" }`
- transfer: `{ "message": "Transferindo para um atendente...", "assign_to": null }`
- condition: `{ "type": "business_hours", "on_true": 2, "on_false": 5 }`

### Edge Function - chatbot-process

Uma funcao backend que:
1. Recebe a mensagem do cliente
2. Busca o fluxo ativo da empresa
3. Determina em qual no o cliente esta (usando um campo de estado na conversa)
4. Executa a logica do no atual (envia mensagem, processa menu, chama IA, etc.)
5. Avanca para o proximo no

Para a parte de IA, usara o Lovable AI Gateway (google/gemini-3-flash-preview) com as instrucoes definidas pelo usuario.

### Frontend - Pagina /chatbot

- Componente principal: `ChatbotPage.tsx`
- Componentes auxiliares: `FlowList`, `FlowEditor`, `NodeCard`, `NodeEditModal`, `FlowSettings`
- Hook: `useChatbotFlows.ts` para CRUD dos fluxos e nos
- Rota ja existe no menu lateral, so precisa criar a pagina

### Sequencia de implementacao

1. Criar tabelas no banco (chatbot_flows e chatbot_nodes) com RLS
2. Criar a pagina com a lista de fluxos e estado vazio
3. Criar o modal/formulario para novo fluxo com configuracoes gerais
4. Criar o editor de etapas (adicionar, editar, excluir, reordenar nos)
5. Criar a edge function chatbot-process para processar mensagens
6. Integrar com Lovable AI para o no de "Resposta IA"

