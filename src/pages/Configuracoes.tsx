import { useState, useEffect } from 'react';
import {
  Building2, Users, Save, Plus, ImageIcon,
  Shield, Lock, Trash2, Tag as TagIcon, Layers,
  EyeOff, RotateCcw, ChevronRight, UserPlus, ChevronDown, UserCheck,
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

import EditUserInline from '@/components/configuracoes/EditUserInline';
import InviteUserDialog from '@/components/configuracoes/InviteUserDialog';
import EditTagDialog, { type EditingTag } from '@/components/configuracoes/EditTagDialog';
import {
  roleLabels, roleDescriptions, TAG_COLORS, DEFAULT_ACCESS_HOURS,
  formatLastSeen, type EditableUser,
} from '@/pages/configuracoes/constants';

export default function ConfiguracoesPage() {
  const permissions = usePermissions();
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const manageTooltip = getPermissionTooltip('canManageUsers', permissions);
  const [activeTab, setActiveTab] = useState('usuarios');

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);

  // Edit modal
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);

  // Real data hooks
  const { data: teamMembers, isLoading: loadingTeam } = useTeamProfiles(true);
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
  const [editingTag, setEditingTag] = useState<EditingTag | null>(null);
  const { data: newTagDeptProjects = [] } = useProjects(newTagDeptId || undefined);

  // Departamentos: expandir para ver usuários
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [deptMembersMap, setDeptMembersMap] = useState<Record<string, string[]>>({});
  const [managingDeptId, setManagingDeptId] = useState<string | null>(null);
  const [managingSaving, setManagingSaving] = useState(false);

  const toggleDeptExpand = async (deptId: string) => {
    if (expandedDeptId === deptId) { setExpandedDeptId(null); setManagingDeptId(null); return; }
    setExpandedDeptId(deptId);
    setManagingDeptId(null);
    if (!deptMembersMap[deptId]) {
      const { data } = await supabase.from('profile_departments').select('profile_id').eq('department_id', deptId);
      setDeptMembersMap(prev => ({ ...prev, [deptId]: (data ?? []).map((r) => r.profile_id) }));
    }
  };

  const toggleDeptMember = async (deptId: string, userId: string) => {
    const currentIds = deptMembersMap[deptId] ?? [];
    const isMember = currentIds.includes(userId);
    setManagingSaving(true);
    try {
      if (isMember) {
        await supabase.from('profile_departments').delete().eq('department_id', deptId).eq('profile_id', userId);
        setDeptMembersMap(prev => ({ ...prev, [deptId]: currentIds.filter(id => id !== userId) }));
      } else {
        await supabase.from('profile_departments').insert({ department_id: deptId, profile_id: userId });
        setDeptMembersMap(prev => ({ ...prev, [deptId]: [...currentIds, userId] }));
      }
    } catch {
      toast.error('Erro ao atualizar membro');
    } finally {
      setManagingSaving(false);
    }
  };

  const [companyName, setCompanyName] = useState('');
  const [roundRobinMode, setRoundRobinMode] = useState<'weight' | 'percentage'>('weight');
  const [priorityOnline, setPriorityOnline] = useState(false);
  useEffect(() => {
    if (company?.name && !companyName) setCompanyName(company.name);
    if (company?.round_robin_mode) setRoundRobinMode(company.round_robin_mode as 'weight' | 'percentage');
    if (typeof company?.priority_online_agents === 'boolean') setPriorityOnline(company.priority_online_agents);
  }, [company]);

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
    createTag.mutate({ name: newTagName.trim(), color: newTagColor, department_id: newTagDeptId || null, project_id: newTagProjectId || null }, {
      onSuccess: () => { setNewTagName(''); setNewTagColor(TAG_COLORS[0]); setNewTagDeptId(''); setNewTagProjectId(''); },
    });
  };

  const handleSaveTagEdit = () => {
    if (!editingTag) return;
    updateTag.mutate({ id: editingTag.id, name: editingTag.name, color: editingTag.color, department_id: editingTag.department_id, project_id: editingTag.project_id || null }, {
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
      allowed_integration_ids: u.allowed_integration_ids ?? null,
    });
  };

  return (
    <div className="mx-auto max-w-4xl h-[calc(100dvh-7rem)] -m-4 lg:-m-6 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card px-4 py-2 shrink-0">
          <TabsList className="bg-transparent h-auto p-0 gap-1 overflow-x-auto flex-nowrap">
            <TabsTrigger value="usuarios" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Users size={14} /> Usuários
            </TabsTrigger>
            <TabsTrigger value="departamentos" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Layers size={14} /> Departamentos
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <TagIcon size={14} /> Tags
            </TabsTrigger>
            <TabsTrigger value="empresa" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Building2 size={14} /> Empresa
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
                  <p className="text-xs text-muted-foreground mt-0.5">Clique em um usuário para expandir e gerenciar todas as opções.</p>
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

              {loadingTeam ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(teamMembers ?? []).map(u => {
                    const isExpanded = editingUser?.id === u.id;
                    return (
                      <div key={u.id} className={`transition-colors ${isExpanded ? 'bg-accent/20' : 'hover:bg-accent/10'}`}>
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                          onClick={() => {
                            if (!permissions.canManageUsers) return;
                            if (isExpanded) { setEditingUser(null); } else { openEditUser(u); }
                          }}
                        >
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                              {!u.is_active && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-destructive/10 text-destructive">Inativo</Badge>}
                              {u.spy_mode && <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-600"><EyeOff size={8} className="mr-0.5" />Espião</Badge>}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{roleLabels[u.role] ?? u.role}</Badge>
                          <StatusBadge status={u.status as 'online' | 'ausente' | 'offline'} />
                          <span className="text-[10px] text-muted-foreground hidden lg:block shrink-0">{formatLastSeen(u.last_seen_at)}</span>
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {permissions.canManageUsers && !u.is_active && (
                              <button
                                onClick={async () => {
                                  try {
                                    const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', u.id);
                                    if (error) throw error;
                                    qc.invalidateQueries({ queryKey: ['team-profiles'] });
                                    toast.success(`${u.name} reativado com sucesso`);
                                  } catch (err: unknown) {
                                    toast.error((err as Error).message || 'Erro ao reativar usuário');
                                  }
                                }}
                                className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-500/10 rounded-md transition-colors"
                                title="Reativar usuário"
                              >
                                <UserCheck size={13} />
                              </button>
                            )}
                            {permissions.canManageUsers && (
                              <button
                                onClick={async () => {
                                  if (u.is_active) {
                                    if (!confirm(`Desativar ${u.name}?\n\nO usuário não poderá mais fazer login, mas seus leads e histórico serão preservados. Você pode reativá-lo depois.`)) return;
                                    try {
                                      const resp = await supabase.functions.invoke('delete-user', { body: { user_id: u.id, hard_delete: false } });
                                      if (resp.error) {
                                        let msg = 'Erro ao desativar usuário';
                                        try {
                                          const ctx = resp.error as Error & { context?: { body?: ReadableStream } };
                                          if (ctx?.context?.body) {
                                            const body = await new Response(ctx.context.body).json();
                                            if (body?.error) msg = body.error;
                                          }
                                        } catch (_) {}
                                        throw new Error(msg);
                                      }
                                      const result = resp.data as Record<string, string> | null;
                                      if (result?.error) throw new Error(result.error);
                                      qc.invalidateQueries({ queryKey: ['team-profiles'] });
                                      toast.success(`${u.name} desativado`);
                                    } catch (err: unknown) {
                                      toast.error((err as Error).message || 'Erro ao desativar usuário');
                                    }
                                  } else {
                                    if (!confirm(`Excluir ${u.name} permanentemente?\n\nTodos os vínculos com leads, mensagens e departamentos serão perdidos. Esta ação é irreversível.`)) return;
                                    try {
                                      const resp = await supabase.functions.invoke('delete-user', { body: { user_id: u.id, hard_delete: true } });
                                      if (resp.error) {
                                        let msg = 'Erro ao excluir usuário';
                                        try {
                                          const ctx = resp.error as Error & { context?: { body?: ReadableStream } };
                                          if (ctx?.context?.body) {
                                            const body = await new Response(ctx.context.body).json();
                                            if (body?.error) msg = body.error;
                                          }
                                        } catch (_) {}
                                        throw new Error(msg);
                                      }
                                      const result = resp.data as Record<string, string> | null;
                                      if (result?.error) throw new Error(result.error);
                                      qc.invalidateQueries({ queryKey: ['team-profiles'] });
                                      toast.success(`${u.name} excluído permanentemente`);
                                    } catch (err: unknown) {
                                      toast.error((err as Error).message || 'Erro ao excluir usuário');
                                    }
                                  }
                                }}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                title={u.is_active ? 'Desativar usuário' : 'Excluir permanentemente'}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {isExpanded && editingUser && (
                          <div className="px-4 pb-4 border-t border-border bg-card">
                            <EditUserInline
                              user={editingUser}
                              form={editingUser}
                              setForm={setEditingUser as React.Dispatch<React.SetStateAction<EditableUser | null>>}
                              integrations={allIntegrations}
                              departments={departments}
                              teamMembers={(teamMembers ?? []).map(m => ({
                                ...m,
                                display_name: m.display_name ?? '',
                                access_hours: m.access_hours ?? DEFAULT_ACCESS_HOURS,
                                custom_permissions: m.custom_permissions ?? {},
                                allowed_integration_ids: m.allowed_integration_ids ?? null,
                              })) as EditableUser[]}
                              roundRobinMode={roundRobinMode}
                              onSaved={() => { qc.invalidateQueries({ queryKey: ['team-profiles'] }); }}
                              onClose={() => setEditingUser(null)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cargo descriptions */}
            <div className="rounded-xl border border-border bg-card card-shadow p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cargos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {roleDescriptions.map(r => (
                  <div key={r.role} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
                    <r.icon size={14} className="text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{r.role}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{r.desc}</p>
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
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {memberIds ? `${memberIds.length} membro${memberIds.length !== 1 ? 's' : ''}` : '...'}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] gap-1"
                                onClick={() => setManagingDeptId(managingDeptId === d.id ? null : d.id)}
                              >
                                <UserPlus size={11} />
                                {managingDeptId === d.id ? 'Fechar' : 'Gerenciar'}
                              </Button>
                            </div>

                            {managingDeptId === d.id && (
                              <div className="mb-2 rounded-lg border border-border bg-card p-2 max-h-48 overflow-y-auto space-y-1">
                                {(teamMembers ?? []).map(u => {
                                  const isMember = (memberIds ?? []).includes(u.id);
                                  return (
                                    <label
                                      key={u.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer transition-colors"
                                    >
                                      <Checkbox
                                        checked={isMember}
                                        disabled={managingSaving}
                                        onCheckedChange={() => toggleDeptMember(d.id, u.id)}
                                        className="h-3.5 w-3.5"
                                      />
                                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                                        {(u.display_name || u.name || 'U').slice(0, 2).toUpperCase()}
                                      </div>
                                      <span className="text-xs text-foreground flex-1">{u.display_name || u.name}</span>
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{roleLabels[u.role] ?? u.role}</Badge>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {!memberIds ? (
                              <p className="text-xs text-muted-foreground italic py-2">Carregando...</p>
                            ) : deptUsers.length === 0 && managingDeptId !== d.id ? (
                              <p className="text-xs text-muted-foreground italic py-2">Nenhum usuário neste departamento.</p>
                            ) : deptUsers.length > 0 ? (
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
                            ) : null}
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

      {/* Modals */}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditTagDialog
        editingTag={editingTag}
        setEditingTag={setEditingTag}
        departments={departments}
        onSave={handleSaveTagEdit}
        saving={updateTag.isPending}
      />
    </div>
  );
}
