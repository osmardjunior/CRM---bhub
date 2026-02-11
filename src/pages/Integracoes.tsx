import { useState } from 'react';
import { Wifi, Copy, Check, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useIntegrations, useUpsertIntegration, useDisconnectIntegration } from '@/hooks/useIntegrations';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';

export default function IntegracoesPage() {
  const permissions = usePermissions();
  const { data: integrations, isLoading } = useIntegrations();
  const upsertIntegration = useUpsertIntegration();
  const disconnectIntegration = useDisconnectIntegration();

  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [waForm, setWaForm] = useState({ provider: '', token: '', phoneId: '' });
  const [copied, setCopied] = useState(false);

  const whatsappIntegration = integrations?.find(i => i.channel === 'whatsapp');
  const isWhatsappConnected = whatsappIntegration?.status === 'connected';
  const webhookUrl = `https://loamacrszlgxhaqvnkzw.supabase.co/functions/v1/incoming-message`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectWhatsApp = () => {
    if (!waForm.provider || !waForm.token) {
      toast.error('Preencha provedor e token');
      return;
    }
    upsertIntegration.mutate({
      channel: 'whatsapp',
      provider: waForm.provider,
      config: { token: waForm.token, phone_id: waForm.phoneId },
      status: 'connected',
    });
    setWhatsappOpen(false);
    setWaForm({ provider: '', token: '', phoneId: '' });
  };

  const handleDisconnectWhatsApp = () => {
    disconnectIntegration.mutate('whatsapp');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Integrações" subtitle="Gerencie suas conexões com canais de comunicação." />

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border border-border bg-card card-shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-success" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">WhatsApp Business API</h3>
                <p className="text-xs text-muted-foreground">Conecte seu número para enviar e receber mensagens</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-xs ${isWhatsappConnected ? 'bg-success/15 text-success border-success/20' : 'bg-destructive/15 text-destructive border-destructive/20'}`}>
              {isWhatsappConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>

          {isWhatsappConnected ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Provedor</p>
                <p className="text-sm font-medium text-foreground capitalize">{whatsappIntegration?.provider}</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-foreground bg-muted rounded px-2 py-1.5 truncate">{webhookUrl}</code>
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </Button>
                </div>
              </div>
              <Button variant="destructive" size="sm" className="text-xs" onClick={handleDisconnectWhatsApp} disabled={disconnectIntegration.isPending}>
                {disconnectIntegration.isPending ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </div>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => setWhatsappOpen(true)} disabled={!permissions.isAdmin}>
              <Wifi size={14} /> Conectar WhatsApp
            </Button>
          )}
        </div>
      )}

      {/* Future channels */}
      {['Instagram Direct', 'Webchat Widget'].map(name => (
        <div key={name} className="rounded-xl border border-border bg-card card-shadow p-5 flex items-center justify-between opacity-60">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </div>
          <Badge variant="outline" className="text-xs">Em breve</Badge>
        </div>
      ))}

      {/* WhatsApp connect modal */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Conectar WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Provedor</Label>
              <Select value={waForm.provider} onValueChange={v => setWaForm({ ...waForm, provider: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar provedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta (Cloud API)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="360dialog">360dialog</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Token de acesso</Label>
              <Input value={waForm.token} onChange={e => setWaForm({ ...waForm, token: e.target.value })} placeholder="EAABx..." className="mt-1" type="password" />
            </div>
            <div>
              <Label className="text-xs">Phone Number ID</Label>
              <Input value={waForm.phoneId} onChange={e => setWaForm({ ...waForm, phoneId: e.target.value })} placeholder="1234567890" className="mt-1" />
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Webhook URL (copie para o painel do provedor)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-foreground bg-muted rounded px-2 py-1.5 truncate">{webhookUrl}</code>
                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
                  {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappOpen(false)}>Cancelar</Button>
            <Button onClick={handleConnectWhatsApp} disabled={upsertIntegration.isPending}>
              {upsertIntegration.isPending ? 'Conectando...' : 'Conectar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
