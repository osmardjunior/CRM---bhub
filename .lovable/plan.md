

# Ajustes no Menu e Limpeza de Dados Fictícios

## 1. Mover Integrações e Tags para o menu lateral

Atualmente "Integrações" e "Tags" ficam como abas dentro de Configurações. Vamos criar duas páginas independentes e adicionar no menu da sidebar:

**Menu atualizado:**
- Dashboard
- Inbox
- Contatos
- Pipeline
- Tarefas
- Integrações (novo)
- Tags (novo)
- Configurações (fica só com Empresa + Usuários)

### O que será feito:
- Criar `src/pages/Integracoes.tsx` -- extrair todo o conteúdo da aba Integrações do Configurações para esta página
- Criar `src/pages/Tags.tsx` -- extrair todo o conteúdo da aba Tags do Configurações para esta página
- Adicionar rotas `/integracoes` e `/tags` no `App.tsx`
- Adicionar os dois itens no menu lateral em `AppLayout.tsx` com ícones Wifi e Tag
- Remover as abas "Integrações" e "Tags" de `Configuracoes.tsx` (ficam só Empresa e Usuários)

## 2. Apagar dados fictícios do banco

O banco tem dados de seed (provavelmente criados pela edge function `seed-data`):

| Tabela | Registros | Exemplo |
|--------|-----------|---------|
| contacts | 6 | Maria Lima, André Santos, Carla Ribeiro... |
| conversations | 4 | Conversas vinculadas aos contatos acima |
| messages | 8 | Mensagens fictícias nas conversas |
| deals | 0 | Limpo |
| tasks | 0 | Limpo |

Vou executar DELETE nas tabelas nesta ordem (respeitando dependências):
1. messages (depende de conversations)
2. conversation_reads (depende de conversations)
3. conversations (depende de contacts)
4. contacts

Depois de limpar, Inbox e Contatos vão mostrar o estado vazio com as mensagens "Nenhum contato" / "Nenhuma conversa".

## Detalhes técnicos

### Arquivos criados
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Integracoes.tsx` | Página com conteúdo da aba integrações (WhatsApp, canais futuros) |
| `src/pages/Tags.tsx` | Página com CRUD de tags da empresa |

### Arquivos alterados
| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rotas `/integracoes` e `/tags` |
| `src/components/AppLayout.tsx` | Adicionar itens Integrações e Tags no `navItems` |
| `src/pages/Configuracoes.tsx` | Remover abas Integrações e Tags, manter só Empresa e Usuários |

### Migration SQL
DELETE dos dados fictícios nas tabelas messages, conversation_reads, conversations e contacts (IDs com padrão `c0000000-*` e `d0000000-*`).

