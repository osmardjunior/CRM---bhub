import { Smartphone, Wifi, WifiOff, Shield, Trash2, Pencil, Phone, Server, QrCode, RefreshCw, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Integration } from '@/hooks/useIntegrations';

export const PROVIDERS = [
  { value: 'meta', label: 'Meta Cloud API' },
  { value: 'twilio', label: 'Twilio' },
  { value: '360dialog', label: '360dialog' },
  { value: 'gupshup', label: 'Gupshup' },
  { value: 'evolution', label: 'Evolution API' },
];

export const WEBHOOK_URL = `https://loamacrszlgxhaqvnkzw.supabase.co/functions/v1/incoming-message`;

export function providerLabel(p: string) {
  return PROVIDERS.find(pr => pr.value === p)?.label ?? p;
}

export function formatPhone(phone: string | null) {
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

export function maskSecret(s?: string) {
  if (!s || s.length < 8) return '••••••••';
  return s.slice(0, 4) + '••••' + s.slice(-4);
}

export function ProviderFields({ provider, config, onChange }: {
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

interface DeviceCardProps {
  device: Integration;
  isAdmin: boolean;
  departments: { id: string; name: string }[];
  onDisconnect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (device: Integration) => void;
  onConnect: (device: Integration) => void;
  onSyncPhone: (device: Integration) => void;
  liveStatus?: 'checking' | 'connected' | 'disconnected';
}

export default function DeviceCard({ device, isAdmin, departments, onDisconnect, onDelete, onEdit, onConnect, onSyncPhone, liveStatus }: DeviceCardProps) {
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
