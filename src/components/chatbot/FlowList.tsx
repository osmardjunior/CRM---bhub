import { useState } from 'react';
import { Plus, Trash2, Zap, Sparkles, MessageSquare, ClipboardList, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof MessageSquare;
  nodes: Array<{ node_type: ChatbotNode['node_type']; config: Record<string, unknown> }>;
}

const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'welcome_menu',
    name: 'Menu de Boas-vindas',
    description: 'Apresenta um menu de opções ao cliente ao iniciar conversa.',
    icon: MessageSquare,
    nodes: [
      { node_type: 'message', config: { text: 'Olá! 👋 Bem-vindo(a). Como posso te ajudar hoje?' } },
      { node_type: 'menu', config: { text: 'Selecione uma opção:', options: [{ label: 'Informações' }, { label: 'Suporte' }, { label: 'Falar com atendente' }] } },
      { node_type: 'message', config: { text: 'Obrigado pelo contato! Em breve retornaremos. 😊' } },
    ],
  },
  {
    id: 'lead_capture',
    name: 'Coleta de Lead',
    description: 'Coleta nome, e-mail e telefone do contato automaticamente.',
    icon: ClipboardList,
    nodes: [
      { node_type: 'message', config: { text: 'Olá! Para te atender melhor, preciso de algumas informações.' } },
      { node_type: 'collect_data', config: { prompt: 'Por favor, informe seus dados:', fields: ['name', 'email', 'phone'] } },
      { node_type: 'message', config: { text: 'Perfeito! Nossa equipe entrará em contato em breve. 🚀' } },
    ],
  },
  {
    id: 'faq_transfer',
    name: 'FAQ + Encaminhar',
    description: 'Verifica horário comercial e transfere para atendente.',
    icon: HelpCircle,
    nodes: [
      { node_type: 'message', config: { text: 'Olá! Bem-vindo(a) ao nosso suporte. 🛠️' } },
      { node_type: 'condition', config: {} },
      { node_type: 'transfer', config: { message: 'Transferindo você para um de nossos atendentes. Aguarde!' } },
    ],
  },
];

const TRIGGER_LABELS: Record<string, string> = {
  none: 'Manual',
  first_message: '1ª mensagem',
  any_message: 'Qualquer msg',
  keyword: 'Palavra-chave',
  status_resolved: 'Resolvido',
  status_opened: 'Em Atend.',
  new_contact: 'Novo contato',
};

function getTriggerLabel(flow: ChatbotFlow) {
  const bh = flow.business_hours as Record<string, any> || {};
  const type = bh._trigger?.type || 'none';
  return TRIGGER_LABELS[type] || 'Manual';
}

interface FlowListProps {
  flows: ChatbotFlow[];
  onSelect: (flow: ChatbotFlow) => void;
  onCreate: (name: string) => void;
  onCreateFromTemplate: (name: string, nodes: Array<{ node_type: ChatbotNode['node_type']; config: Record<string, unknown> }>) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export default function FlowList({ flows, onSelect, onCreate, onCreateFromTemplate, onDelete, onToggleActive }: FlowListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate || !templateName.trim()) return;
    onCreateFromTemplate(templateName.trim(), selectedTemplate.nodes);
    setSelectedTemplate(null);
    setTemplateName('');
  };

  const templatesSection = (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-primary" />
        <p className="text-sm font-medium text-foreground">Começar com um template</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {FLOW_TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          return (
            <Card
              key={tpl.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => { setSelectedTemplate(tpl); setTemplateName(tpl.name); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{tpl.description}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{tpl.nodes.length} etapas</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const dialogs = (
    <>
      {/* Create blank flow dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fluxo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome do fluxo</Label>
            <Input
              placeholder="Ex: Atendimento Principal"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template name dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={open => { if (!open) setSelectedTemplate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
            <Label>Nome do fluxo</Label>
            <Input
              placeholder="Ex: Atendimento Principal"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyTemplate()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>Cancelar</Button>
            <Button onClick={handleApplyTemplate} disabled={!templateName.trim()}>
              <Sparkles size={14} className="mr-2" /> Criar com template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir fluxo"
        description="Tem certeza que deseja excluir este fluxo? Todas as etapas serão removidas permanentemente."
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
      />
    </>
  );

  if (flows.length === 0) {
    return (
      <div className="py-10">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
            <Plus size={28} className="text-accent-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum fluxo criado</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Crie seu primeiro fluxo de chatbot para automatizar o atendimento aos seus clientes.
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} className="mr-2" /> Criar fluxo em branco
          </Button>
        </div>
        {templatesSection}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{flows.length} fluxo(s) criado(s)</p>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus size={16} className="mr-2" /> Novo fluxo
        </Button>
      </div>

      <div className="grid gap-3">
        {flows.map(flow => (
          <Card key={flow.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => onSelect(flow)}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground truncate">{flow.name}</h4>
                  <Badge variant={flow.is_active ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {flow.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    Criado em {format(new Date(flow.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Zap size={10} className="text-warning" />
                    {getTriggerLabel(flow)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Switch checked={flow.is_active} onCheckedChange={checked => onToggleActive(flow.id, checked)} />
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(flow.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templatesSection}
      {dialogs}
    </div>
  );
}
