import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Users, Smartphone, Wifi, WifiOff, Pencil, Trash2,
  QrCode, RefreshCw, Server, Shield, Phone, Layers, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getAreaUserIds } from '@/lib/areaFilter';
import { useProjects } from '@/hooks/useProjects';
import {
  useIntegrations, useAddDevice, useUpdateDevice,
  useDisconnectDevice, useDeleteDevice, type Integration,
} from '@/hooks/useIntegrations';
import { useUserProjects, useAddUserToProject, useRemoveUserFromProject } from '@/hooks/useUserProjects';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useAuth } from '@/contexts/AuthContext';
import EvolutionQRModal from '@/components/integracoes/EvolutionQRModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

// ── Providers ──────────────────────────────────────────────────────────────
const PROVIDERS = [
  { value: 'evolution', label: 'Evolution API' },
  { value: 'meta',      label: 'Meta Cloud API' },
  { value: 'twilio',    label: 'Twilio' },
  { value: '360dialog', label: '360dialog' },
  { value: 'gupshup',   label: 'Gupshup' },
];

function providerLabel(p: string) {
  return PROVIDERS.find(pr => pr.value === p)?.label ?? p;
}

function maskSecret(s: string) {
  if (!s || s.length < 6) return '••••••';
  return s.slice(0, 4) + '••••' + s.slice(-2);
}

function formatPhone(p: string | null) {
  return p || 'Número não sincronizado';
}

// ── Provider-specific config fields ────────────────────────────────────────
function ProviderFields({ provider, config, onChange }: {
  provider: string;
  config: Record<string, string>;
  onChange: (c: Record<string, string>) => void;
}) {
  const set = (k: string, v: string) => onChange({ ...config, [k]: v });

  if (provider === 'meta') return (
    <div className="space-y-3">
      <div><Label className="text-xs">Access Token</Label><Input type="password" className="mt-1" value={config.access_token ?? ''} onChange={e => set('access_token', e.target.value)} placeholder="EAABx..." /></div>
      <div><Label className="text-xs">Phone Number ID</Label><Input className="mt-1" value={config.phone_number_id ?? ''} onChange={e => set('phone_number_id', e.target.value)} placeholder="1234567890" /></div>
    </div>
  );
  if (provider === 'twilio') return (
    <div className="space-y-3">
      <div><Label className="text-xs">Account SID</Label><Input className="mt-1" value={config.account_sid ?? ''} onChange={e => set('account_sid', e.target.value)} placeholder="ACxxx" /></div>
      <div><Label className="text-xs">Auth Token</Label><Input type="password" className="mt-1" value={config.auth_token ?? ''} onChange={e => set('auth_token', e.target.value)} /></div>
      <div><Label className="text-xs">From Number</Label><Input className="mt-1" value={config.from_number ?? ''} onChange={e => set('from_number', e.target.value)} placeholder="+5511999999999" /></div>
    </div>
  );
  if (provider === '360dialog') return (
    <div><Label className="text-xs">API Key</Label><Input type="password" className="mt-1" value={config.api_key ?? ''} onChange={e => set('api_key', e.target.value)} /></div>
  );
  if (provider === 'gupshup') return (
    <div className="space-y-3">
      <div><Label className="text-xs">API Key</Label><Input type="password" className="mt-1" value={config.api_key ?? ''} onChange={e => set('api_key', e.target.value)} /></div>
      <div><Label className="text-xs">App Name</Label><Input className="mt-1" value={config.app_name ?? ''} onChange={e => set('app_name', e.target.value)} /></div>
    </div>
  );
  if (provider === 'evolution') return (
    <div className="space-y-3">
      <div><Label className="text-xs">URL da API</Label><Input className="mt-1" value={config.api_url ?? ''} onChange={e => set('api_url', e.target.value)} placeholder="https://sua-evolution-api.com" /></div>
      <div><Label className="text-xs">API Key (Global)</Label><Input type="password" className="mt-1" value={config.api_key ?? ''} onChange={e => set('api_key', e.target.value)} /></div>
      <div><Label className="text-xs">Nome da instância</Label><Input className="mt-1" value={config.instance_name ?? ''} onChange={e => set('instance_name', e.target.value)} placeholder="Ex: minha-empresa" /></div>
    </div>
  );
  return null;
}

// ── Device Row ─────────────────────────────────────────────────────────────
function DeviceRow({ device, onEdit, onConnect, onSyncPhone, onDisconnect, onDelete, liveStatus }: {
  device: Integration;
  onEdit: (d: Integration) => void;
  onConnect: (d: Integration) => void;
  onSyncPhone: (d: Integration) => void;
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
  liveStatus?: 'checking' | 'connected' | 'disconnected';
}) {
  const connected = liveStatus ? liveStatus === 'connected' : device.status === 'connected';
  const isChecking = liveStatus === 'checking';

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${connected ? 'bg-green-500/10' : 'bg-muted'}`}>
        <Smartphone className={`h-4 w-4 ${connected ? 'text-green-600' : 'text-muted-foreground'}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{device.device_name || 'Sem nome'}</span>
          {isChecking ? (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse">
              <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" /> Verificando
            </Badge>
          ) : (
            <Badge variant="outline" className={`text-[10px] ${connected ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
              {connected ? <><Wifi className="h-2.5 w-2.5 mr-1" />Conectado</> : <><WifiOff className="h-2.5 w-2.5 mr-1" />Desconectado</>}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatPhone(device.phone_number)} · {providerLabel(device.provider)}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => onEdit(device)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {device.provider === 'evolution' && !connected && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Conectar QR" onClick={() => onConnect(device)}>
            <QrCode className="h-3.5 w-3.5" />
          </Button>
        )}
        {device.provider === 'evolution' && connected && !device.phone_number && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Sincronizar número" onClick={() => onSyncPhone(device)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
        {connected && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Desativar" onClick={() => onDisconnect(device.id)}>
            <WifiOff className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Excluir" onClick={() => onDelete(device.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FolderNumbers() {
  const { departmentId, projectId } = useParams<{ departmentId: string; projectId: string }>();
  const navigate = useNavigate();
  const { role, companyId } = useAuth();
  const canManage = role === 'admin' || role === 'supervisor';

  const { data: projects = [] } = useProjects(departmentId);
  const project = projects.find(p => p.id === projectId);

  const { data: integrations = [], isLoading } = useIntegrations(projectId);
  // All company integrations (for detecting existing Evolution credentials)
  const { data: allIntegrations = [] } = useIntegrations();
  const { data: userProjects = [] } = useUserProjects(projectId!);
  const { data: teamMembers = [] } = useTeamProfiles();

  const addDevice      = useAddDevice();
  const updateDevice   = useUpdateDevice();
  const disconnectDev  = useDisconnectDevice();
  const deleteDev      = useDeleteDevice();
  const addUser        = useAddUserToProject();
  const removeUser     = useRemoveUserFromProject();

  // ── QR Modal ────────────────────────────────────────
  const [qrModal, setQrModal] = useState<{
    open: boolean; integrationId: string | null;
    apiUrl: string; apiKey: string; instanceName: string;
  }>({ open: false, integrationId: null, apiUrl: '', apiKey: '', instanceName: '' });

  // ── Live status ─────────────────────────────────────
  const [liveStatus, setLiveStatus] = useState<Record<string, 'checking' | 'connected' | 'disconnected'>>({});

  const checkAllStatuses = useCallback(async () => {
    const evolutionDevices = integrations.filter(d => d.provider === 'evolution' && d.config?.api_url);
    if (!evolutionDevices.length) return;
    setLiveStatus(prev => {
      const next = { ...prev };
      evolutionDevices.forEach(d => { next[d.id] = 'checking'; });
      return next;
    });
    await Promise.allSettled(evolutionDevices.map(async d => {
      try {
        const { data } = await supabase.functions.invoke('evolution-api', {
          body: { action: 'check-status', api_url: d.config.api_url, api_key: d.config.api_key, instance_name: d.config.instance_name, integration_id: d.id },
        });
        setLiveStatus(prev => ({ ...prev, [d.id]: data?.connected ? 'connected' : 'disconnected' }));
      } catch {
        setLiveStatus(prev => ({ ...prev, [d.id]: 'disconnected' }));
      }
    }));
  }, [integrations]);

  useEffect(() => {
    if (!isLoading) checkAllStatuses();
    const t = setInterval(checkAllStatuses, 60_000);
    return () => clearInterval(t);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quick-add helpers ─────────────────────────────────
  // If a Evolution integration already exists in the company, reuse its credentials.
  const existingEvolution = allIntegrations.find(
    d => d.provider === 'evolution' && d.config?.api_url && d.config?.api_key,
  );
  const quickAddMode = !!existingEvolution;

  const toInstanceName = (name: string) => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${slug}-${suffix}`;
  };

  // ── Add device modal state ───────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [devName, setDevName] = useState('');
  const [devPhone, setDevPhone] = useState('');
  const [devProvider, setDevProvider] = useState('evolution');
  const [devConfig, setDevConfig] = useState<Record<string, string>>({});

  const resetAddForm = () => { setDevName(''); setDevPhone(''); setDevProvider('evolution'); setDevConfig({}); };

  const handleQuickAdd = () => {
    if (!devName.trim()) { toast.error('Preencha o nome do aparelho'); return; }
    if (!existingEvolution) return;
    const instanceName = toInstanceName(devName);
    const cfg = {
      api_url: existingEvolution.config.api_url as string,
      api_key: existingEvolution.config.api_key as string,
      instance_name: instanceName,
    };
    addDevice.mutate({
      channel: 'whatsapp',
      provider: 'evolution',
      config: cfg,
      phone_number: '',
      device_name: devName.trim(),
      project_id: projectId,
    }, {
      onSuccess: async () => {
        setAddOpen(false);
        resetAddForm();
        await new Promise(r => setTimeout(r, 500));
        const { data } = await supabase.from('integrations').select('id')
          .eq('device_name', devName.trim()).eq('provider', 'evolution')
          .order('created_at', { ascending: false }).limit(1);
        setQrModal({ open: true, integrationId: data?.[0]?.id ?? null, apiUrl: cfg.api_url, apiKey: cfg.api_key, instanceName });
      },
    });
  };

  const handleAdd = () => {
    if (!devName.trim()) { toast.error('Preencha o nome do aparelho'); return; }
    const needsPhone = devProvider !== 'evolution';
    if (needsPhone && !devPhone.trim()) { toast.error('Preencha o número de telefone'); return; }
    if (devProvider === 'evolution' && (!devConfig.api_url?.trim() || !devConfig.api_key?.trim() || !devConfig.instance_name?.trim())) {
      toast.error('Preencha URL da API, API Key e Nome da instância'); return;
    }
    const savedConfig = { ...devConfig };
    const savedInstance = devConfig.instance_name || devName.trim();
    addDevice.mutate({
      channel: 'whatsapp',
      provider: devProvider,
      config: devConfig,
      phone_number: needsPhone ? devPhone : '',
      device_name: devName,
      project_id: projectId,
    }, {
      onSuccess: async () => {
        setAddOpen(false);
        resetAddForm();
        if (devProvider === 'evolution' && savedConfig.api_url && savedConfig.api_key) {
          setTimeout(async () => {
            const { data } = await supabase.from('integrations').select('id')
              .eq('device_name', devName).eq('provider', 'evolution')
              .order('created_at', { ascending: false }).limit(1);
            setQrModal({ open: true, integrationId: data?.[0]?.id ?? null, apiUrl: savedConfig.api_url, apiKey: savedConfig.api_key, instanceName: savedInstance });
          }, 500);
        }
      },
    });
  };

  // ── Edit device modal state ──────────────────────────
  const [editDevice, setEditDevice] = useState<Integration | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  type AgentEntry = { id: string; name: string; originalAllowed: string[] | null; checked: boolean };
  const [editAgentsList, setEditAgentsList] = useState<AgentEntry[]>([]);

  const openEdit = async (d: Integration) => {
    setEditDevice(d);
    setEditName(d.device_name || '');
    setEditPhone(d.phone_number || '');
    setEditConfig(d.config as Record<string, string> ?? {});
    setEditAgentsList([]);
    if (companyId) {
      const areaUserIds = await getAreaUserIds();
      let q = supabase
        .from('profiles')
        .select('id, name, allowed_integration_ids')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (areaUserIds) q = q.in('id', areaUserIds);
      const { data: profiles } = await q;
      if (profiles) {
        setEditAgentsList(profiles.map((p: any) => ({
          id: p.id,
          name: p.name || p.id,
          originalAllowed: p.allowed_integration_ids ?? null,
          checked: p.allowed_integration_ids === null || (p.allowed_integration_ids ?? []).includes(d.id),
        })));
      }
    }
  };

  const handleEdit = async () => {
    if (!editDevice) return;
    if (!editName.trim()) { toast.error('Preencha o nome'); return; }
    // Save agent assignment changes
    const deviceId = editDevice.id;
    const allDeviceIds = allIntegrations.map(d => d.id);
    const agentUpdates: Promise<any>[] = [];
    for (const agent of editAgentsList) {
      const wasChecked = agent.originalAllowed === null || agent.originalAllowed.includes(deviceId);
      const isNowChecked = agent.checked;
      if (wasChecked === isNowChecked) continue;
      let newAllowed: string[] | null;
      if (isNowChecked) {
        if (agent.originalAllowed === null) continue;
        newAllowed = [...agent.originalAllowed, deviceId];
      } else {
        if (agent.originalAllowed === null) {
          newAllowed = allDeviceIds.filter(id => id !== deviceId);
        } else {
          newAllowed = agent.originalAllowed.filter(id => id !== deviceId);
        }
      }
      agentUpdates.push(
        supabase.from('profiles').update({ allowed_integration_ids: newAllowed }).eq('id', agent.id)
      );
    }
    if (agentUpdates.length > 0) await Promise.all(agentUpdates);

    updateDevice.mutate({ id: editDevice.id, updates: { device_name: editName, phone_number: editPhone, config: editConfig } }, {
      onSuccess: () => setEditDevice(null),
    });
  };

  // ── Sync phone ───────────────────────────────────────
  const handleSyncPhone = async (d: Integration) => {
    const cfg = d.config as Record<string, string>;
    if (!cfg.api_url || !cfg.api_key || !cfg.instance_name) { toast.error('Configuração incompleta'); return; }
    toast.loading('Buscando número...', { id: 'sync-phone' });
    try {
      const { data } = await supabase.functions.invoke('evolution-api', { body: { action: 'fetch-phone', api_url: cfg.api_url, api_key: cfg.api_key, instance_name: cfg.instance_name, integration_id: d.id } });
      if (data?.phone_number) toast.success(`Número sincronizado: ${data.phone_number}`, { id: 'sync-phone' });
      else toast.error('Número não encontrado', { id: 'sync-phone' });
    } catch { toast.error('Erro ao sincronizar', { id: 'sync-phone' }); }
  };

  // ── Confirm disconnect / delete ──────────────────────
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  // ── Users modal ──────────────────────────────────────
  const [usersOpen, setUsersOpen] = useState(false);
  const memberIds = new Set(userProjects.map(up => up.user_id));

  const toggleUser = (userId: string) => {
    if (memberIds.has(userId)) {
      removeUser.mutate({ userId, projectId: projectId! });
    } else {
      addUser.mutate({ userId, projectId: projectId! });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/folders/${departmentId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Smartphone className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{project?.name ?? 'Projeto'}</h1>
          <Badge variant="secondary" className="text-[11px]">{integrations.length} número{integrations.length !== 1 ? 's' : ''}</Badge>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setUsersOpen(true)}>
              <Users className="h-4 w-4 mr-1" /> Usuários ({userProjects.length})
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Número
            </Button>
          </div>
        )}
      </div>

      {/* Status Legend */}
      <div className="mx-6 mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground text-xs">Legenda:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Conectado — chip online e operacional
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Desconectado — chip offline, necessita reconexão
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" /> Verificando — checando status do chip
        </span>
      </div>

      {/* Numbers list */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Smartphone className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum número neste projeto.</p>
            {canManage && (
              <Button size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro número
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map(d => (
              <DeviceRow
                key={d.id}
                device={d}
                liveStatus={liveStatus[d.id]}
                onEdit={openEdit}
                onConnect={(dev) => {
                  const cfg = dev.config as Record<string, string>;
                  if (cfg.api_url && cfg.api_key) {
                    setQrModal({ open: true, integrationId: dev.id, apiUrl: cfg.api_url, apiKey: cfg.api_key, instanceName: cfg.instance_name || dev.device_name || 'default' });
                  } else { toast.error('Configure URL e API Key primeiro'); }
                }}
                onSyncPhone={handleSyncPhone}
                onDisconnect={id => setConfirmId(id)}
                onDelete={id => setDeleteId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Number Modal ───────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={v => { if (!v) { setAddOpen(false); resetAddForm(); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Número</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {quickAddMode
                ? 'Digite o nome do número e escaneie o QR Code para conectar.'
                : 'Preencha os dados do aparelho para conectar.'}
            </p>
          </DialogHeader>

          {quickAddMode ? (
            /* ── Quick add: só precisa do nome ─────────── */
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Nome do aparelho</Label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Vendas - Principal"
                  value={devName}
                  onChange={e => setDevName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !addDevice.isPending) handleQuickAdd(); }}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1">Um nome para identificar este número na equipe</p>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <QrCode className="h-3 w-3" /> Número detectado pelo QR Code
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Após clicar em Adicionar, escaneie o QR Code com o WhatsApp para conectar.
                </p>
              </div>
            </div>
          ) : (
            /* ── Full form: sem Evolution existente ────── */
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Provedor</Label>
                <Select value={devProvider} onValueChange={v => { setDevProvider(v); setDevConfig({}); }}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nome do aparelho</Label>
                <Input className="mt-1" placeholder="Ex: Vendas - Principal" value={devName} onChange={e => setDevName(e.target.value)} />
              </div>
              {devProvider !== 'evolution' && (
                <div>
                  <Label className="text-xs">Número de telefone</Label>
                  <Input className="mt-1" placeholder="+5511999999999" value={devPhone} onChange={e => setDevPhone(e.target.value)} />
                </div>
              )}
              <ProviderFields provider={devProvider} config={devConfig} onChange={setDevConfig} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAddForm(); }}>Cancelar</Button>
            <Button
              onClick={quickAddMode ? handleQuickAdd : handleAdd}
              disabled={addDevice.isPending}
            >
              {addDevice.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ─────────────────────────────────────── */}
      <Dialog open={!!editDevice} onOpenChange={v => { if (!v) setEditDevice(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Aparelho</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome do aparelho</Label>
              <Input className="mt-1" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            {editDevice?.provider !== 'evolution' && (
              <div>
                <Label className="text-xs">Número de telefone</Label>
                <Input className="mt-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+5511999999999" />
              </div>
            )}
            {editDevice && <ProviderFields provider={editDevice.provider} config={editConfig} onChange={setEditConfig} />}

            {/* ── Agent assignment ─────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold">Agentes que atendem este número</Label>
              </div>
              {editAgentsList.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-5">Carregando agentes...</p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border max-h-44 overflow-y-auto">
                  {editAgentsList.map(agent => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-primary"
                        checked={agent.checked}
                        onChange={() =>
                          setEditAgentsList(prev =>
                            prev.map(a => a.id === agent.id ? { ...a, checked: !a.checked } : a)
                          )
                        }
                      />
                      <span className="text-sm text-foreground flex-1">{agent.name}</span>
                      {agent.originalAllowed === null && (
                        <span className="text-[11px] text-muted-foreground">todos os números</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground pl-5">
                Desmarcar restringe o agente a não receber conversas deste número.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateDevice.isPending}>
              {updateDevice.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Users Modal ────────────────────────────────────── */}
      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Usuários do Projeto</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1">
            {teamMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
            ) : teamMembers.map(member => {
              const isMember = memberIds.has(member.id);
              return (
                <button
                  key={member.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isMember ? 'bg-primary/10' : 'hover:bg-secondary/50'}`}
                  onClick={() => toggleUser(member.id)}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${isMember ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {(member.display_name || member.name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{member.display_name || member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                  </div>
                  {isMember ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : <X className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setUsersOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Disconnect ─────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={() => setConfirmId(null)}
        title="Desativar aparelho"
        description="Tem certeza? O aparelho deixará de receber mensagens."
        confirmLabel="Desativar"
        variant="destructive"
        onConfirm={() => { if (confirmId) disconnectDev.mutate(confirmId); setConfirmId(null); }}
      />

      {/* ── Confirm Delete ─────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir aparelho"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => { if (deleteId) deleteDev.mutate(deleteId); setDeleteId(null); }}
      />

      {/* ── QR Modal ───────────────────────────────────────── */}
      <EvolutionQRModal
        open={qrModal.open}
        onClose={() => setQrModal(prev => ({ ...prev, open: false }))}
        integrationId={qrModal.integrationId}
        apiUrl={qrModal.apiUrl}
        apiKey={qrModal.apiKey}
        instanceName={qrModal.instanceName}
      />
    </div>
  );
}
