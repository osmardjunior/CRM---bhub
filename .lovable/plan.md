

# Comparativo: Seu CRM vs ChatGuru -- O que tem e o que falta

## Legenda
- [OK] = Ja implementado e funcional
- [PARCIAL] = Existe mas incompleto
- [FALTA] = Nao implementado

---

## MODULO: CHATS (Inbox)

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Lista de conversas com busca | [OK] | Busca por nome e telefone |
| Filtros avancados (tags, usuario, canal, status) | [PARCIAL] | Filtros existem na UI mas maioria nao aplica no backend (so canal funciona) |
| Abas de status (Aberto/Pendente/Fechado) | [OK] | 3 status implementados |
| Separacao Individual vs Grupo | [OK] | Detecta grupos por JID |
| Foto de perfil do contato | [OK] | avatar_url implementado |
| Renderizacao de midia (audio, imagem, video, sticker) | [OK] | MessageBubble implementado |
| Atribuicao de agente | [OK] | Select com onValueChange |
| Troca de status no header | [OK] | Dropdown Em Atendimento/Aguardando/Fechar |
| Tags no contato via painel lateral | [OK] | Popover com checkboxes |
| Respostas rapidas | [PARCIAL] | Lista fixa hardcoded, nao usa tabela quick_replies do banco |
| Anotacoes internas (visivel so pra equipe) | [FALTA] | Guru tem campo de anotacoes internas com @mencoes |
| Agendamento de mensagens | [FALTA] | Guru permite agendar envio para data/hora futura |
| Gravacao de audio no compositor | [FALTA] | Botao de mic existe mas nao funciona |
| Envio de arquivos/imagens pelo compositor | [FALTA] | Botao de clipe existe mas nao funciona |
| Emojis picker | [FALTA] | Botao de smile existe mas nao funciona |
| Responder mensagem especifica (reply) | [FALTA] | Guru tem reply com citacao |
| Reacoes a mensagens | [FALTA] | Guru tem reacoes com emoji |
| Historico de midias/documentos (aba lateral) | [FALTA] | Guru tem aba separada com todas midias da conversa |
| Motivo de fechamento com dialog | [OK] | Modal com select de motivos |
| Reabertura automatica ao receber msg | [OK] | incoming-message reabri conversas fechadas |
| Transferencia entre departamentos | [FALTA] | Guru permite transferir para departamento |
| Indicador de digitando | [FALTA] | Status de "digitando..." |
| Leitura de msgs (visto/entregue) | [FALTA] | Checkmarks tipo WhatsApp |
| Timer de atendimento (SLA) | [FALTA] | Guru mostra tempo em cada status |

## MODULO: CONTATOS

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Lista com busca e filtros | [OK] | Busca, filtro por tag e origem |
| Painel de detalhes lateral | [OK] | ContactDetailPanel |
| Criar/editar contato | [OK] | Modal de novo contato |
| Import/Export CSV | [OK] | Importar e exportar implementados |
| Tags no contato | [OK] | Via painel lateral |
| Responsavel (agente) | [OK] | Campo responsible_user_id |
| Campos personalizados (ficha cadastral) | [FALTA] | Guru tem campos custom (texto, email, data, numero) |
| Historico de atendimentos do contato | [FALTA] | Guru mostra todas conversas anteriores |
| Funil vinculado ao contato | [FALTA] | Guru mostra em qual etapa do funil o contato esta |
| Bloqueio de contato | [FALTA] | Guru permite bloquear contato |
| Merge de contatos duplicados | [FALTA] | Guru tem deteccao e merge |

## MODULO: FUNIS / PIPELINE

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Kanban de negocios | [OK] | FunnelKanban com drag-and-drop |
| Multiplos funis | [OK] | Tabela funnels + funnel_stages |
| Criar/editar etapas | [OK] | Customizacao de etapas |
| Vincular contato ao negocio | [OK] | contact_id no deal |
| Mover contato entre etapas via chat | [FALTA] | Guru permite mover contato de etapa direto do chat |
| Automacoes por mudanca de etapa | [FALTA] | Guru envia msg automatica ao mudar etapa |

## MODULO: CHATBOT / DIALOGOS

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Fluxos de chatbot | [OK] | Editor de fluxo com nos |
| Tipos de no (mensagem, condicao, acao) | [OK] | chatbot_nodes |
| Configuracoes (horario, msg offline) | [OK] | FlowSettings |
| Instrucoes de IA | [OK] | Campo ai_instructions |
| Simulador de fluxo | [PARCIAL] | FlowSimulator existe mas funcionalidade limitada |
| Chatbot com IA generativa (respostas inteligentes) | [FALTA] | Guru usa IA pra responder perguntas nao previstas |
| Webhook/integracao externa nos nos | [FALTA] | Guru permite chamar APIs externas no fluxo |

## MODULO: CAMPANHAS

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Criar campanhas | [OK] | CRUD completo |
| Filtros de publico | [OK] | Campo filters na campanha |
| Agendamento | [OK] | schedule_at |
| Janela de envio (horarios) | [OK] | send_window |
| Pular fins de semana | [OK] | skip_weekends |
| Progresso (processados/total) | [OK] | Campos processed/total_contacts |
| Templates de mensagem | [FALTA] | Guru usa templates pre-aprovados do WhatsApp |
| Preview da mensagem | [FALTA] | Guru mostra preview antes de enviar |
| Relatorio de entrega da campanha | [FALTA] | Guru mostra taxa de entrega, leitura, resposta |

## MODULO: RELATORIOS

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Relatorios de chats | [OK] | ReportBuilder com filtros |
| Relatorios de usuarios | [OK] | UsersReportPanel |
| Graficos | [OK] | ChartsPanel com recharts |
| Salvar relatorios | [OK] | saved_reports |
| NPS / Pesquisa de satisfacao | [OK] | satisfaction_surveys |
| Relatorio de tempo medio de resposta | [FALTA] | Guru mostra TMA por agente |
| Relatorio de primeiro tempo de resposta | [FALTA] | Guru mostra tempo da primeira resposta |
| Exportar relatorio em PDF | [FALTA] | Guru exporta relatorios |

## MODULO: CONFIGURACOES

| Funcionalidade | Status | Detalhes |
|---|---|---|
| Dados da empresa | [OK] | Nome e plano |
| Gestao de usuarios (convidar, roles) | [OK] | Admin/Supervisor/Agente |
| Integracoes (Evolution API) | [OK] | QR Code, status |
| Departamentos | [OK] | Tabela departments |
| Horario de atendimento | [PARCIAL] | Existe nos flows do chatbot, nao global |
| Mensagem de ausencia global | [FALTA] | Guru tem msg de ausencia configuravel |
| Distribuicao automatica de chats | [FALTA] | Guru distribui chats entre agentes automaticamente (round-robin) |
| Webhook configuravel | [FALTA] | Guru permite configurar webhooks de saida |
| Permissoes granulares por modulo | [FALTA] | Guru tem permissoes por funcionalidade, nao so por role |

---

## PRIORIDADES DE IMPLEMENTACAO

### Prioridade 1 -- Essencial (impacto direto no atendimento diario)

1. **Envio de arquivos/imagens pelo compositor** -- Botao de clipe funcional para enviar fotos, documentos, PDFs pelo chat
2. **Gravacao e envio de audio** -- Botao de mic funcional para gravar e enviar audios
3. **Respostas rapidas do banco** -- Conectar ao tabela quick_replies em vez de lista fixa
4. **Filtros avancados funcionais** -- Fazer os filtros de nome, telefone, tag, usuario, ordenacao realmente filtrarem as conversas
5. **Anotacoes internas** -- Campo de nota interna visivel apenas para a equipe, nao enviada ao cliente

### Prioridade 2 -- Importante (melhora produtividade)

6. **Distribuicao automatica de chats** -- Round-robin entre agentes online
7. **Transferencia entre departamentos** -- Permitir mover conversa para outro departamento
8. **Historico de atendimentos do contato** -- Ver conversas anteriores no painel lateral
9. **Campos personalizados no contato** -- Ficha cadastral com campos custom
10. **Timer de SLA** -- Mostrar tempo de espera e tempo de atendimento

### Prioridade 3 -- Diferencial (funcionalidades avancadas)

11. **Reply (responder mensagem especifica)** -- Citar mensagem anterior
12. **Emoji picker** -- Seletor de emojis no compositor
13. **Relatorios de TMA e primeiro tempo de resposta** -- Metricas de performance
14. **Mover contato de etapa do funil via chat** -- Acao rapida no painel lateral
15. **Chatbot com IA generativa** -- Respostas inteligentes baseadas em contexto

### Prioridade 4 -- Futuro (nice to have)

16. Agendamento de mensagens
17. Reacoes a mensagens
18. Indicador de digitando
19. Checkmarks de leitura/entrega
20. Merge de contatos duplicados
21. Templates de campanha do WhatsApp
22. Relatorios de campanha (entrega/leitura)
23. Export PDF de relatorios
24. Webhooks configuraveis de saida
25. Permissoes granulares por modulo

---

## Resumo quantitativo

| Categoria | OK | Parcial | Falta |
|---|---|---|---|
| Chats/Inbox | 11 | 2 | 13 |
| Contatos | 6 | 0 | 5 |
| Funis/Pipeline | 4 | 0 | 2 |
| Chatbot | 4 | 1 | 2 |
| Campanhas | 5 | 0 | 3 |
| Relatorios | 5 | 0 | 3 |
| Configuracoes | 4 | 1 | 4 |
| **Total** | **39** | **4** | **32** |

Aproximadamente 52% das funcionalidades da ChatGuru ja estao implementadas. As 32 funcionalidades faltantes estao priorizadas acima por impacto no dia a dia de atendimento.

