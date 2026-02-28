import { useState, useEffect, useRef } from 'react';
import {
  Building2, Users, Save, Plus, ImageIcon,
  Shield, Eye, Headphones, Lock, Trash2, Tag as TagIcon, Layers,
  Pencil, Clock, EyeOff, CheckSquare, Square, RotateCcw, XCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/StatusBadge';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';
import { useTeamProfiles, type TeamMember } from '@/hooks/useTeamProfiles';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import { useDepartments, useCreateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import { useTags, useCreateTag, useDeleteTag, useUpdateTag } from '@/hooks/useTags';
import { useProjects } from '@/hooks/useProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

// ─── Constants ────────────────────────────────────────────────────────────────

const roleLabels: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', agent: 'Agente' };

const roleDescriptions = [
  { role: 'Admin', icon: Shield, desc: 'Acesso total ao sistema. Gerencia usuários, configurações e todas as áreas.' },
  { role: 'Supervisor', icon: Eye, desc: 'Visualiza relatórios, gerencia equipe e monitora conversas em tempo real.' },
  { role: 'Agente', icon: Headphones, desc: 'Atende conversas, gerencia contatos atribuídos e cria tarefas.' },
];

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#06b6d4',
];

const WEEK_DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const FULL_PERMISSION_GROUPS = [
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

// Keep backward-compat alias for places that still reference PERMISSION_GROUPS
const PERMISSION_GROUPS = FULL_PERMISSION_GROUPS;
const ALL_PERMISSION_KEYS = FULL_PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

type AccessHours = {
  enabled: boolean;
  intervals: { start: string; end: string }[];
  blocked_days: number[];
};

type EditableUser = {
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

const DEFAULT_ACCESS_HOURS: AccessHours = { enabled: false, intervals: [{ start: '08:00', end: '18:00' }], blocked_days: [] };

// ─── EditUserModal ─────────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved, roundRobinMode, teamMembers }: {
  user: EditableUser;
  onClose: () => void;
  onSaved: () => void;
  roundRobinMode: 'weight' | 'percentage';
  teamMembers: EditableUser[];
}) {
  const [tab, setTab] = useState<'dados' | 'permissoes' | 'acesso' | 'rodizio'>('dados');
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditableUser>({ ...user });
  const { data: integrations = [] } = useIntegrations();
  const { data: departments = [] } = useDepartments();
  const [userDeptIds, setUserDeptIds] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('profile_departments')
      .select('department_id')
      .eq('profile_id', user.id)
      .then(({ data }) => setUserDeptIds((data ?? []).map(r => r.department_id)));
  }, [user.id]);

  const allSelected = ALL_PERMISSION_KEYS.every(k => form.custom_permissions[k]);

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach(k => { next[k] = !allSelected; });
    setForm(f => ({ ...f, custom_permissions: next }));
  };

  const togglePerm = (key: string) => {
    setForm(f => ({
      ...f,
      custom_permissions: { ...f.custom_permissions, [key]: !f.custom_permissions[key] },
    }));
  };

  const addInterval = () => {
    setForm(f => ({
      ...f,
      access_hours: {
        ...f.access_hours,
        intervals: [...f.access_hours.intervals, { start: '08:00', end: '18:00' }],
      },
    }));
  };

  const removeInterval = (idx: number) => {
    setForm(f => ({
      ...f,
      access_hours: {
        ...f.access_hours,
        intervals: f.access_hours.intervals.filter((_, i) => i !== idx),
      },
    }));
  };

  const updateInterval = (idx: number, field: 'start' | 'end', value: string) => {
    setForm(f => ({
      ...f,
      access_hours: {
        ...f.access_hours,
        intervals: f.access_hours.intervals.map((iv, i) => i === idx ? { ...iv, [field]: value } : iv),
      },
    }));
  };

  const toggleBlockedDay = (day: number) => {
    setForm(f => {
      const days = f.access_hours.blocked_days;
      return {
        ...f,
        access_hours: {
          ...f.access_hours,
          blocked_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day],
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: profileErr } = await supabase.from('profiles').update({
        name: form.name,
        display_name: form.display_name || null,
        spy_mode: form.spy_mode,
        access_hours: form.access_hours,
        custom_permissions: form.custom_permissions,
        is_active: form.is_active,
        round_robin_weight: form.round_robin_weight,
        allowed_integration_ids: form.allowed_integration_ids && form.allowed_integration_ids.length > 0
          ? form.allowed_integration_ids
          : null,
      }).eq('id', form.id);

      if (profileErr) throw profileErr;

      // Update user role via SECURITY DEFINER RPC — bypasses RLS on user_roles.
      // The function enforces admin-only access and same-company validation server-side.
      const newRole = form.role as 'admin' | 'supervisor' | 'agent';
      const { error: roleErr } = await supabase.rpc('admin_set_user_role', {
        target_user_id: form.id,
        new_role: newRole,
      });
      if (roleErr) throw roleErr;

      // Save profile_departments — delete all then re-insert selected
      const { error: deptDelErr } = await supabase.from('profile_departments' as any)
        .delete()
        .eq('profile_id', form.id);
      if (deptDelErr) throw deptDelErr;

      if (userDeptIds.length > 0) {
        const { error: deptInsErr } = await supabase.from('profile_departments' as any)
          .insert(userDeptIds.map(did => ({ profile_id: form.id, department_id: did })));
        if (deptInsErr) throw deptInsErr;
      }

      toast.success('Usuário atualizado com sucesso!');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = form.role === 'admin';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Editar Usuário — {user.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as any)}>
          <TabsList className="grid grid-cols-4 w-full h-9 text-xs">
            <TabsTrigger value="dados" className="text-xs">Dados</TabsTrigger>
            <TabsTrigger value="permissoes" className="text-xs">Permissões</TabsTrigger>
            <TabsTrigger value="acesso" className="text-xs">Acesso</TabsTrigger>
            <TabsTrigger value="rodizio" className="text-xs">Rodízio</TabsTrigger>
          </TabsList>

          {/* ── Dados ── */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome visível para cliente</Label>
              <Input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Como aparece na assinatura das mensagens"
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">Aparece como assinatura nas mensagens enviadas ao cliente.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={form.email} disabled className="h-9 opacity-60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cargo</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-xs">Admin — acesso total</SelectItem>
                  <SelectItem value="supervisor" className="text-xs">Supervisor</SelectItem>
                  <SelectItem value="agent" className="text-xs">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Departamentos */}
            {departments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Departamentos</Label>
                <p className="text-[11px] text-muted-foreground">Sem seleção = Admin vê tudo. Supervisores/Agentes devem ter ao menos um departamento.</p>
                <div className="space-y-1.5">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-2.5">
                      <Checkbox
                        id={`dept-${dept.id}`}
                        checked={userDeptIds.includes(dept.id)}
                        onCheckedChange={(c) => {
                          setUserDeptIds(prev =>
                            c ? [...prev, dept.id] : prev.filter(id => id !== dept.id)
                          );
                        }}
                      />
                      <label htmlFor={`dept-${dept.id}`} className="text-sm cursor-pointer select-none">{dept.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Usuário ativo</p>
                <p className="text-xs text-muted-foreground">Desativar impede login sem excluir o histórico</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </TabsContent>

          {/* ── Permissões ── */}
          <TabsContent value="permissoes" className="mt-4 space-y-4">
            {isAdmin ? (
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4">
                <Shield size={18} className="text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Administrador</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Admins têm acesso total a todos os recursos. Permissões individuais não se aplicam.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Summary of active permissions */}
                <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {ALL_PERMISSION_KEYS.filter(k => form.custom_permissions[k]).length} de {ALL_PERMISSION_KEYS.length} permissões ativas
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setPermissionsDialogOpen(true)}
                >
                  <Shield size={15} />
                  Configurar permissões detalhadas
                </Button>
              </>
            )}
          </TabsContent>

          {/* ── Acesso ── */}
          <TabsContent value="acesso" className="mt-4 space-y-5">
            {/* Modo Espião */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
              <div className="flex items-start gap-3">
                <EyeOff size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Modo Espião</p>
                  <p className="text-xs text-muted-foreground">Impede remoção automática de notificações não lidas — ideal para supervisores monitorarem atendimentos discretamente.</p>
                </div>
              </div>
              <Switch
                checked={form.spy_mode}
                onCheckedChange={v => setForm(f => ({ ...f, spy_mode: v }))}
              />
            </div>

            {/* Números WhatsApp permitidos */}
            {integrations.length > 0 && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Números WhatsApp permitidos</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sem seleção = acesso a todos os números. Selecione para restringir.</p>
                </div>
                <div className="space-y-1.5">
                  {integrations.map(intg => {
                    const checked = form.allowed_integration_ids?.includes(intg.id) ?? false;
                    return (
                      <label key={intg.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-accent/30 px-1 py-0.5 rounded">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setForm(f => {
                              const current = f.allowed_integration_ids ?? [];
                              return {
                                ...f,
                                allowed_integration_ids: c
                                  ? [...current, intg.id]
                                  : current.filter(id => id !== intg.id),
                              };
                            });
                          }}
                        />
                        <span className="text-sm select-none">
                          {intg.phone_number || intg.device_name}
                          {intg.phone_number && intg.device_name && (
                            <span className="text-xs text-muted-foreground ml-1.5">({intg.device_name})</span>
                          )}
                        </span>
                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${intg.status === 'connected' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {intg.status === 'connected' ? 'Conectado' : intg.status}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {(form.allowed_integration_ids?.length ?? 0) > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => setForm(f => ({ ...f, allowed_integration_ids: null }))}
                  >
                    Limpar restrição (liberar todos)
                  </button>
                )}
              </div>
            )}

            {/* Horário de Acesso */}
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-muted-foreground" />
                  <p className="text-sm font-medium">Restringir horário de acesso</p>
                </div>
                <Switch
                  checked={form.access_hours.enabled}
                  onCheckedChange={v => setForm(f => ({ ...f, access_hours: { ...f.access_hours, enabled: v } }))}
                />
              </div>

              {form.access_hours.enabled && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Intervalos de acesso permitido</p>
                    {form.access_hours.intervals.map((iv, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10">Início</span>
                        <Input
                          type="time"
                          value={iv.start}
                          onChange={e => updateInterval(idx, 'start', e.target.value)}
                          className="h-8 w-28 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">Fim</span>
                        <Input
                          type="time"
                          value={iv.end}
                          onChange={e => updateInterval(idx, 'end', e.target.value)}
                          className="h-8 w-28 text-xs"
                        />
                        {form.access_hours.intervals.length > 1 && (
                          <button onClick={() => removeInterval(idx)} className="text-muted-foreground hover:text-destructive">
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    {form.access_hours.intervals.length < 2 && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 mt-1" onClick={addInterval}>
                        <Plus size={12} /> Adicionar intervalo
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Dias bloqueados (sem acesso)</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEK_DAYS.map(d => {
                        const blocked = form.access_hours.blocked_days.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            onClick={() => toggleBlockedDay(d.value)}
                            className={`h-8 w-10 rounded-md text-xs font-medium border transition-colors ${
                              blocked
                                ? 'bg-destructive/10 border-destructive/40 text-destructive'
                                : 'bg-secondary border-border text-muted-foreground hover:border-primary hover:text-primary'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Dias em vermelho = bloqueados. O usuário será desconectado automaticamente fora dos horários permitidos.</p>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ── Rodízio ── */}
          <TabsContent value="rodizio" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw size={15} className="text-muted-foreground" />
                <p className="text-sm font-medium">Rodízio de Atendimento</p>
              </div>
              {roundRobinMode === 'percentage' ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Defina a porcentagem de atendimentos que este usuário deve receber. A soma de todos os usuários deve ser 100%.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Porcentagem (%)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={form.round_robin_weight}
                        onChange={e => setForm(f => ({ ...f, round_robin_weight: Math.min(100, Math.max(1, Number(e.target.value))) }))}
                        className="h-9 w-24"
                      />
                      <span className="text-sm font-medium text-foreground">%</span>
                    </div>
                  </div>
                  {/* Preview: soma das % do time */}
                  {(() => {
                    const others = teamMembers.filter(m => m.id !== user.id);
                    const othersSum = others.reduce((s, m) => s + (m.round_robin_weight || 1), 0);
                    const total = othersSum + form.round_robin_weight;
                    const ok = total === 100;
                    return (
                      <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${ok ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        <span>{ok ? '✓' : '⚠'} Soma do time: <strong>{total}%</strong> {ok ? '— Distribuição correta' : `— Faltam ${100 - total}% para completar 100%`}</span>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    O peso define quantas vezes este usuário aparece na fila. Peso 3 recebe 3× mais atendimentos que peso 1.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Peso na fila (1–10)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={form.round_robin_weight}
                        onChange={e => setForm(f => ({ ...f, round_robin_weight: Math.min(10, Math.max(1, Number(e.target.value))) }))}
                        className="h-9 w-24"
                      />
                      <span className="text-xs text-muted-foreground">
                        {form.round_robin_weight === 1 ? 'Distribuição padrão' : `${form.round_robin_weight}× mais atendimentos`}
                      </span>
                    </div>
                  </div>
                  {/* Preview: % efetiva deste agente no time */}
                  {(() => {
                    const others = teamMembers.filter(m => m.id !== user.id);
                    const totalWeight = others.reduce((s, m) => s + (m.round_robin_weight || 1), 0) + form.round_robin_weight;
                    const pct = Math.round((form.round_robin_weight / totalWeight) * 100);
                    return (
                      <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
                        <span>Este usuário receberá ~<strong>{pct}%</strong> dos atendimentos do time</span>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Full Permissions Dialog ── */}
        {permissionsDialogOpen && (
          <Dialog open onOpenChange={() => setPermissionsDialogOpen(false)}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw]">
              <DialogHeader>
                <DialogTitle>Nível / Permissões — {user.name}</DialogTitle>
              </DialogHeader>

              {/* Top: level select + select all */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Nível:</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="h-8 px-2 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="admin">Admin (acesso total)</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="agent">Normal (Permissões personalizadas)</option>
                  </select>
                </div>
                {!isAdmin && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={ALL_PERMISSION_KEYS.every(k => form.custom_permissions[k])}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-xs font-medium">Selecionar todas as permissões</span>
                  </label>
                )}
              </div>

              {isAdmin ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4 my-4">
                  <Shield size={18} className="text-primary shrink-0" />
                  <p className="text-sm text-muted-foreground">Admins têm acesso total. Permissões individuais não se aplicam.</p>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {/* Groups col=1 and col=2 rendered side by side */}
                  {(() => {
                    const col1 = FULL_PERMISSION_GROUPS.filter(g => g.col === 1);
                    const col2 = FULL_PERMISSION_GROUPS.filter(g => g.col === 2);
                    const fullWidth = FULL_PERMISSION_GROUPS.filter(g => g.col === 0);
                    const maxRows = Math.max(col1.length, col2.length);
                    const paired: [typeof col1[0] | null, typeof col2[0] | null][] = Array.from({ length: maxRows }, (_, i) => [col1[i] ?? null, col2[i] ?? null]);

                    const renderGroup = (g: typeof FULL_PERMISSION_GROUPS[0]) => (
                      <div key={g.group} className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 mb-2">{g.group}</p>
                        <div className="space-y-1.5">
                          {g.items.map(item => (
                            <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 px-1 py-0.5 rounded transition-colors">
                              <Checkbox
                                checked={!!form.custom_permissions[item.key]}
                                onCheckedChange={() => togglePerm(item.key)}
                              />
                              <span className="text-xs select-none">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-5">{col1.map(renderGroup)}</div>
                          <div className="space-y-5">{col2.map(renderGroup)}</div>
                        </div>
                        {fullWidth.map(g => (
                          <div key={g.group} className="border-t border-border pt-5">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 mb-3">{g.group}</p>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                              {g.items.map(item => (
                                <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 px-1 py-0.5 rounded transition-colors">
                                  <Checkbox
                                    checked={!!form.custom_permissions[item.key]}
                                    onCheckedChange={() => togglePerm(item.key)}
                                  />
                                  <span className="text-xs select-none">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}

              <DialogFooter className="mt-4 sticky bottom-0 bg-background pt-3 border-t border-border">
                <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={() => setPermissionsDialogOpen(false)}>Confirmar permissões</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const permissions = usePermissions();
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const manageTooltip = getPermissionTooltip('canManageUsers', permissions);
  const [activeTab, setActiveTab] = useState('empresa');

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: '', password: '', showPassword: false });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);

  // Edit modal
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);

  // Real data hooks
  const { data: teamMembers, isLoading: loadingTeam } = useTeamProfiles();
  const { data: company, isLoading: loadingCompany } = useCompany();
  const updateCompany = useUpdateCompany();
  const { data: allIntegrations = [] } = useIntegrations();

  // Departments
  const { data: departments = [], isLoading: loadingDepts } = useDepartments();
  const createDept = useCreateDepartment();
  const deleteDept = useDeleteDepartment();
  const [newDeptName, setNewDeptName] = useState('');
  const [confirmDeleteDeptId, setConfirmDeleteDeptId] = useState<string | null>(null);
  const confirmDeleteDeptName = departments.find(d => d.id === confirmDeleteDeptId)?.name ?? '';

  // Tags
  const { data: tags = [], isLoading: loadingTags } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const updateTag = useUpdateTag();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagDeptId, setNewTagDeptId] = useState<string>('');
  const [newTagProjectId, setNewTagProjectId] = useState('');
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string; department_id?: string; project_id?: string | null } | null>(null);
  const { data: newTagDeptProjects = [] } = useProjects(newTagDeptId || undefined);
  const { data: editTagProjects = [] } = useProjects(editingTag?.department_id || undefined);

  // Departamentos: expandir para ver usuários
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [deptMembersMap, setDeptMembersMap] = useState<Record<string, string[]>>({});

  const toggleDeptExpand = async (deptId: string) => {
    if (expandedDeptId === deptId) { setExpandedDeptId(null); return; }
    setExpandedDeptId(deptId);
    if (!deptMembersMap[deptId]) {
      const { data } = await supabase.from('profile_departments' as any).select('profile_id').eq('department_id', deptId);
      setDeptMembersMap(prev => ({ ...prev, [deptId]: (data ?? []).map((r: any) => r.profile_id) }));
    }
  };

  const [companyName, setCompanyName] = useState('');
  const [roundRobinMode, setRoundRobinMode] = useState<'weight' | 'percentage'>('weight');
  const [priorityOnline, setPriorityOnline] = useState(false);
  useEffect(() => {
    if (company?.name && !companyName) setCompanyName(company.name);
    if ((company as any)?.round_robin_mode) setRoundRobinMode((company as any).round_robin_mode);
    if (typeof (company as any)?.priority_online_agents === 'boolean') setPriorityOnline((company as any).priority_online_agents);
  }, [company]);

  const validateInvite = () => {
    const e: Record<string, string> = {};
    if (!invite.name.trim()) e.name = 'Obrigatório';
    if (!invite.email.trim()) e.email = 'Obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) e.email = 'Email inválido';
    if (!invite.role) e.role = 'Obrigatório';
    if (invite.password && invite.password.length < 6) e.password = 'Mínimo 6 caracteres';
    setInviteErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleInvite = async () => {
    if (!validateInvite()) return;
    setInviting(true);
    try {
      const resp = await supabase.functions.invoke('invite-user', {
        body: { name: invite.name, email: invite.email, role: invite.role, password: invite.password || undefined },
      });
      if (resp.error) throw new Error(resp.error.message);
      const result = resp.data as any;
      if (result.error) throw new Error(result.error);
      toast.success(`Usuário ${invite.email} criado com sucesso!`);
      setInviteOpen(false);
      setInvite({ name: '', email: '', role: '', password: '', showPassword: false });
      setInviteErrors({});
    } catch (err: any) {
      toast.error(err.message || 'Erro ao convidar usuário');
    } finally {
      setInviting(false);
    }
  };

  const handleSaveCompany = () => {
    if (!companyName.trim()) return;
    updateCompany.mutate({ name: companyName.trim(), round_robin_mode: roundRobinMode, priority_online_agents: priorityOnline });
  };

  const handleCreateDept = () => {
    if (!newDeptName.trim()) return;
    createDept.mutate(newDeptName.trim(), { onSuccess: () => setNewDeptName('') });
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    if (departments.length > 0 && !newTagDeptId) {
      toast.error('Selecione um departamento para a tag');
      return;
    }
    createTag.mutate({ name: newTagName.trim(), color: newTagColor, department_id: newTagDeptId || null as any, project_id: newTagProjectId || null }, {
      onSuccess: () => { setNewTagName(''); setNewTagColor(TAG_COLORS[0]); setNewTagDeptId(''); setNewTagProjectId(''); },
    });
  };

  const handleSaveTagEdit = () => {
    if (!editingTag) return;
    updateTag.mutate({ id: editingTag.id, name: editingTag.name, color: editingTag.color, department_id: editingTag.department_id, project_id: (editingTag as any).project_id || null }, {
      onSuccess: () => setEditingTag(null),
    });
  };

  const openEditUser = (u: TeamMember) => {
    setEditingUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      display_name: u.display_name ?? '',
      spy_mode: u.spy_mode,
      access_hours: u.access_hours,
      custom_permissions: u.custom_permissions,
      is_active: u.is_active,
      round_robin_weight: u.round_robin_weight,
      last_seen_at: u.last_seen_at,
      status: u.status,
      allowed_integration_ids: (u as any).allowed_integration_ids ?? null,
    });
  };

  const formatLastSeen = (ts: string | null) => {
    if (!ts) return '—';
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'Agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="mx-auto max-w-4xl h-[calc(100vh-7rem)] -m-4 lg:-m-6 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card px-4 py-2 shrink-0">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="empresa" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Building2 size={14} /> Empresa
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Users size={14} /> Usuários
            </TabsTrigger>
            <TabsTrigger value="departamentos" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Layers size={14} /> Departamentos
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <TagIcon size={14} /> Tags
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">

          {/* ===== EMPRESA ===== */}
          <TabsContent value="empresa" className="mt-0 space-y-6">
            <div className="rounded-xl border border-border bg-card card-shadow p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Dados da Empresa</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <ImageIcon size={24} className="text-muted-foreground" />
                </div>
                <div>
                  <Button variant="outline" size="sm" className="text-xs">Alterar logo</Button>
                  <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>
              {loadingCompany ? (
                <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome da empresa</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="bg-secondary border-0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Plano</Label>
                    <Input value={company?.plan ?? 'free'} readOnly className="bg-secondary border-0 opacity-60 capitalize" />
                  </div>
                </div>
                </>
              )}
              <Button className="mt-5 gap-1.5" size="sm" onClick={handleSaveCompany} disabled={updateCompany.isPending || !permissions.canManageUsers}>
                <Save size={14} /> {updateCompany.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </TabsContent>

          {/* ===== USUÁRIOS ===== */}
          <TabsContent value="usuarios" className="mt-0 space-y-6">
            {!permissions.canManageUsers && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                <Lock size={14} className="text-warning shrink-0" />
                <p className="text-xs text-warning">Você não tem permissão para gerenciar usuários.</p>
              </div>
            )}
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Membros da equipe</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Clique em um usuário para editar permissões, horários e configurações.</p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" className="gap-1.5 h-8" onClick={() => setInviteOpen(true)} disabled={!permissions.canManageUsers}>
                        <Plus size={14} /> Convidar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {manageTooltip && <TooltipContent><p className="text-xs">{manageTooltip}</p></TooltipContent>}
                </Tooltip>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Cargo</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Visto por último</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Números</th>
                    <th className="px-4 py-2.5 w-16 text-right text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTeam ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : (teamMembers ?? []).map(u => (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => { if (permissions.canManageUsers) openEditUser(u); }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          {u.display_name && (
                            <p className="text-[11px] text-muted-foreground">"{u.display_name}"</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{roleLabels[u.role] ?? u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={u.status as 'online' | 'ausente' | 'offline'} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {formatLastSeen(u.last_seen_at)}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {(() => {
                          const ids = (u as any).allowed_integration_ids as string[] | null;
                          if (!ids || ids.length === 0) {
                            return <span className="text-xs text-muted-foreground">Todos</span>;
                          }
                          const phones = allIntegrations.filter(i => ids.includes(i.id));
                          return (
                            <div className="flex flex-wrap gap-1">
                              {phones.map(p => (
                                <span key={p.id} className="text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground">
                                  {p.phone_number || p.device_name}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {permissions.canManageUsers && (
                            <>
                              <button
                                onClick={() => openEditUser(u)}
                                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                title="Editar usuário"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Excluir ${u.name}?\n\nO usuário será removido permanentemente do sistema.`)) return;
                                  try {
                                    const resp = await supabase.functions.invoke('delete-user', {
                                      body: { user_id: u.id, hard_delete: true },
                                    });
                                    if (resp.error) throw new Error(resp.error.message);
                                    const result = resp.data as any;
                                    if (result?.error) throw new Error(result.error);
                                    qc.invalidateQueries({ queryKey: ['team-profiles'] });
                                    toast.success(`${u.name} excluído com sucesso`);
                                  } catch (err: any) {
                                    toast.error(err.message || 'Erro ao excluir usuário');
                                  }
                                }}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                title="Excluir usuário"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cargo descriptions */}
            <div className="rounded-xl border border-border bg-card card-shadow p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Descrição dos cargos</h3>
              <div className="space-y-3">
                {roleDescriptions.map(r => (
                  <div key={r.role} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <r.icon size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.role}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodízio de Atendimento */}
            <div className="rounded-xl border border-border bg-card card-shadow p-6 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Rodízio de Atendimento</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Defina como novos leads são distribuídos entre os agentes. O peso/porcentagem de cada agente é configurado no perfil do usuário (aba Rodízio).
              </p>
              {loadingCompany ? (
                <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Modo de distribuição</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRoundRobinMode('weight')}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${roundRobinMode === 'weight' ? 'border-primary bg-primary/5' : 'border-border bg-secondary hover:border-primary/50'}`}
                      >
                        <p className={`text-xs font-semibold ${roundRobinMode === 'weight' ? 'text-primary' : 'text-foreground'}`}>Por Peso</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Peso 1–10. Peso 3 recebe 3× mais que peso 1.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoundRobinMode('percentage')}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${roundRobinMode === 'percentage' ? 'border-primary bg-primary/5' : 'border-border bg-secondary hover:border-primary/50'}`}
                      >
                        <p className={`text-xs font-semibold ${roundRobinMode === 'percentage' ? 'text-primary' : 'text-foreground'}`}>Por Porcentagem</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Defina qual % de leads cada agente recebe (soma = 100%).</p>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Priorizar agentes online</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Distribui novos leads para agentes ativos nos últimos 5 minutos. Se nenhum online, distribui normalmente.
                      </p>
                    </div>
                    <Switch checked={priorityOnline} onCheckedChange={setPriorityOnline} />
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={handleSaveCompany} disabled={updateCompany.isPending || !permissions.canManageUsers}>
                    <Save size={14} /> {updateCompany.isPending ? 'Salvando...' : 'Salvar configuração'}
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          {/* ===== DEPARTAMENTOS ===== */}
          <TabsContent value="departamentos" className="mt-0 space-y-6">
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Departamentos</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Organize sua equipe em departamentos para roteamento de chats.</p>
                </div>
              </div>

              <div className="px-4 py-3 border-b border-border bg-secondary/20">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do departamento (ex: Vendas, Suporte, Financeiro)"
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateDept()}
                    className="flex-1 bg-background border-border h-8 text-sm"
                  />
                  <Button size="sm" className="h-8 gap-1.5" onClick={handleCreateDept} disabled={!newDeptName.trim() || createDept.isPending}>
                    <Plus size={14} /> Criar
                  </Button>
                </div>
              </div>

              {loadingDepts ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : departments.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nenhum departamento criado ainda.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {departments.map(d => {
                    const isExpanded = expandedDeptId === d.id;
                    const memberIds = deptMembersMap[d.id];
                    const deptUsers = isExpanded && memberIds
                      ? (teamMembers ?? []).filter(m => memberIds.includes(m.id))
                      : [];
                    return (
                      <div key={d.id}>
                        <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors">
                          <button
                            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                            onClick={() => toggleDeptExpand(d.id)}
                          >
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Layers size={14} className="text-primary" />
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">{d.name}</span>
                            {isExpanded
                              ? <ChevronDown size={14} className="text-muted-foreground ml-1 shrink-0" />
                              : <ChevronRight size={14} className="text-muted-foreground ml-1 shrink-0" />
                            }
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => setConfirmDeleteDeptId(d.id)}
                            disabled={deleteDept.isPending}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 bg-secondary/20">
                            {!memberIds ? (
                              <p className="text-xs text-muted-foreground italic py-2">Carregando...</p>
                            ) : deptUsers.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic py-2">Nenhum usuário neste departamento.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {deptUsers.map(u => (
                                  <div key={u.id} className="flex items-center gap-1.5 rounded-full bg-card border border-border px-2.5 py-1">
                                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                                      {(u.display_name || u.name || 'U').slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-xs text-foreground">{u.display_name || u.name}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{roleLabels[u.role] ?? u.role}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ConfirmDialog — excluir departamento */}
          <Dialog open={!!confirmDeleteDeptId} onOpenChange={v => { if (!v) setConfirmDeleteDeptId(null); }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Excluir departamento</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir o departamento <strong>{confirmDeleteDeptName}</strong>?
                Esta ação também removerá todos os projetos e integrantes vinculados a ele.
              </p>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setConfirmDeleteDeptId(null)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  disabled={deleteDept.isPending}
                  onClick={() => {
                    if (confirmDeleteDeptId) deleteDept.mutate(confirmDeleteDeptId);
                    setConfirmDeleteDeptId(null);
                  }}
                >
                  {deleteDept.isPending ? 'Excluindo...' : 'Excluir'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ===== TAGS ===== */}
          <TabsContent value="tags" className="mt-0 space-y-6">
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold text-foreground">Tags</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Crie tags coloridas para categorizar contatos e conversas.</p>
              </div>

              <div className="px-4 py-3 border-b border-border bg-secondary/20 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da tag"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                    className="flex-1 bg-background border-border h-8 text-sm"
                  />
                  <Button size="sm" className="h-8 gap-1.5" onClick={handleCreateTag} disabled={!newTagName.trim() || createTag.isPending}>
                    <Plus size={14} /> Criar
                  </Button>
                </div>
                {departments.length > 0 && (
                  <Select value={newTagDeptId} onValueChange={(v) => { setNewTagDeptId(v); setNewTagProjectId(''); }}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border">
                      <SelectValue placeholder="Departamento *" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {newTagDeptId && newTagDeptProjects.length > 0 && (
                  <Select value={newTagProjectId || '_none'} onValueChange={v => setNewTagProjectId(v === '_none' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border">
                      <SelectValue placeholder="Projeto (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Todos os projetos</SelectItem>
                      {newTagDeptProjects.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className="h-6 w-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: newTagColor === c ? '#fff' : 'transparent',
                        boxShadow: newTagColor === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {loadingTags ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : tags.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nenhuma tag criada ainda.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tags.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-sm font-medium text-foreground">{t.name}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ backgroundColor: t.color + '20', borderColor: t.color + '60', color: t.color }}
                        >
                          {t.name}
                        </Badge>
                        {t.department_id && (
                          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {departments.find(d => d.id === t.department_id)?.name ?? '—'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setEditingTag({ id: t.id, name: t.name, color: t.color })}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTag.mutate(t.id)}
                          disabled={deleteTag.isPending}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

        </div>
      </Tabs>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['team-profiles'] })}
          roundRobinMode={roundRobinMode}
          teamMembers={(teamMembers ?? []) as EditableUser[]}
        />
      )}

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={() => { setInviteOpen(false); setInviteErrors({}); setInvite({ name: '', email: '', role: '', password: '', showPassword: false }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} placeholder="Nome completo" className={`mt-1 ${inviteErrors.name ? 'border-destructive' : ''}`} />
              {inviteErrors.name && <p className="text-xs text-destructive mt-1">{inviteErrors.name}</p>}
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="email@empresa.com" className={`mt-1 ${inviteErrors.email ? 'border-destructive' : ''}`} />
              {inviteErrors.email && <p className="text-xs text-destructive mt-1">{inviteErrors.email}</p>}
            </div>
            <div>
              <Label className="text-xs">Cargo *</Label>
              <Select value={invite.role} onValueChange={v => setInvite({ ...invite, role: v })}>
                <SelectTrigger className={`mt-1 ${inviteErrors.role ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Selecionar cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                </SelectContent>
              </Select>
              {inviteErrors.role && <p className="text-xs text-destructive mt-1">{inviteErrors.role}</p>}
            </div>
            <div>
              <Label className="text-xs">Senha <span className="text-muted-foreground">(opcional — gerada automaticamente se vazia)</span></Label>
              <div className="relative mt-1">
                <Input
                  type={invite.showPassword ? 'text' : 'password'}
                  value={invite.password}
                  onChange={e => setInvite({ ...invite, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className={inviteErrors.password ? 'border-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setInvite(i => ({ ...i, showPassword: !i.showPassword }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {invite.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {inviteErrors.password && <p className="text-xs text-destructive mt-1">{inviteErrors.password}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteErrors({}); setInvite({ name: '', email: '', role: '', password: '', showPassword: false }); }}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag modal */}
      <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Editar Tag</DialogTitle></DialogHeader>
          {editingTag && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={editingTag.name}
                  onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              {departments.length > 0 && (
                <div>
                  <Label className="text-xs">Departamento</Label>
                  <Select
                    value={editingTag.department_id || '_none'}
                    onValueChange={v => setEditingTag({ ...editingTag, department_id: v === '_none' ? undefined : v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sem departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem departamento</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {editingTag.department_id && editTagProjects.length > 0 && (
                <div>
                  <Label className="text-xs">Projeto <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Select
                    value={(editingTag as any).project_id || '_none'}
                    onValueChange={v => setEditingTag({ ...editingTag, project_id: v === '_none' ? null : v } as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos os projetos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Todos os projetos</SelectItem>
                      {editTagProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs mb-2 block">Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditingTag({ ...editingTag, color: c })}
                      className="h-7 w-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: c,
                        borderColor: editingTag.color === c ? '#fff' : 'transparent',
                        boxShadow: editingTag.color === c ? `0 0 0 2px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)}>Cancelar</Button>
            <Button onClick={handleSaveTagEdit} disabled={updateTag.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
