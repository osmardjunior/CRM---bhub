
# Melhorias nas Acoes de Tag e Delegar - Estilo Guru

## O que sera feito

### 1. Acao "Aplicar Tag" - Melhorias visuais
A secao de tags ja funciona, mas vamos melhorar o visual para ficar mais proximo do Guru:
- Tags exibidas como blocos coloridos maiores (nao apenas badges pequenos), ocupando a largura total em grid de 3 colunas
- Checkbox visivel em cada tag para indicar selecao
- Cores de fundo fortes nas tags (como no Guru) em vez de apenas bordas coloridas

### 2. Acao "Delegar Chat" - Funcionalidades novas
Adicionar funcionalidades que existem no Guru mas faltam no sistema atual:

**Secao de Usuarios:**
- Lista de usuarios do time com checkbox para selecionar multiplos (nao apenas um select dropdown)
- Exibir role ao lado do nome (ADMIN, NORMAL)
- Opcao "Remover outros usuarios delegados" (checkbox)

**Secao de Departamentos:**
- Novo conceito de "departamentos" - como nao existe tabela de departamentos no banco, vamos criar uma
- Select/lista para escolher departamentos
- Opcao "Remover outros grupos delegados" (checkbox)

**Secao de Rodizio:**
- "Ativar Rodizio no Departamento" (toggle)
- Sub-opcao "Delegar apenas para um usuario deste departamento (nao sera delegado para o departamento)"
- Sub-opcao "Dar preferencia para quem estiver online"

## Detalhes Tecnicos

### Nova tabela: departments
```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RLS policies similares as demais tabelas da empresa
```

### Alteracoes no NodeConfigPanel.tsx
- **apply_tag**: Redesenhar para grid de tags coloridas com checkboxes, visual mais parecido com Guru
- **delegate**: Expandir para 3 secoes (Usuarios, Departamentos, Rodizio) com checkboxes multiplos e opcoes adicionais

### Config JSONB atualizado para delegate
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "remove_other_users": true,
  "department_ids": ["uuid1"],
  "remove_other_departments": true,
  "round_robin": true,
  "round_robin_single_user": true,
  "prefer_online": true
}
```

### Novo hook: useDepartments.ts
- CRUD para departamentos
- Usado no NodeConfigPanel e futuramente em outras partes do sistema

### Arquivos que serao criados
- `supabase/migrations/xxx_departments.sql` - Tabela de departamentos
- `src/hooks/useDepartments.ts` - Hook para CRUD de departamentos

### Arquivos que serao modificados
- `src/components/chatbot/NodeConfigPanel.tsx` - Redesign das secoes apply_tag e delegate
- `src/integrations/supabase/types.ts` - Atualizado automaticamente
