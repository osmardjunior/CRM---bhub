import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Zap, Sparkles, MessageSquare, ClipboardList, HelpCircle, ChevronRight, ArrowLeft, FolderOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';
import { useDepartments } from '@/hooks/useDepartments';
import { useProjects } from '@/hooks/useProjects';
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

type NavigationLevel = 'departments' | 'projects' | 'flows';

interface FlowListProps {
  flows: ChatbotFlow[];
  onSelect: (flow: ChatbotFlow) => void;
  onCreate: (name: string | { name: string; department_id?: string | null; project_id?: string | null }) => void;
  onCreateFromTemplate: (name: string, nodes: Array<{ node_type: ChatbotNode['node_type']; config: Record<string, unknown> }>) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export default function FlowList({ flows, onSelect, onCreate, onCreateFromTemplate, onDelete, onToggleActive }: FlowListProps) {
  const { data: departments = [] } = useDepartments();

  // Navigation state
  const [level, setLevel] = useState<NavigationLevel>('departments');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: deptProjects = [] } = useProjects(selectedDeptId ?? undefined);

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDeptId, setNewDeptId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');

  // Create flow projects for the create dialog
  const { data: createDialogProjects = [] } = useProjects(newDeptId || undefined);

  // Auto-skip projects level if department has no projects (only unassigned flows)
  useEffect(() => {
    if (level === 'projects' && selectedDeptId) {
      const deptFlows = flows.filter(f =>
        selectedDeptId === '__none__' ? !f.department_id : f.department_id === selectedDeptId
      );
      const hasProjectFlows = deptFlows.some(f => f.project_id);
      const hasProjects = selectedDeptId !== '__none__' && deptProjects.length > 0;
      if (!hasProjectFlows && !hasProjects) {
        setSelectedProjectId(null);
        setLevel('flows');
      }
    }
  }, [level, selectedDeptId, flows, deptProjects]);

  // Group flows by department
  const deptGroups = useMemo(() => {
    const map = new Map<string, ChatbotFlow[]>();
    flows.forEach(f => {
      const key = f.department_id ?? '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return map;
  }, [flows]);

  // Flows for current project/dept
  const currentFlows = useMemo(() => {
    if (level === 'flows') {
      return flows.filter(f => {
        if (selectedProjectId === '__none__') {
          return f.department_id === selectedDeptId && !f.project_id;
        }
        if (selectedProjectId) {
          return f.project_id === selectedProjectId;
        }
        if (selectedDeptId === '__none__') {
          return !f.department_id;
        }
        return f.department_id === selectedDeptId;
      });
    }
    return [];
  }, [flows, level, selectedDeptId, selectedProjectId]);

  // Project groups for current department
  const projectGroups = useMemo(() => {
    if (level !== 'projects' || !selectedDeptId) return new Map<string, ChatbotFlow[]>();
    const deptFlows = flows.filter(f =>
      selectedDeptId === '__none__' ? !f.department_id : f.department_id === selectedDeptId
    );
    const map = new Map<string, ChatbotFlow[]>();
    deptFlows.forEach(f => {
      const key = f.project_id ?? '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return map;
  }, [flows, level, selectedDeptId]);

  const navigateToDept = (deptId: string) => {
    setSelectedDeptId(deptId);
    setSelectedProjectId(null);
    // If department has projects, go to projects level; otherwise go directly to flows
    setLevel('projects');
  };

  const navigateToProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setLevel('flows');
  };

  const goBack = () => {
    if (level === 'flows') {
      setSelectedProjectId(null);
      setLevel('projects');
    } else if (level === 'projects') {
      setSelectedDeptId(null);
      setLevel('departments');
    }
  };

  const selectedDeptName = selectedDeptId === '__none__'
    ? 'Sem departamento'
    : departments.find(d => d.id === selectedDeptId)?.name ?? 'Departamento';

  const selectedProjectName = selectedProjectId === '__none__'
    ? 'Sem projeto'
    : deptProjects.find(p => p.id === selectedProjectId)?.name ?? 'Projeto';

  const handleCreate = () => {
    if (!newName.trim()) return;
    const payload: { name: string; department_id?: string | null; project_id?: string | null } = { name: newName.trim() };
    // Pre-fill dept/project from navigation context
    if (newDeptId) payload.department_id = newDeptId === '__none__' ? null : newDeptId;
    else if (selectedDeptId && selectedDeptId !== '__none__') payload.department_id = selectedDeptId;
    if (newProjectId) payload.project_id = newProjectId === '__none__' ? null : newProjectId;
    else if (selectedProjectId && selectedProjectId !== '__none__') payload.project_id = selectedProjectId;
    onCreate(payload);
    setNewName('');
    setNewDeptId('');
    setNewProjectId('');
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fluxo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do fluxo</Label>
              <Input
                placeholder="Ex: Atendimento Principal"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
                className="mt-1"
              />
            </div>
            {departments.length > 0 && (
              <div>
                <Label className="text-xs">Departamento</Label>
                <Select value={newDeptId || (selectedDeptId && selectedDeptId !== '__none__' ? selectedDeptId : '')} onValueChange={v => { setNewDeptId(v); setNewProjectId(''); }}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Selecionar departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(newDeptId || (selectedDeptId && selectedDeptId !== '__none__')) && createDialogProjects.length > 0 && (
              <div>
                <Label className="text-xs">Projeto</Label>
                <Select value={newProjectId || (selectedProjectId && selectedProjectId !== '__none__' ? selectedProjectId : '')} onValueChange={setNewProjectId}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue placeholder="Selecionar projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {createDialogProjects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

  // --- DEPARTMENT LEVEL ---
  if (level === 'departments') {
    // Build dept list with counts
    const deptList: Array<{ id: string; name: string; count: number }> = [];
    departments.forEach(d => {
      const count = deptGroups.get(d.id)?.length ?? 0;
      deptList.push({ id: d.id, name: d.name, count });
    });
    const noneCount = deptGroups.get('__none__')?.length ?? 0;

    // If no departments exist, go straight to flat flow list
    if (departments.length === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{flows.length} fluxo(s)</p>
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus size={16} className="mr-2" /> Novo fluxo
            </Button>
          </div>
          <FlowCardList
            flows={flows}
            onSelect={onSelect}
            onToggleActive={onToggleActive}
            onDelete={id => setDeleteId(id)}
          />
          {flows.length === 0 && templatesSection}
          {dialogs}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{flows.length} fluxo(s) em {departments.length} departamento(s)</p>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={16} className="mr-2" /> Novo fluxo
          </Button>
        </div>

        <div className="grid gap-2">
          {deptList.map(d => (
            <Card
              key={d.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigateToDept(d.id)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FolderOpen size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">{d.name}</h4>
                  <p className="text-xs text-muted-foreground">{d.count} fluxo(s)</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
          {noneCount > 0 && (
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigateToDept('__none__')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <FolderOpen size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">Sem departamento</h4>
                  <p className="text-xs text-muted-foreground">{noneCount} fluxo(s)</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          )}
        </div>

        {flows.length === 0 && templatesSection}
        {dialogs}
      </div>
    );
  }

  // --- PROJECTS LEVEL ---
  if (level === 'projects') {
    const projList: Array<{ id: string; name: string; count: number }> = [];
    if (selectedDeptId && selectedDeptId !== '__none__') {
      deptProjects.forEach(p => {
        const count = projectGroups.get(p.id)?.length ?? 0;
        projList.push({ id: p.id, name: p.name, count });
      });
    }
    const noneCount = projectGroups.get('__none__')?.length ?? 0;
    const totalFlows = [...projectGroups.values()].reduce((sum, arr) => sum + arr.length, 0);

    // If no projects exist, the useEffect above handles auto-skip
    if (projList.length === 0 && noneCount === 0) {
      return null; // Still loading or empty
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
            <ArrowLeft size={16} />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{selectedDeptName}</h3>
            <p className="text-xs text-muted-foreground">{totalFlows} fluxo(s)</p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={16} className="mr-2" /> Novo fluxo
          </Button>
        </div>

        <div className="grid gap-2">
          {projList.map(p => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigateToProject(p.id)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <Layers size={18} className="text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">{p.name}</h4>
                  <p className="text-xs text-muted-foreground">{p.count} fluxo(s)</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
          {noneCount > 0 && (
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigateToProject('__none__')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Layers size={18} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">Sem projeto</h4>
                  <p className="text-xs text-muted-foreground">{noneCount} fluxo(s)</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          )}
        </div>

        {dialogs}
      </div>
    );
  }

  // --- FLOWS LEVEL ---
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{selectedDeptName}</span>
            {selectedProjectId && (
              <>
                <ChevronRight size={10} />
                <span>{selectedProjectName}</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{currentFlows.length} fluxo(s)</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus size={16} className="mr-2" /> Novo fluxo
        </Button>
      </div>

      {currentFlows.length === 0 ? (
        <div className="py-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3">
            <Plus size={24} className="text-accent-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">Nenhum fluxo aqui.</p>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus size={14} className="mr-2" /> Criar fluxo
          </Button>
          {templatesSection}
        </div>
      ) : (
        <FlowCardList
          flows={currentFlows}
          onSelect={onSelect}
          onToggleActive={onToggleActive}
          onDelete={id => setDeleteId(id)}
        />
      )}

      {dialogs}
    </div>
  );
}

// Extracted flow card list component
function FlowCardList({
  flows,
  onSelect,
  onToggleActive,
  onDelete,
}: {
  flows: ChatbotFlow[];
  onSelect: (flow: ChatbotFlow) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
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
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(flow.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
