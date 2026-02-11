import { useState, useEffect } from 'react';
import {
  Building2, Users, Save, Plus, ImageIcon,
  Shield, Eye, Headphones, Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/StatusBadge';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useCompany, useUpdateCompany } from '@/hooks/useCompany';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const roleLabels: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', agent: 'Agente' };

const roleDescriptions = [
  { role: 'Admin', icon: Shield, desc: 'Acesso total ao sistema. Gerencia usuários, configurações e todas as áreas.' },
  { role: 'Supervisor', icon: Eye, desc: 'Visualiza relatórios, gerencia equipe e monitora conversas em tempo real.' },
  { role: 'Agente', icon: Headphones, desc: 'Atende conversas, gerencia contatos atribuídos e cria tarefas.' },
];

export default function ConfiguracoesPage() {
  const permissions = usePermissions();
  const { companyId } = useAuth();
  const manageTooltip = getPermissionTooltip('canManageUsers', permissions);
  const [activeTab, setActiveTab] = useState('empresa');

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: '' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);

  // Real data hooks
  const { data: teamMembers, isLoading: loadingTeam } = useTeamProfiles();
  const { data: company, isLoading: loadingCompany } = useCompany();
  const updateCompany = useUpdateCompany();

  const [companyName, setCompanyName] = useState('');
  useEffect(() => {
    if (company?.name && !companyName) setCompanyName(company.name);
  }, [company]);

  const validateInvite = () => {
    const e: Record<string, string> = {};
    if (!invite.name.trim()) e.name = 'Obrigatório';
    if (!invite.email.trim()) e.email = 'Obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) e.email = 'Email inválido';
    if (!invite.role) e.role = 'Obrigatório';
    setInviteErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleInvite = async () => {
    if (!validateInvite()) return;
    setInviting(true);
    try {
      const resp = await supabase.functions.invoke('invite-user', {
        body: { name: invite.name, email: invite.email, role: invite.role },
      });
      if (resp.error) throw new Error(resp.error.message);
      const result = resp.data as any;
      if (result.error) throw new Error(result.error);
      toast.success(`Usuário ${invite.email} criado com sucesso!`);
      setInviteOpen(false);
      setInvite({ name: '', email: '', role: '' });
      setInviteErrors({});
    } catch (err: any) {
      toast.error(err.message || 'Erro ao convidar usuário');
    } finally {
      setInviting(false);
    }
  };

  const handleSaveCompany = () => {
    if (!companyName.trim()) return;
    updateCompany.mutate({ name: companyName.trim() });
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
                <h2 className="text-base font-semibold text-foreground">Membros da equipe</h2>
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
                  </tr>
                </thead>
                <tbody>
                  {loadingTeam ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-16" /></td>
                      </tr>
                    ))
                  ) : (teamMembers ?? []).map(u => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{roleLabels[u.role] ?? u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={u.status as 'online' | 'ausente' | 'offline'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </TabsContent>
        </div>
      </Tabs>

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={() => { setInviteOpen(false); setInviteErrors({}); setInvite({ name: '', email: '', role: '' }); }}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
