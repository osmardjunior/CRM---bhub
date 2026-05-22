import { useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PROVIDERS, WEBHOOK_URL, ProviderFields, providerLabel } from '@/components/integracoes/DeviceCard';

export interface AddDeviceFormData {
  deviceName: string;
  phoneNumber: string;
  provider: string;
  config: Record<string, string>;
  departmentId: string | null;
}

interface AddDeviceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: { id: string; name: string }[];
  existingEvolutionConfig?: { api_url: string; api_key: string };
  isPending: boolean;
  onSubmit: (data: AddDeviceFormData) => void;
}

export default function AddDeviceDialog({ open, onOpenChange, departments, existingEvolutionConfig, isPending, onSubmit }: AddDeviceDialogProps) {
  const [step, setStep] = useState(1);
  const [deviceName, setDeviceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [deptId, setDeptId] = useState('');
  const [copied, setCopied] = useState(false);

  const quickAddMode = !!existingEvolutionConfig;

  const resetForm = () => {
    setDeviceName('');
    setPhoneNumber('');
    setProvider('');
    setConfig({});
    setDeptId('');
    setStep(1);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toInstanceName = (name: string) => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${slug}-${suffix}`;
  };

  const handleQuickAdd = () => {
    if (!deviceName.trim()) { toast.error('Preencha o nome do aparelho'); return; }
    if (!existingEvolutionConfig) return;
    onSubmit({
      deviceName: deviceName.trim(),
      phoneNumber: '',
      provider: 'evolution',
      config: { ...existingEvolutionConfig, instance_name: toInstanceName(deviceName) },
      departmentId: deptId || null,
    });
  };

  const handleAdd = () => {
    const needsPhone = provider !== 'evolution';
    if (!deviceName.trim() || !provider || (needsPhone && !phoneNumber.trim())) {
      toast.error(needsPhone ? 'Preencha nome, número e provedor' : 'Preencha nome e provedor');
      return;
    }
    if (provider === 'evolution' && (!config.api_url?.trim() || !config.api_key?.trim() || !config.instance_name?.trim())) {
      toast.error('Preencha a URL da API, API Key e Nome da instância');
      return;
    }
    onSubmit({
      deviceName: deviceName.trim(),
      phoneNumber: needsPhone ? phoneNumber : '',
      provider,
      config,
      departmentId: deptId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Número</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {quickAddMode ? 'Digite o nome do número e escaneie o QR Code para conectar.' : 'Siga os passos abaixo para conectar um número de WhatsApp'}
          </p>
        </DialogHeader>

        {/* Quick Add (Evolution credentials already exist) */}
        {quickAddMode ? (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome do aparelho</Label>
              <Input
                className="mt-1"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !isPending) handleQuickAdd(); }}
                placeholder="Ex: Vendas - Principal"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">Um nome para identificar este número na sua equipe</p>
            </div>
            {departments.length > 0 && (
              <div>
                <Label className="text-xs">Departamento</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o departamento (opcional)" />
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
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <QrCode size={12} /> Número detectado pelo QR Code
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Após clicar em Adicionar, escaneie o QR Code com o WhatsApp para conectar.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Full Stepper */}
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

            {step === 1 && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Como conectar?</p>
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
                      <button key={p.value} type="button"
                        onClick={() => { setProvider(p.value); setConfig({}); }}
                        className={`rounded-lg border p-3 text-left text-xs font-medium transition-all hover:border-primary/50 truncate ${provider === p.value ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs">Nome do aparelho</Label>
                  <Input className="mt-1" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Ex: Vendas - Principal" />
                  <p className="text-[11px] text-muted-foreground mt-1">Um nome para identificar este número na sua equipe</p>
                </div>
                {departments.length > 0 && (
                  <div>
                    <Label className="text-xs">Departamento</Label>
                    <Select value={deptId} onValueChange={setDeptId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o departamento (opcional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {departments.map(d => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">Após escanear o QR Code, o número será detectado e salvo automaticamente.</p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Provedor selecionado</p>
                  <p className="text-sm font-semibold text-foreground">{providerLabel(provider)}</p>
                </div>
                <ProviderFields provider={provider} config={config} onChange={setConfig} />
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
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          {!quickAddMode && step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>
          )}
          {quickAddMode ? (
            <Button onClick={handleQuickAdd} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          ) : step < 3 ? (
            <Button
              onClick={() => {
                if (step === 1 && !provider) { toast.error('Selecione um provedor'); return; }
                if (step === 2 && !deviceName.trim()) { toast.error('Preencha o nome do aparelho'); return; }
                if (step === 2 && provider !== 'evolution' && !phoneNumber.trim()) { toast.error('Preencha o número de telefone'); return; }
                setStep(s => s + 1);
              }}
            >
              Próximo
            </Button>
          ) : (
            <Button onClick={handleAdd} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar aparelho'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
