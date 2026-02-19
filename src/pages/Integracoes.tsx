import { useState } from 'react';
import { Smartphone, Plus, Copy, Check, Wifi, WifiOff, Shield, Globe, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useIntegrations, useAddDevice, useDisconnectDevice, useDeleteDevice, type Integration } from '@/hooks/useIntegrations';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const PROVIDERS = [
  { value: 'meta', label: 'Meta Cloud API' },
  { value: 'twilio', label: 'Twilio' },
  { value: '360dialog', label: '360dialog' },
  { value: 'gupshup', label: 'Gupshup' },
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
  return null;
}

// ── Device Card ──────────────────────────────────────
function DeviceCard({ device, isAdmin, onDisconnect, onDelete }: {
  device: Integration;
  isAdmin: boolean;
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const connected = device.status === 'connected';

  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <Smartphone size={18} className="text-success" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{device.device_name || 'Aparelho sem nome'}</h3>
            <p className="text-xs text-muted-foreground">{formatPhone(device.phone_number)}</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 ${connected ? 'bg-success/15 text-success border-success/20' : 'bg-destructive/15 text-destructive border-destructive/20'}`}>
          {connected ? <><Wifi size={10} className="mr-1" /> Conectado</> : <><WifiOff size={10} className="mr-1" /> Desconectado</>}
        </Badge>
      </div>

      <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
        <p className="text-xs text-muted-foreground">Provedor</p>
        <p className="text-sm font-medium text-foreground">{providerLabel(device.provider)}</p>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 pt-1">
          {connected && (
            <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => onDisconnect(device.id)}>
              Desativar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(device.id)}>
            <Trash2 size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
export default function IntegracoesPage() {
  const permissions = usePermissions();
  const { data: integrations, isLoading } = useIntegrations();
  const addDevice = useAddDevice();
  const disconnectDevice = useDisconnectDevice();
  const deleteDevice = useDeleteDevice();

  const [addOpen, setAddOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // form state
  const [deviceName, setDeviceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});

  const whatsappDevices = integrations?.filter(i => i.channel === 'whatsapp') ?? [];

  const resetForm = () => {
    setDeviceName('');
    setPhoneNumber('');
    setProvider('');
    setConfig({});
  };

  const handleAdd = () => {
    if (!deviceName.trim() || !phoneNumber.trim() || !provider) {
      toast.error('Preencha nome, número e provedor');
      return;
    }
    addDevice.mutate({
      channel: 'whatsapp',
      provider,
      config,
      phone_number: phoneNumber,
      device_name: deviceName,
    }, {
      onSuccess: () => {
        setAddOpen(false);
        resetForm();
      },
    });
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
          permissions.isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Adicionar Aparelho
            </Button>
          )
        }
      />

      {/* ── Device Grid ─────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
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
              onDisconnect={id => setConfirmId(id)}
              onDelete={id => setDeleteId(id)}
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
      <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Aparelho</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome do aparelho</Label>
              <Input className="mt-1" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Ex: Vendas - Principal" />
            </div>
            <div>
              <Label className="text-xs">Número de telefone</Label>
              <Input className="mt-1" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+5511999999999" />
            </div>
            <div>
              <Label className="text-xs">Provedor</Label>
              <Select value={provider} onValueChange={v => { setProvider(v); setConfig({}); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar provedor" /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {provider && <ProviderFields provider={provider} config={config} onChange={setConfig} />}
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Webhook URL (copie para o painel do provedor)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-foreground bg-muted rounded px-2 py-1.5 truncate">{WEBHOOK_URL}</code>
                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleCopy(WEBHOOK_URL)}>
                  {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={addDevice.isPending}>
              {addDevice.isPending ? 'Salvando...' : 'Salvar'}
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
    </div>
  );
}
