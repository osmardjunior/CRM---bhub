import { useState } from 'react';
import {
  Building2,
  Users,
  Wifi,
  Save,
  Plus,
  Copy,
  Check,
  ImageIcon,
  Shield,
  Eye,
  Headphones,
  Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatusBadge from '@/components/StatusBadge';
import { usePermissions, getPermissionTooltip } from '@/hooks/usePermissions';

const mockUsers = [
  { id: '1', name: 'Davi César', email: 'davi@allinsistemas.com', role: 'Admin', status: 'online' as const },
  { id: '2', name: 'Ana Silva', email: 'ana@allinsistemas.com', role: 'Supervisor', status: 'online' as const },
  { id: '3', name: 'Carlos Rocha', email: 'carlos@allinsistemas.com', role: 'Agente', status: 'ausente' as const },
  { id: '4', name: 'Felipe Moura', email: 'felipe@allinsistemas.com', role: 'Agente', status: 'offline' as const },
];

const roleDescriptions = [
  { role: 'Admin', icon: Shield, desc: 'Acesso total ao sistema. Gerencia usuários, configurações e todas as áreas.' },
  { role: 'Supervisor', icon: Eye, desc: 'Visualiza relatórios, gerencia equipe e monitora conversas em tempo real.' },
  { role: 'Agente', icon: Headphones, desc: 'Atende conversas, gerencia contatos atribuídos e cria tarefas.' },
];

export default function ConfiguracoesPage() {
  const permissions = usePermissions();
  const manageTooltip = getPermissionTooltip('canManageUsers', permissions);
  const [activeTab, setActiveTab] = useState('empresa');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  const [invite, setInvite] = useState({ name: '', email: '', role: '' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  const [waForm, setWaForm] = useState({ provider: '', token: '', phoneId: '' });

  const webhookUrl = 'https://api.allinsistemas.com/webhooks/whatsapp/abc123def';

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateInvite = () => {
    const e: Record<string, string> = {};
    if (!invite.name.trim()) e.name = 'Obrigatório';
    if (!invite.email.trim()) e.email = 'Obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) e.email = 'Email inválido';
    if (!invite.role) e.role = 'Obrigatório';
    setInviteErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleInvite = () => {
    if (validateInvite()) {
      setInviteOpen(false);
      setInvite({ name: '', email: '', role: '' });
      setInviteErrors({});
    }
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
              <Users size={14} /> Usuários & Permissões
            </TabsTrigger>
            <TabsTrigger value="canais" className="gap-1.5 data-[state=active]:bg-secondary rounded-lg px-3 py-2 text-xs">
              <Wifi size={14} /> Canais
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* ===== EMPRESA ===== */}
          <TabsContent value="empresa" className="mt-0 space-y-6">
            <div className="rounded-xl border border-border bg-card card-shadow p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">Dados da Empresa</h2>

              {/* Logo placeholder */}
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <ImageIcon size={24} className="text-muted-foreground" />
                </div>
                <div>
                  <Button variant="outline" size="sm" className="text-xs">Alterar logo</Button>
                  <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome da empresa</Label>
                  <Input defaultValue="All In Sistemas" className="bg-secondary border-0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <Input defaultValue="12.345.678/0001-90" className="bg-secondary border-0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fuso horário</Label>
                  <Select defaultValue="america_sp">
                    <SelectTrigger className="bg-secondary border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="america_sp">América/São_Paulo (GMT-3)</SelectItem>
                      <SelectItem value="america_manaus">América/Manaus (GMT-4)</SelectItem>
                      <SelectItem value="america_belem">América/Belém (GMT-3)</SelectItem>
                      <SelectItem value="america_noronha">América/Noronha (GMT-2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Horário de atendimento</Label>
                  <div className="flex items-center gap-2">
                    <Input defaultValue="08:00" type="time" className="bg-secondary border-0 flex-1" />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input defaultValue="18:00" type="time" className="bg-secondary border-0 flex-1" />
                  </div>
                </div>
              </div>

              <Button className="mt-5 gap-1.5" size="sm">
                <Save size={14} /> Salvar
              </Button>
            </div>
          </TabsContent>

          {/* ===== USUÁRIOS ===== */}
          <TabsContent value="usuarios" className="mt-0 space-y-6">
            {!permissions.canManageUsers && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                <Lock size={14} className="text-warning shrink-0" />
                <p className="text-xs text-warning">Você não tem permissão para gerenciar usuários. Entre em contato com um administrador.</p>
              </div>
            )}
            {/* Users table */}
            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold text-foreground">Membros da equipe</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={() => setInviteOpen(true)}
                        disabled={!permissions.canManageUsers}
                      >
                        <Plus size={14} /> Convidar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {manageTooltip && (
                    <TooltipContent>
                      <p className="text-xs">{manageTooltip}</p>
                    </TooltipContent>
                  )}
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
                  {mockUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={u.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Role descriptions */}
            <div className="rounded-xl border border-border bg-card card-shadow p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Descrição dos cargos</h3>
              <div className="space-y-3">
                {roleDescriptions.map((r) => (
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

          {/* ===== CANAIS ===== */}
          <TabsContent value="canais" className="mt-0 space-y-6">
            {/* WhatsApp card */}
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
                <Badge
                  variant="outline"
                  className={`text-xs ${whatsappConnected ? 'bg-success/15 text-success border-success/20' : 'bg-destructive/15 text-destructive border-destructive/20'}`}
                >
                  {whatsappConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>

              {whatsappConnected ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Número conectado</p>
                    <p className="text-sm font-medium text-foreground">+55 (11) 99999-0000</p>
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
                  <Button variant="destructive" size="sm" className="text-xs" onClick={() => setWhatsappConnected(false)}>
                    Desconectar
                  </Button>
                </div>
              ) : (
                <Button size="sm" className="gap-1.5" onClick={() => setWhatsappOpen(true)}>
                  <Wifi size={14} /> Conectar WhatsApp
                </Button>
              )}
            </div>

            {/* Other channels placeholder */}
            {['Instagram Direct', 'Webchat Widget'].map((name) => (
              <div key={name} className="rounded-xl border border-border bg-card card-shadow p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                  <p className="text-xs text-muted-foreground">Em breve</p>
                </div>
                <Badge variant="outline" className="text-xs">Em breve</Badge>
              </div>
            ))}
          </TabsContent>
        </div>
      </Tabs>

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={() => { setInviteOpen(false); setInviteErrors({}); setInvite({ name: '', email: '', role: '' }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="Nome completo" className={`mt-1 ${inviteErrors.name ? 'border-destructive' : ''}`} />
              {inviteErrors.name && <p className="text-xs text-destructive mt-1">{inviteErrors.name}</p>}
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="email@empresa.com" className={`mt-1 ${inviteErrors.email ? 'border-destructive' : ''}`} />
              {inviteErrors.email && <p className="text-xs text-destructive mt-1">{inviteErrors.email}</p>}
            </div>
            <div>
              <Label className="text-xs">Cargo *</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
                <SelectTrigger className={`mt-1 ${inviteErrors.role ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Selecionar cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="Agente">Agente</SelectItem>
                </SelectContent>
              </Select>
              {inviteErrors.role && <p className="text-xs text-destructive mt-1">{inviteErrors.role}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite}>Enviar Convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp connect modal */}
      <Dialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Provedor</Label>
              <Select value={waForm.provider} onValueChange={(v) => setWaForm({ ...waForm, provider: v })}>
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
              <Input value={waForm.token} onChange={(e) => setWaForm({ ...waForm, token: e.target.value })} placeholder="EAABx..." className="mt-1" type="password" />
            </div>
            <div>
              <Label className="text-xs">Phone Number ID</Label>
              <Input value={waForm.phoneId} onChange={(e) => setWaForm({ ...waForm, phoneId: e.target.value })} placeholder="1234567890" className="mt-1" />
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
            <Button onClick={() => { setWhatsappConnected(true); setWhatsappOpen(false); }}>Conectar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
