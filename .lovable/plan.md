

# Redesign do Chatbot - Estilo Guru

## O que muda

A tela do chatbot vai ganhar um layout mais completo e visual, inspirado na interface do Guru que voce mostrou. As principais mudancas sao:

### Layout em 3 colunas
- **Coluna esquerda**: Lista de acoes/etapas do fluxo com badges coloridas por tipo
- **Coluna central**: Area de configuracao da etapa selecionada, com secoes organizadas (Funil, Tags, Delegar, etc.)
- **Coluna direita**: Painel de canais (WhatsApp, etc.) com toggles Liga/Desliga e modo Manual/Automatico

### Novos tipos de etapa (acoes)
Alem dos tipos existentes (mensagem, menu, coleta de dados, IA, transferir, condicao de horario), vamos adicionar:
- **Aplicar Tag**: Seleciona tags existentes para aplicar automaticamente ao contato
- **Mover para Funil**: Move o contato para uma etapa especifica de um funil
- **Delegar Chat**: Delega a conversa para um usuario ou departamento especifico, com opcao de rodizio

### Editor visual inline (sem modal)
Em vez de abrir um modal para editar cada etapa, a configuracao aparece diretamente na coluna central quando voce clica em uma acao na lista da esquerda - igual ao Guru.

### Painel de canais
Na coluna direita, cada canal conectado (ex: WhatsApp) mostra:
- Toggle Ligado/Desligado
- Modo: Manual ou Automatico

## Detalhes Tecnicos

### Novas colunas no banco
- Tabela `chatbot_nodes`: Os novos tipos de no (`apply_tag`, `move_to_funnel`, `delegate`) serao tratados pelo campo `config` JSONB, sem precisar alterar o enum. Vamos usar os valores existentes do `node_type` como TEXT, adicionando os novos tipos.
- Tabela `chatbot_flows`: Adicionar coluna `channels` (JSONB) para guardar configuracao de canais (ligado/desligado, manual/automatico).

### Migracao SQL
```sql
-- Adicionar coluna de canais ao fluxo
ALTER TABLE chatbot_flows ADD COLUMN IF NOT EXISTS channels jsonb DEFAULT '{}';

-- Permitir novos node_types (apply_tag, move_to_funnel, delegate)
-- Como node_type e text sem constraint, basta usar os novos valores
```

### Componentes alterados
1. **`FlowEditor.tsx`**: Refatorado para layout 3 colunas (lista | config | canais)
2. **`NodeCard.tsx`**: Simplificado para item de lista com badge colorida e nome
3. **`NodeEditModal.tsx`**: Substituido por um painel inline (`NodeConfigPanel.tsx`) que renderiza na coluna central
4. **Novo `ChannelPanel.tsx`**: Coluna direita com toggles por canal
5. **`NodeConfigPanel.tsx`**: Novo componente que mostra a configuracao da etapa selecionada inline, com secoes para Tag, Funil, Delegacao conforme o tipo

### Cores dos badges por tipo
- Encerramento: vermelho
- Campanha: cinza
- Indicacao: azul
- Acao Comercial: preto
- Tag: multicolorido
- Funil: verde
- Delegar: amarelo

### Integracao com dados existentes
- Tags: Usa o hook `useTags()` para listar tags disponiveis
- Funis: Usa o `FunnelContext` para listar funis e etapas
- Usuarios/Departamentos: Usa `useTeamProfiles()` para listar membros do time

