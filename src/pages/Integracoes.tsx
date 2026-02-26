import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Copy, Check, Wifi, WifiOff, Shield, Globe, Trash2, Pencil, Phone, Server, QrCode, RefreshCw, Layers, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useIntegrations, useAddDevice, useUpdateDevice, useDisconnectDevice, useDeleteDevice, type Integration } from '@/hooks/useIntegrations';
import { useDepartments } from '@/hooks/useDepartments';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import EvolutionQRModal from '@/components/integracoes/EvolutionQRModal';

const PROVIDERS = [
  { value: 'meta', label: 'Meta Cloud API' },
  { value: 'twilio', label: 'Twilio' },
  { value: '360dialog', label: '360dialog' },
  { value: 'gupshup', label: 'Gupshup' },
  { value: 'evolution', label: 'Evolution API' },
];

const WEBHOOK_URL = `https://loamacrszlgxhaqvnkzw.supabase.co/functions/v1/incoming-message`;

function providerLabel(p: string) {
  return PROVIDERS.find(pr => pr.value === p)?.label ?? p;
}

function formatPhone(phone: string | null) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length >= 10) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
  }
  return phone;
}

function maskSecret(s?: string) {
  if (!s || s.length < 8) return '••••••••';
  return s.slice(0, 4) + '••••' + s.slice(-4);
}

// ── Provider-specific config fields ──────────────────
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
      <div><Label className="text-xs">URL da API</Label><Input className="mt-1" value={config.api_url ?? ''} onChange={e => set('api_url', e.target.value)} placeholder="https://sua-evolution-api.com" /><p className="text-[11px] text-muted-foreground mt-1">URL onde a Evolution API está rodando (Docker local, Railway, etc.)</p></div>
      <div><Label className="text-xs">API Key (Global)</Label><Input type="password" className="mt-1" value={config.api_key ?? ''} onChange={e => set('api_key', e.target.value)} placeholder="Chave definida em AUTHENTICATION_API_KEY" /></div>
      <div><Label className="text-xs">Nome da instância</Label><Input className="mt-1" value={config.instance_name ?? ''} onChange={e => set('instance_name', e.target.value)} placeholder="Ex: minha-empresa" /><p className="text-[11px] text-muted-foreground mt-1">Nome que será usado para criar a instância na Evolution API</p></div>
    </div>
  );
  return null;
}

// ── Device Card ──────────────────────────────────────
function DeviceCard({ device, isAdmin, departments, onDisconnect, onDelete, onEdit, onConnect, onSyncPhone, liveStatus }: {
  device: Integration;
  isAdmin: boolean;
  departments: { id: string; name: string }[];
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (device: Integration) => void;
  onConnect: (device: Integration) => void;
  onSyncPhone: (device: Integration) => void;
  liveStatus?: 'checking' | 'connected' | 'disconnected';
}) {
  // Use liveStatus for Evolution devices if available, fall back to DB status
  const connected = liveStatus ? liveStatus === 'connected' : device.status === 'connected';
  const isChecking = liveStatus === 'checking';

  return (
    <div className="group rounded-xl border border-border bg-card card-shadow p-5 space-y-4 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${connected ? 'bg-success/10' : 'bg-muted'}`}>
            <Smartphone size={20} className={connected ? 'text-success' : 'text-muted-foreground'} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{device.device_name || 'Aparelho sem nome'}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone size={10} />
              <span>{formatPhone(device.phone_number)}</span>
            </div>
          </div>
        </div>
        {isChecking ? (
          <Badge variant="outline" className="text-[11px] shrink-0 bg-amber-500/15 text-amber-600 border-amber-500/20 animate-pulse">
            <RefreshCw size={10} className="mr-1 animate-spin" /> Verificando...
          </Badge>
        ) : (
          <Badge variant="outline" className={`text-[11px] shrink-0 ${connected ? 'bg-success/15 text-success border-success/20' : 'bg-destructive/15 text-destructive border-destructive/20'}`}>
            {connected ? <><Wifi size={10} className="mr-1" /> Conectado</> : <><WifiOff size={10} className="mr-1" /> Desconectado</>}
          </Badge>
        )}
      </div>

      {/* Info rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Server size={12} />
            <span>Provedor</span>
          </div>
          <span className="text-xs font-medium text-foreground">{providerLabel(device.provider)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield size={12} />
            <span>Credenciais</span>
          </div>
          <code className="text-[11px] text-muted-foreground">{maskSecret(JSON.stringify(device.config))}</code>
        </div>
        {departments.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers size={12} />
              <span>Departamento</span>
            </div>
            <span className="text-xs font-medium text-foreground">
              {device.department_id ? (departments.find(d => d.id === device.department_id)?.name ?? '—') : <span className="text-muted-foreground italic">Nenhum</span>}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 flex-1" onClick={() => onEdit(device)}>
            <Pencil size={12} /> Editar
          </Button>
          {device.provider === 'evolution' && !connected && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5 text-primary hover:text-primary" onClick={() => onConnect(device)}>
              <QrCode size={12} /> Conectar
            </Button>
          )}
          {device.provider === 'evolution' && connected && !device.phone_number && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5 text-primary hover:text-primary" onClick={() => onSyncPhone(device)}>
              <RefreshCw size={12} /> Sincronizar nº
            </Button>
          )}
          {connected && (
            <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => onDisconnect(device.id)}>
              Desativar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => onDelete(device.id)}>
            <Trash2 size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
export default function IntegracoesPage() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const { data: integrations, isLoading } = useIntegrations();
  const { data: departments = [] } = useDepartments();
  const addDevice = useAddDevice();
  const updateDevice = useUpdateDevice();
  const disconnectDevice = useDisconnectDevice();
  const deleteDevice = useDeleteDevice();

  const [addOpen, setAddOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Integration | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(1);

  // Evolution QR modal state
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    integrationId: string | null;
    apiUrl: string;
    apiKey: string;
    instanceName: string;
  }>({ open: false, integrationId: null, apiUrl: '', apiKey: '', instanceName: '' });

  // form state
  const [deviceName, setDeviceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [deptId, setDeptId] = useState('');

  // edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [editDeptId, setEditDeptId] = useState<string>('');

  const whatsappDevices = integrations?.filter(i => i.channel === 'whatsapp') ?? [];

  // Live status for Evolution API devices (separate from DB status)
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

  // Check on load and every 60s
  useEffect(() => {
    if (!isLoading) checkAllStatuses();
    const timer = setInterval(checkAllStatuses, 60_000);
    return () => clearInterval(timer);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setDeviceName('');
    setPhoneNumber('');
    setProvider('');
    setConfig({});
    setDeptId('');
  };

  const openEdit = (device: Integration) => {
    setEditDevice(device);
    setEditName(device.device_name || '');
    setEditPhone(device.phone_number || '');
    setEditDeptId(device.department_id ?? '__none__');
    setEditConfig(device.config as Record<string, string> ?? {});
  };

  const handleAdd = () => {
    const needsPhone = provider !== 'evolution';
    if (!deviceName.trim() || !provider || (needsPhone && !phoneNumber.trim())) {
      toast.error(needsPhone ? 'Preencha nome, número e provedor' : 'Preencha nome e provedor');
      return;
    }
    const isEvolution = provider === 'evolution';
    if (isEvolution && (!config.api_url?.trim() || !config.api_key?.trim() || !config.instance_name?.trim())) {
      toast.error('Preencha a URL da API, API Key e Nome da instância');
      return;
    }
    const savedConfig = { ...config };
    const savedInstanceName = config.instance_name || deviceName.trim();
    addDevice.mutate({
      channel: 'whatsapp',
      provider,
      config,
      phone_number: needsPhone ? phoneNumber : '',
      device_name: deviceName,
      department_id: deptId || null,
    }, {
      onSuccess: (_, variables) => {
        setAddOpen(false);
        resetForm();
        // For Evolution API, open QR modal to pair
        if (isEvolution && savedConfig.api_url && savedConfig.api_key) {
          // Small delay to let the DB insert complete and get the ID
          setTimeout(async () => {
            // Find the newly created integration
            const { data } = await supabase
              .from('integrations')
              .select('id')
              .eq('device_name', variables.device_name)
              .eq('provider', 'evolution')
              .order('created_at', { ascending: false })
              .limit(1);
            const newId = data?.[0]?.id || null;
            setQrModal({
              open: true,
              integrationId: newId,
              apiUrl: savedConfig.api_url,
              apiKey: savedConfig.api_key,
              instanceName: savedInstanceName,
            });
          }, 500);
        }
      },
    });
  };

  const handleEdit = () => {
    if (!editDevice) return;
    const needsPhone = editDevice.provider !== 'evolution';
    if (!editName.trim() || (needsPhone && !editPhone.trim())) {
      toast.error(needsPhone ? 'Preencha nome e número' : 'Preencha o nome');
      return;
    }
    updateDevice.mutate({
      id: editDevice.id,
      updates: {
        device_name: editName,
        phone_number: editPhone,
        config: editConfig,
        department_id: editDeptId === '__none__' ? null : editDeptId || null,
      },
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

      {/* ── Device Grid ─────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : whatsappDevices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Smartphone size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum aparelho cadastrado.</p>
          {permissions.isAdmin && (
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Adicionar primeiro aparelho
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {whatsappDevices.map(d => (
            <DeviceCard
              key={d.id}
              device={d}
              isAdmin={permissions.isAdmin}
              departments={departments}
              onDisconnect={id => setConfirmId(id)}
              onDelete={id => setDeleteId(id)}
              onEdit={openEdit}
              onSyncPhone={handleSyncPhone}
              liveStatus={liveStatus[d.id]}
              onConnect={(dev) => {
                const cfg = dev.config as Record<string, string>;
                if (cfg.api_url && cfg.api_key) {
                  setQrModal({
                    open: true,
                    integrationId: dev.id,
                    apiUrl: cfg.api_url,
                    apiKey: cfg.api_key,
                    instanceName: cfg.instance_name || dev.device_name || 'default',
                  });
                } else {
                  toast.error('Configure a URL e API Key da Evolution API primeiro');
                }
              }}
            />
          ))}
        </div>
      )}

      {/* ── API Info Section ────────────────────────── */}
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

      {/* ── Add Device Modal ────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) { resetForm(); setStep(1); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Aparelho</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Siga os passos abaixo para conectar um número de WhatsApp</p>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center gap-2 py-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 transition-colors ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {step > s ? <Check size={14} /> : s}
                </div>
                <span className={`text-xs hidden sm:inline ${step >= s ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {s === 1 ? 'Provedor' : s === 2 ? 'Dados' : 'Credenciais'}
                </span>
                {s < 3 && <div className={`h-px flex-1 ${step > s ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1 - Provider */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">📋 Como conectar?</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Para <strong>API oficial</strong>: escolha Meta, Twilio, 360dialog ou Gupshup e use suas credenciais</li>
                  <li>Para <strong>QR Code</strong>: escolha <strong>Evolution API</strong> (requer servidor próprio via Docker)</li>
                  <li>Obtenha as credenciais de API (token, chave, URL, etc.)</li>
                  <li>Cole as credenciais aqui no passo 3</li>
                </ol>
              </div>
              <div>
                <Label className="text-xs">Selecione o provedor</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setProvider(p.value);
                        if (p.value === 'evolution') {
                          const existing = integrations?.find(i => i.provider === 'evolution' && i.config?.api_url);
                          if (existing) {
                            setConfig({ api_url: existing.config.api_url, api_key: existing.config.api_key ?? '' });
                          } else {
                            setConfig({});
                          }
                        } else {
                          setConfig({});
                        }
                      }}
                      className={`rounded-lg border p-3 text-left text-xs font-medium transition-all hover:border-primary/50 truncate ${provider === p.value ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 - Basic info */}
          {step === 2 && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Nome do aparelho</Label>
                <Input className="mt-1" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Ex: Vendas - Principal" />
                <p className="text-[11px] text-muted-foreground mt-1">Um nome para identificar este número na sua equipe</p>
              </div>
              {departments.length > 0 && (
                <div>
                  <Label className="text-xs">Departamento *</Label>
                  <Select value={deptId} onValueChange={setDeptId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Conversas recebidas neste número ficarão visíveis apenas para este departamento</p>
                </div>
              )}
              {/* Para Evolution API, o número é detectado automaticamente ao escanear o QR Code */}
              {provider !== 'evolution' && (
                <div>
                  <Label className="text-xs">Número de telefone</Label>
                  <Input className="mt-1" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+5511999999999" />
                  <p className="text-[11px] text-muted-foreground mt-1">Número com código do país (ex: +55 para Brasil)</p>
                </div>
              )}
              {provider === 'evolution' && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <p className="text-xs text-primary font-medium">Número detectado automaticamente</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Após escanear o QR Code, o número do WhatsApp será detectado e salvo automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3 - Credentials */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Provedor selecionado</p>
                <p className="text-sm font-semibold text-foreground">{providerLabel(provider)}</p>
              </div>
              {provider === 'evolution' && config.api_url && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                  <p className="text-xs text-primary font-medium">URL e API Key preenchidas automaticamente</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Basta informar um novo <strong>Nome da instância</strong> para adicionar outro número.</p>
                </div>
              )}
              <ProviderFields provider={provider} config={config} onChange={setConfig} />
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Webhook URL (copie para o painel do provedor)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-foreground bg-muted rounded px-2 py-1.5 truncate">{WEBHOOK_URL}</code>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleCopy(WEBHOOK_URL)}>
                    {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Cole esta URL no campo de webhook do painel do seu provedor para receber mensagens</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => {
                  if (step === 1 && !provider) { toast.error('Selecione um provedor'); return; }
                  if (step === 2 && !deviceName.trim()) { toast.error('Preencha o nome do aparelho'); return; }
                  if (step === 2 && provider !== 'evolution' && !phoneNumber.trim()) { toast.error('Preencha o número de telefone'); return; }
                  if (step === 2 && departments.length > 0 && !deptId) { toast.error('Selecione um departamento'); return; }
                  setStep(s => s + 1);
                }}
              >
                Próximo
              </Button>
            ) : (
              <Button onClick={handleAdd} disabled={addDevice.isPending}>
                {addDevice.isPending ? 'Salvando...' : 'Salvar aparelho'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Device Modal ───────────────────────── */}
      <Dialog open={!!editDevice} onOpenChange={v => { if (!v) setEditDevice(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Aparelho</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Altere o nome, número ou credenciais deste aparelho</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome do aparelho</Label>
              <Input className="mt-1" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ex: Vendas - Principal" />
            </div>
            {editDevice?.provider !== 'evolution' && (
              <div>
                <Label className="text-xs">Número de telefone</Label>
                <Input className="mt-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+5511999999999" />
              </div>
            )}

            {departments.length > 0 && (
              <div>
                <Label className="text-xs">Departamento</Label>
                <Select value={editDeptId} onValueChange={setEditDeptId}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue placeholder="Nenhum departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editDevice && (
              <>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Provedor</p>
                  <p className="text-sm font-semibold text-foreground">{providerLabel(editDevice.provider)}</p>
                </div>
                <ProviderFields provider={editDevice.provider} config={editConfig} onChange={setEditConfig} />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDevice(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateDevice.isPending}>
              {updateDevice.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Disconnect ──────────────────────── */}
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

      {/* ── Confirm Delete ──────────────────────────── */}
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

      {/* ── Evolution QR Code Modal ─────────────────── */}
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
