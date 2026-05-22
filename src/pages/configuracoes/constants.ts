import { Shield, Eye, Headphones } from 'lucide-react';

export const roleLabels: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', agent: 'Agente' };

export const roleDescriptions = [
  { role: 'Admin', icon: Shield, desc: 'Acesso total ao sistema. Gerencia usuários, configurações e todas as áreas.' },
  { role: 'Supervisor', icon: Eye, desc: 'Visualiza relatórios, gerencia equipe e monitora conversas em tempo real.' },
  { role: 'Agente', icon: Headphones, desc: 'Atende conversas, gerencia contatos atribuídos e cria tarefas.' },
];

export const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4',
];

export const WEEK_DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export const FULL_PERMISSION_GROUPS = [
  { group: 'Tags', col: 1, items: [
    { key: 'tags_view', label: 'Visualizar Tags' },
    { key: 'tags_assign', label: 'Atribuir Tag no chat' },
    { key: 'tags_remove', label: 'Retirar Tag do chat' },
    { key: 'tags_create', label: 'Criar' },
    { key: 'tags_delete', label: 'Apagar' },
  ]},
  { group: 'Usuários', col: 2, items: [
    { key: 'users_view', label: 'Ver Usuários' },
    { key: 'users_assign', label: 'Atribuir ao chat' },
    { key: 'users_create', label: 'Criar' },
    { key: 'users_delete', label: 'Apagar' },
  ]},
  { group: 'Arquivos', col: 1, items: [
    { key: 'files_send', label: 'Enviar/Criar' },
    { key: 'files_caption', label: 'Mudar descrição/legenda' },
    { key: 'files_tags', label: 'Alterar tags do arquivo' },
    { key: 'files_delete', label: 'Apagar' },
  ]},
  { group: 'Celulares', col: 2, items: [
    { key: 'phones_view', label: 'Visualizar os Celulares' },
    { key: 'phones_link', label: 'Link Distribuidor' },
  ]},
  { group: 'Login', col: 1, items: [
    { key: 'login_mobile', label: 'Permitir login através de dispositivos móveis' },
  ]},
  { group: 'Mensagens', col: 1, items: [
    { key: 'messages_schedule', label: 'Agendar Mensagem' },
    { key: 'messages_reload_recent', label: 'Recarregar Mensagens Recentes' },
    { key: 'messages_reload_old', label: 'Recarregar Mensagens Antigas (Só texto)' },
    { key: 'messages_reverify', label: 'Reverificar Mensagens Recentes Editadas' },
    { key: 'messages_template', label: 'Enviar Mensagens Template' },
  ]},
  { group: 'Funis', col: 2, items: [
    { key: 'funnels_view', label: 'Ver Funis' },
    { key: 'funnels_create', label: 'Criar Funis' },
    { key: 'funnels_delete', label: 'Apagar Funis' },
    { key: 'funnels_edit', label: 'Alterar Funis' },
    { key: 'funnels_move_chats', label: 'Adicionar/Mover Chats no Funil' },
    { key: 'funnels_export', label: 'Exportar Funil em CSV' },
  ]},
  { group: 'NPS', col: 1, items: [
    { key: 'nps_view', label: 'Ver NPS' },
    { key: 'nps_create', label: 'Criar NPS' },
    { key: 'nps_delete', label: 'Apagar NPS' },
    { key: 'nps_edit', label: 'Alterar NPS' },
    { key: 'nps_manual', label: 'Acionar NPS no Chat manualmente' },
    { key: 'nps_export', label: 'Exportar Respostas do NPS' },
  ]},
  { group: 'Campanhas', col: 2, items: [
    { key: 'campaigns_view', label: 'Ver Campanhas' },
    { key: 'campaigns_create', label: 'Criar Campanha' },
    { key: 'campaigns_pause', label: 'Pausar Campanha' },
    { key: 'campaigns_resume', label: 'Resumir/Iniciar Campanha' },
    { key: 'campaigns_delete', label: 'Apagar Campanha' },
  ]},
  { group: 'Relatórios — Anotações Internas', col: 1, items: [
    { key: 'reports_notes_view', label: 'Consultar/Ver' },
  ]},
  { group: 'Relatórios — Acessos', col: 1, items: [
    { key: 'reports_access_view', label: 'Consultar/Ver' },
  ]},
  { group: 'Relatórios — Chats Adicionados', col: 1, items: [
    { key: 'reports_chats_added_view', label: 'Consultar/Ver' },
    { key: 'reports_chats_added_delete', label: 'Apagar Registros' },
  ]},
  { group: 'Relatórios — Chats', col: 2, items: [
    { key: 'reports_chats_graphs', label: 'Ver Gráficos' },
    { key: 'reports_chats_view', label: 'Consultar/Ver' },
    { key: 'reports_chats_edit', label: 'Criar/Alterar' },
    { key: 'reports_chats_delete', label: 'Apagar' },
    { key: 'reports_chats_export', label: 'Exportar' },
  ]},
  { group: 'Relatórios — Mensagens', col: 2, items: [
    { key: 'reports_messages_view', label: 'Consultar/Ver' },
    { key: 'reports_messages_delete', label: 'Apagar Registros' },
  ]},
  { group: 'Relatórios — Diálogos', col: 1, items: [
    { key: 'reports_dialogs_view', label: 'Consultar/Ver' },
  ]},
  { group: 'Relatórios — Usuários', col: 2, items: [
    { key: 'reports_users_view', label: 'Consultar/Ver' },
  ]},
  { group: 'Relatórios — Chatbot', col: 2, items: [
    { key: 'reports_chatbot_view', label: 'Consultar/Ver' },
  ]},
  { group: 'Chatbot', col: 0, items: [
    { key: 'chatbot_edit_dialogs', label: 'Criar/Alterar Diálogos' },
    { key: 'chatbot_execute', label: 'Executar Diálogo' },
    { key: 'chatbot_process', label: 'Processamento da Mensagem' },
    { key: 'chatbot_add_example', label: 'Adicionar Exemplo' },
    { key: 'chatbot_reprocess', label: 'Reprocessar Mensagem' },
    { key: 'chatbot_approve', label: 'Aprovar Mensagem' },
    { key: 'chatbot_view_context', label: 'Ver Contexto' },
    { key: 'chatbot_delete_dialogs', label: 'Deletar Diálogos/Ações' },
  ]},
  { group: 'Chats', col: 0, items: [
    { key: 'chats_filter_user', label: 'Filtrar Chats por Usuário' },
    { key: 'chats_filter_name', label: 'Filtrar Chats por Nome' },
    { key: 'chats_filter_whatsapp', label: 'Filtrar Chats por WhatsApp' },
    { key: 'chats_filter_phone', label: 'Filtrar Chats por Celular' },
    { key: 'chats_filter_tag', label: 'Filtrar Chats por Tag' },
    { key: 'chats_filter_archived', label: 'Filtrar Chats Arquivados' },
    { key: 'chats_filter_broadcast', label: 'Filtrar Chats Broadcasts' },
    { key: 'chats_filter_unread', label: 'Filtrar Chats Não Lidos' },
    { key: 'chats_filter_funnel', label: 'Filtrar por Etapa do Funil' },
    { key: 'chats_filter_favorites', label: 'Filtrar Chats Favoritos' },
    { key: 'chats_sort', label: 'Ordenar Lista de Chats' },
    { key: 'chats_delegate', label: 'Delegar Chats' },
    { key: 'chats_rename', label: 'Mudar nome do Chat' },
    { key: 'chats_view_notes', label: 'Ver Anotações' },
    { key: 'chats_add_note', label: 'Adicionar anotação' },
    { key: 'chats_clear_chatbot', label: 'Apagar Contexto do Chatbot' },
    { key: 'chats_delete_own_note', label: 'Apagar própria anotação' },
    { key: 'chats_delete_any_note', label: 'Apagar qualquer anotação' },
    { key: 'chats_view_all', label: 'Ver Todos os Chats' },
    { key: 'chats_toggle_chatbot', label: 'Ligar/Desligar Chatbot p/ Chat' },
    { key: 'chats_archive', label: 'Arquivar/Desarquivar Chat' },
    { key: 'chats_view_whatsapp_number', label: 'Ver Número do WhatsApp' },
    { key: 'chats_reverify_read', label: 'Reverificar Leitura das Mensagens' },
    { key: 'chats_mark_unread', label: 'Marcar Chat Não Lido' },
    { key: 'chats_mark_read', label: 'Marcar Chat Como Lido' },
    { key: 'chats_reload', label: 'Recarregar Chats' },
    { key: 'chats_reload_profile_pic', label: 'Recarregar Foto de Perfil' },
    { key: 'chats_add', label: 'Adicionar Chats' },
    { key: 'chats_delete_all_messages', label: 'Apagar Todas as Mensagens do Chats' },
    { key: 'chats_view_delegate_history', label: 'Ver histórico de delegados do chat' },
    { key: 'chats_view_dept_delegated', label: 'Ver Chats Delegados ao Depto. que faz parte' },
  ]},
];

export const ALL_PERMISSION_KEYS = FULL_PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

export type AccessHours = {
  enabled: boolean;
  intervals: { start: string; end: string }[];
  blocked_days: number[];
};

export type EditableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  display_name: string;
  spy_mode: boolean;
  access_hours: AccessHours;
  custom_permissions: Record<string, boolean>;
  is_active: boolean;
  round_robin_weight: number;
  last_seen_at: string | null;
  status: string;
  allowed_integration_ids: string[] | null;
};

export const DEFAULT_ACCESS_HOURS: AccessHours = { enabled: false, intervals: [{ start: '08:00', end: '18:00' }], blocked_days: [] };

export function formatLastSeen(ts: string | null) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'Agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return d.toLocaleDateString('pt-BR');
}
