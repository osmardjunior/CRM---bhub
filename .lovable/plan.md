

# Celulares - Gerenciamento de Multiplos Numeros WhatsApp

## Visao Geral

Transformar a pagina de Integracoes em um sistema completo de gerenciamento de "Celulares" (aparelhos/numeros WhatsApp), similar ao Guru. Atualmente o sistema suporta apenas uma integracao WhatsApp. O novo sistema permitira cadastrar e gerenciar multiplos numeros de WhatsApp, cada um como um "aparelho" independente com seu proprio provedor, credenciais e configuracoes.

## O que muda para o usuario

### Pagina "Celulares" (antes "Integracoes")
- Titulo muda para "Celulares" com subtitulo "Nesta area estao listados todos os aparelhos da sua conta"
- Grid de cards, um por numero cadastrado, mostrando:
  - Nome do aparelho (editavel, ex: "TIPSPLACE - 2410")
  - Numero de telefone formatado (ex: +55 (31) 92692410)
  - Status de conexao (badge Conectado/Desconectado)
  - Provedor utilizado (Meta Cloud API, Twilio, 360dialog, Gupshup)
  - Botao "Desativar" para desconectar
  - Opcao "Restringir usuarios que podem adicionar chats" (toggle)
- Botao "Adicionar Aparelho" no topo para cadastrar novo numero

### Modal de cadastro de novo aparelho
- Nome do aparelho (texto livre)
- Numero de telefone
- Selecao de provedor (Meta Cloud API, Twilio, 360dialog, Gupshup)
- Campos dinamicos conforme provedor:
  - **Meta**: Access Token + Phone Number ID
  - **Twilio**: Account SID + Auth Token + From Number
  - **360dialog**: API Key
  - **Gupshup**: API Key + App Name
- Webhook URL para copiar

### Secao "Informacoes da API"
- Status da API (Ativa/Inativa)
- Webhook URL (endpoint do incoming-message)
- Chave de seguranca (webhook secret - apenas exibicao parcial)
- Lista de IDs dos aparelhos cadastrados com seus numeros

### Ajustes no modelo de dados
A tabela `integrations` atual armazena uma unica integracao por canal. Para suportar multiplos numeros no mesmo canal, cada registro representara um "aparelho" individual.

## Detalhes Tecnicos

### Alteracao na tabela integrations
Adicionar colunas para suportar multiplos aparelhos:

```text
ALTER TABLE integrations ADD COLUMN phone_number TEXT;
ALTER TABLE integrations ADD COLUMN device_name TEXT DEFAULT '';
ALTER TABLE integrations ADD COLUMN restrict_users UUID[] DEFAULT '{}';
```

Isso permite que existam multiplos registros com `channel = 'whatsapp'`, cada um representando um numero/aparelho diferente.

### Provedor Gupshup
Adicionar suporte ao provedor Gupshup no edge function `send-whatsapp`:
- Endpoint: `https://api.gupshup.io/wa/api/v1/msg`
- Headers: `apikey` com a chave da API
- Body: `channel=whatsapp&source=<from>&destination=<to>&message={"type":"text","text":"<body>"}`

### Arquivos que serao modificados

1. **`src/pages/Integracoes.tsx`** - Redesign completo: grid de cards de aparelhos, modal de adicao, secao de info da API
2. **`src/hooks/useIntegrations.ts`** - Ajustar para suportar multiplos registros por canal (add device, remove device, update device)
3. **`supabase/functions/send-whatsapp/index.ts`** - Adicionar suporte ao provedor Gupshup
4. **`supabase/functions/incoming-message/index.ts`** - Ajustar para identificar qual aparelho recebeu a mensagem (via phone_number_id ou parametro)

### Arquivo de migracao

1. **`supabase/migrations/xxx_integrations_multi_device.sql`** - Adicionar colunas `phone_number`, `device_name`, `restrict_users` na tabela integrations

### Fluxo do usuario

1. Acessa /integracoes e ve a lista de aparelhos cadastrados (cards)
2. Clica "Adicionar Aparelho"
3. Preenche nome, numero, seleciona provedor e insere credenciais
4. Salva - aparece como novo card na grid
5. Pode desativar ou editar cada aparelho individualmente
6. Na secao inferior, ve as informacoes da API (webhook URL, IDs dos aparelhos)

### Integracao com o fluxo existente

- O `send-whatsapp` ja busca a integracao por `company_id + channel + status=connected`. Com multiplos aparelhos, a selecao do aparelho sera feita pelo `phone_number` do contato ou pelo primeiro aparelho disponivel
- O `incoming-message` continuara funcionando normalmente - cada mensagem recebida ja identifica o `company_id` e cria/encontra o contato pelo telefone

