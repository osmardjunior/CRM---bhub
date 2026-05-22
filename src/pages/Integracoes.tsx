import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Copy, Check, Shield, Globe, RefreshCw, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrations, useAddDevice, useUpdateDevice, useDisconnectDevice, useDeleteDevice, type Integration } from '@/hooks/useIntegrations';
import { useDepartments } from '@/hooks/useDepartments';
import { useProjects } from '@/hooks/useProjects';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EvolutionQRModal from '@/components/integracoes/EvolutionQRModal';
import DeviceCard, { formatPhone, maskSecret, WEBHOOK_URL } from '@/components/integracoes/DeviceCard';
import AddDeviceDialog, { type AddDeviceFormData } from '@/components/integracoes/AddDeviceDialog';
import EditDeviceDialog, { type EditDeviceResult } from '@/components/integracoes/EditDeviceDialog';

export default function IntegracoesPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { companyId } = useAuth();
  const { projectId } = useProjectContext();
  const { data: integrations, isLoading } = useIntegrations(projectId || undefined);
  const { data: departments = [] } = useDepartments();
  const { data: allProjects = [] } = useProjects();
  const addDevice = useAddDevice();
  const updateDevice = useUpdateDevice();
  const disconnectDevice = useDisconnectDevice();
  const deleteDevice = useDeleteDevice();

  const [addOpen, setAddOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Integration | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Evolution QR modal state
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    integrationId: string | null;
    apiUrl: string;
    apiKey: string;
    instanceName: string;
  }>({ open: false, integrationId: null, apiUrl: '', apiKey: '', instanceName: '' });

  // map deviceId → selectedProjectId for "move to folder" action
  const [moveProjectMap, setMoveProjectMap] = useState<Record<string, string>>({});

  const whatsappDevices = integrations?.filter(i => i.channel === 'whatsapp') ?? [];
  const orphanedDevices = whatsappDevices.filter(d => !d.project_id);

  // Evolution credentials from existing integration (auto-fill for quick add)
  const existingEvolution = whatsappDevices.find(d => d.provider === 'evolution' && d.config?.api_url && d.config?.api_key);

  // Live status for Evolution API devices
  const [liveStatus, setLiveStatus] = useState<Record<string, 'checking' | 'connected' | 'disconnected'>>({});

  const checkAllStatuses = useCallback(async () => {
    const evolutionDevices = whatsappDevices.filter(d => d.provider === 'evolution' && d.config?.api_url);
    if (!evolutionDevices.length) return;

    setLiveStatus(prev => {
      const next = { ...prev };
      evolutionDevices.forEach(d => { next[d.id] = 'checking'; });
      return next;
    });

    await Promise.allSettled(
      evolutionDevices.map(async (d) => {
        try {
          const { data } = await supabase.functions.invoke('evolution-api', {
            body: {
              action: 'check-status',
              api_url: d.config.api_url,
              api_key: d.config.api_key,
              instance_name: d.config.instance_name,
              integration_id: d.id,
            },
          });
          setLiveStatus(prev => ({ ...prev, [d.id]: data?.connected ? 'connected' : 'disconnected' }));
        } catch {
          setLiveStatus(prev => ({ ...prev, [d.id]: 'disconnected' }));
        }
      })
    );
  }, [whatsappDevices]);

  useEffect(() => {
    if (!isLoading) checkAllStatuses();
    const timer = setInterval(checkAllStatuses, 60_000);
    return () => clearInterval(timer);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddDevice = (data: AddDeviceFormData) => {
    addDevice.mutate({
      channel: 'whatsapp',
      provider: data.provider,
      config: data.config,
      phone_number: data.phoneNumber,
      device_name: data.deviceName,
      department_id: data.departmentId,
    }, {
      onSuccess: async () => {
        setAddOpen(false);
        if (data.provider === 'evolution' && data.config.api_url && data.config.api_key) {
          await new Promise(r => setTimeout(r, 500));
          const { data: newData } = await supabase
            .from('integrations')
            .select('id')
            .eq('device_name', data.deviceName)
            .eq('provider', 'evolution')
            .order('created_at', { ascending: false })
            .limit(1);
          const newId = newData?.[0]?.id || null;
          setQrModal({
            open: true,
            integrationId: newId,
            apiUrl: data.config.api_url,
            apiKey: data.config.api_key,
            instanceName: data.config.instance_name || data.deviceName,
          });
        }
      },
    });
  };

  const handleEditDevice = (result: EditDeviceResult) => {
    updateDevice.mutate({
      id: result.id,
      updates: result.updates,
    }, {
      onSuccess: () => setEditDevice(null),
    });
  };

  const handleSyncPhone = async (device: Integration) => {
    const cfg = device.config as Record<string, string>;
    if (!cfg.api_url || !cfg.api_key || !cfg.instance_name) {
      toast.error('Configuração incompleta para sincronizar o número');
      return;
    }
    toast.loading('Buscando número...', { id: 'sync-phone' });
    try {
      const { data } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'fetch-phone',
          api_url: cfg.api_url,
          api_key: cfg.api_key,
          instance_name: cfg.instance_name,
          integration_id: device.id,
        },
      });
      if (data?.phone_number) {
        toast.success(`Número sincronizado: ${data.phone_number}`, { id: 'sync-phone' });
      } else {
        toast.error('Número não encontrado. O WhatsApp está conectado neste número?', { id: 'sync-phone' });
      }
    } catch {
      toast.error('Erro ao sincronizar número', { id: 'sync-phone' });
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Celulares"
        subtitle="Nesta área estão listados todos os aparelhos da sua conta."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/folders')}>
              <FolderOpen size={14} /> Pastas / Projetos
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={checkAllStatuses}>
              <RefreshCw size={14} /> Atualizar Status
            </Button>
            {permissions.isAdmin && (
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Adicionar Aparelho
              </Button>
            )}
          </div>
        }
      />

      {/* Folders CTA */}
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-8 text-center space-y-3">
        <FolderOpen size={32} className="mx-auto text-primary/60" />
        <div>
          <p className="text-sm font-semibold text-foreground">Os números são gerenciados dentro das Pastas</p>
          <p className="text-xs text-muted-foreground mt-1">Cada número fica vinculado a um projeto. Acesse as Pastas para adicionar, conectar ou gerenciar números.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/folders')}>
          <FolderOpen size={14} className="mr-1.5" /> Abrir Pastas / Projetos
        </Button>
      </div>

      {/* Números sem pasta */}
      {orphanedDevices.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-warning/20 flex items-center gap-2">
            <Smartphone size={15} className="text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">Números sem pasta</p>
              <p className="text-xs text-muted-foreground">
                {orphanedDevices.length} número{orphanedDevices.length > 1 ? 's' : ''} ainda não {orphanedDevices.length > 1 ? 'foram atribuídos' : 'foi atribuído'} a uma pasta/projeto.
                {allProjects.length > 0 ? ' Mova-os para uma pasta para que fiquem organizados.' : ' Crie uma pasta em Pastas / Projetos primeiro.'}
              </p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {orphanedDevices.map(device => {
              const connected = liveStatus[device.id] === 'connected' || (liveStatus[device.id] !== 'disconnected' && device.status === 'connected');
              const selectedProject = moveProjectMap[device.id] ?? '';
              return (
                <div key={device.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge variant="outline" className={`text-[11px] shrink-0 ${connected ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}>
                      {liveStatus[device.id] === 'checking' ? '...' : connected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{device.device_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground">{device.phone_number || 'Número não detectado'}</p>
                    </div>
                  </div>
                  {allProjects.length > 0 && permissions.isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={selectedProject}
                        onValueChange={v => setMoveProjectMap(prev => ({ ...prev, [device.id]: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs w-44">
                          <SelectValue placeholder="Escolher pasta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allProjects.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!selectedProject || updateDevice.isPending}
                        onClick={() => {
                          if (!selectedProject) return;
                          updateDevice.mutate(
                            { id: device.id, updates: { project_id: selectedProject } },
                            { onSuccess: () => setMoveProjectMap(prev => { const n = { ...prev }; delete n[device.id]; return n; }) }
                          );
                        }}
                      >
                        Mover
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Info Section */}
      <div className="rounded-xl border border-border bg-card card-shadow p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Informações da API</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Status da API</p>
            <Badge variant="outline" className="text-xs bg-success/15 text-success border-success/20">Ativa</Badge>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Chave de segurança</p>
            <div className="flex items-center gap-1.5">
              <Shield size={12} className="text-muted-foreground" />
              <code className="text-xs text-foreground">{maskSecret('webhook_secret_configured')}</code>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-foreground bg-muted rounded px-2 py-1.5 truncate">{WEBHOOK_URL}</code>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleCopy(WEBHOOK_URL)}>
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </Button>
          </div>
        </div>

        {whatsappDevices.length > 0 && (
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground mb-2">Aparelhos cadastrados</p>
            <div className="space-y-1">
              {whatsappDevices.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{d.device_name || 'Sem nome'}</span>
                  <span className="text-muted-foreground font-mono">{formatPhone(d.phone_number)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Device Modal */}
      <AddDeviceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        departments={departments}
        existingEvolutionConfig={
          existingEvolution
            ? { api_url: existingEvolution.config.api_url as string, api_key: existingEvolution.config.api_key as string }
            : undefined
        }
        isPending={addDevice.isPending}
        onSubmit={handleAddDevice}
      />

      {/* Edit Device Modal */}
      <EditDeviceDialog
        device={editDevice}
        onClose={() => setEditDevice(null)}
        departments={departments}
        companyId={companyId}
        whatsappDeviceIds={whatsappDevices.map(d => d.id)}
        isPending={updateDevice.isPending}
        onSubmit={handleEditDevice}
      />

      {/* Confirm Disconnect */}
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={() => setConfirmId(null)}
        title="Desativar aparelho"
        description="Tem certeza que deseja desativar este aparelho? Ele deixará de enviar e receber mensagens."
        onConfirm={() => {
          if (confirmId) disconnectDevice.mutate(confirmId);
          setConfirmId(null);
        }}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Remover aparelho"
        description="Tem certeza que deseja remover este aparelho permanentemente? Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (deleteId) deleteDevice.mutate(deleteId);
          setDeleteId(null);
        }}
      />

      {/* Evolution QR Code Modal */}
      <EvolutionQRModal
        open={qrModal.open}
        onOpenChange={(v) => setQrModal(prev => ({ ...prev, open: v }))}
        integrationId={qrModal.integrationId}
        apiUrl={qrModal.apiUrl}
        apiKey={qrModal.apiKey}
        instanceName={qrModal.instanceName}
      />
    </div>
  );
}
