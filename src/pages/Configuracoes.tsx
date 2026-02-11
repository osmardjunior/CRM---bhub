import { Settings, User, Bell, Palette, Shield, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const sections = [
  { icon: User, label: 'Perfil', id: 'perfil' },
  { icon: Bell, label: 'Notificações', id: 'notificacoes' },
  { icon: Palette, label: 'Aparência', id: 'aparencia' },
  { icon: Shield, label: 'Segurança', id: 'seguranca' },
  { icon: Globe, label: 'Integrações', id: 'integracoes' },
];

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profile section */}
      <div className="rounded-xl border border-border bg-card card-shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Perfil</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Nome</Label>
            <Input defaultValue="Ana Silva" className="bg-secondary border-0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Email</Label>
            <Input defaultValue="ana@chatguru.com" className="bg-secondary border-0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Cargo</Label>
            <Input defaultValue="Gerente de Suporte" className="bg-secondary border-0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Telefone</Label>
            <Input defaultValue="(11) 99999-0000" className="bg-secondary border-0" />
          </div>
        </div>
        <Button className="mt-4" size="sm">Salvar Alterações</Button>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-card card-shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Notificações</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Novas mensagens', desc: 'Receber notificação quando uma nova mensagem chegar', default: true },
            { label: 'Tarefas vencidas', desc: 'Alertar quando uma tarefa estiver atrasada', default: true },
            { label: 'Novos contatos', desc: 'Notificar quando um novo contato for adicionado', default: false },
            { label: 'Atualizações do pipeline', desc: 'Avisar quando um negócio mudar de etapa', default: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch defaultChecked={item.default} />
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className="rounded-xl border border-border bg-card card-shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Integrações</h2>
        </div>
        <div className="space-y-3">
          {[
            { name: 'WhatsApp Business', connected: true },
            { name: 'Google Calendar', connected: false },
            { name: 'Slack', connected: false },
            { name: 'Zapier', connected: true },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm font-medium text-foreground">{item.name}</span>
              <Button size="sm" variant={item.connected ? 'secondary' : 'outline'} className="text-xs">
                {item.connected ? 'Conectado' : 'Conectar'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
