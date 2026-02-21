
# Correções: Filtro do Inbox, Agendamento e Melhorias de UX

## Problemas Identificados

1. **Inbox mostra conversas fechadas/em atendimento misturadas** -- O `InboxPage` inicializa `filters` como `{}` (sem status), trazendo todas as conversas. Deveria ser `{ status: 'open' }`.

2. **Botão de agendar mensagem não funciona** -- O `ScheduleMessageButton` esta dentro de um `Tooltip` que envolve o `PopoverTrigger`. O Tooltip intercepta o clique e impede o Popover de abrir. Precisa reestruturar para que o Popover funcione corretamente.

3. **Filtros avancados: ao aplicar, limpa o status da aba** -- Quando o usuario clica "Aplicar" nos filtros avancados, o `handleApplyFilters` cria um objeto `newFilters` sem preservar o status da aba atual (`activeStatus`). Isso faz o filtro resetar e mostrar tudo.

---

## Plano de Implementacao

### 1. Inbox: filtro inicial com status 'open'

**Arquivo:** `src/pages/Inbox.tsx` (linha 20)

Mudar `useState<...>({})` para `useState<...>({ status: 'open' })` para que o Inbox abra mostrando apenas conversas em atendimento.

### 2. Corrigir botao de agendamento (Popover nao abre)

**Arquivo:** `src/components/inbox/ChatPanel.tsx` (linhas 152-196)

O problema e que o `PopoverTrigger` esta dentro de um `TooltipTrigger`, e ambos tentam controlar o mesmo botao. A solucao e remover o Tooltip do trigger ou usar uma abordagem diferente:

- Remover o `Tooltip`/`TooltipTrigger`/`TooltipContent` que envolve o `PopoverTrigger`
- Deixar apenas o `Popover` + `PopoverTrigger` com o botao de relogio
- Adicionar um `title` HTML simples no botao para manter a dica visual

### 3. Filtros avancados preservam o status ativo

**Arquivo:** `src/components/inbox/ConversationList.tsx` (funcao `handleApplyFilters`)

Quando o usuario aplica filtros avancados sem selecionar um status especifico no dropdown, o status da aba ativa (`activeStatus`) deve ser preservado. Modificar `handleApplyFilters` para incluir:

```text
if (!localStatus || localStatus === 'todos') {
  // manter o status da aba ativa
  newFilters.status = activeStatus as any;
} else {
  newFilters.status = localStatus as any;
}
```

---

## Detalhes Tecnicos

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/Inbox.tsx` | Linha 20: `{}` para `{ status: 'open' }` |
| `src/components/inbox/ChatPanel.tsx` | Reestruturar ScheduleMessageButton removendo Tooltip do PopoverTrigger |
| `src/components/inbox/ConversationList.tsx` | handleApplyFilters preserva status da aba ativa |
