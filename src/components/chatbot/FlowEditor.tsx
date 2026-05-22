import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Play, Plus, Save, Check,
  AlertTriangle, Smartphone, ChevronDown, ChevronRight,
  MessageSquare, List, ClipboardList, Bot, Route, ArrowRightLeft,
  UserPlus, GitBranch, Tag, Filter, Clock, XCircle, Globe,
  GripVertical, Trash2, Power, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NodeConfigPanel from './NodeConfigPanel';
import FlowSimulator from './FlowSimulator';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useProjectContext } from '@/contexts/ProjectContext';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';
import { MessageCircle, Instagram, Globe as GlobeIcon } from 'lucide-react';

// ── Constants ────────────────────────────────────────────

function getIntegrationIds(flow: ChatbotFlow): string[] {
  const bh = (flow.business_hours as Record<string, unknown> | null) ?? {};
  const trigger = bh._trigger as { integration_ids?: string[] } | undefined;
  return trigger?.integration_ids ?? [];
}

const TRIGGER_OPTIONS = [
  { value: 'none', label: 'Nenhum (manual)', desc: 'O fluxo só é executado manualmente' },
  { value: 'first_message', label: 'Primeira mensagem do contato', desc: 'Ativa quando o contato envia a primeira mensagem' },
  { value: 'any_message', label: 'Qualquer mensagem recebida', desc: 'Ativa em toda mensagem recebida no chat' },
  { value: 'keyword', label: 'Frase-chave', desc: 'Ativa quando a mensagem contém a frase configurada' },
  { value: 'status_resolved', label: 'Status: Resolvido', desc: 'Ativa quando a conversa é marcada como resolvida' },
  { value: 'status_opened', label: 'Status: Em Atendimento', desc: 'Ativa quando a conversa entra em atendimento' },
  { value: 'new_contact', label: 'Novo contato cadastrado', desc: 'Ativa quando um novo contato é criado no sistema' },
];

const DAYS = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

const NODE_PALETTE: Array<{ type: ChatbotNode['node_type']; label: string; desc: string; icon: typeof MessageSquare; color: string; bg: string }> = [
  { type: 'message', label: 'Mensagem', desc: 'Envia uma mensagem de texto ao contato', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
  { type: 'menu', label: 'Menu de Opções', desc: 'Exibe opções numeradas para o contato escolher', icon: List, color: 'text-primary', bg: 'bg-primary/10' },
  { type: 'collect_data', label: 'Coletar Dados', desc: 'Solicita nome, e-mail ou telefone do contato', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  { type: 'ai_response', label: 'Resposta IA', desc: 'Gera uma resposta automática usando inteligência artificial', icon: Bot, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
  { type: 'smart_router', label: 'Roteador Inteligente', desc: 'Classifica a mensagem por palavras-chave ou IA e direciona', icon: Route, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
  { type: 'transfer', label: 'Transferir', desc: 'Transfere a conversa para um atendente humano', icon: ArrowRightLeft, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' },
  { type: 'delegate', label: 'Delegar', desc: 'Atribui a conversa a usuários ou departamentos específicos', icon: UserPlus, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  { type: 'condition', label: 'Condição', desc: 'Verifica se está dentro do horário comercial configurado', icon: GitBranch, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-950' },
  { type: 'apply_tag', label: 'Aplicar Tag', desc: 'Marca o contato com uma ou mais tags de classificação', icon: Tag, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
  { type: 'move_to_funnel', label: 'Mover p/ Funil', desc: 'Move o contato para uma etapa do funil de vendas', icon: Filter, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
  { type: 'delay', label: 'Aguardar', desc: 'Pausa o fluxo por um tempo antes de continuar', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
  { type: 'close_chat', label: 'Encerrar Chat', desc: 'Finaliza a conversa e define o status final', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' },
  { type: 'webhook', label: 'Webhook', desc: 'Envia dados para um sistema externo via HTTP', icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950' },
];

const NODE_META: Record<string, { label: string; icon: typeof MessageSquare; badgeClass: string }> = {
  message: { label: 'Mensagem', icon: MessageSquare, badgeClass: 'bg-info/15 text-info border-info/30' },
  menu: { label: 'Menu de Opções', icon: List, badgeClass: 'bg-primary/15 text-primary border-primary/30' },
  collect_data: { label: 'Coleta de Dados', icon: ClipboardList, badgeClass: 'bg-warning/15 text-warning border-warning/30' },
  ai_response: { label: 'Resposta IA', icon: Bot, badgeClass: 'bg-accent text-accent-foreground border-accent-foreground/20' },
  transfer: { label: 'Encaminhar', icon: ArrowRightLeft, badgeClass: 'bg-destructive/15 text-destructive border-destructive/30' },
  condition: { label: 'Condição', icon: GitBranch, badgeClass: 'bg-muted text-muted-foreground border-border' },
  apply_tag: { label: 'Aplicar Tag', icon: Tag, badgeClass: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  move_to_funnel: { label: 'Mover p/ Funil', icon: Filter, badgeClass: 'bg-success/15 text-success border-success/30' },
  delegate: { label: 'Delegar Chat', icon: UserPlus, badgeClass: 'bg-warning/15 text-warning border-warning/30' },
  delay: { label: 'Aguardar', icon: Clock, badgeClass: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  close_chat: { label: 'Encerrar Chat', icon: XCircle, badgeClass: 'bg-destructive/15 text-destructive border-destructive/30' },
  webhook: { label: 'Webhook', icon: Globe, badgeClass: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30' },
  smart_router: { label: 'Roteador Inteligente', icon: Route, badgeClass: 'bg-violet-500/15 text-violet-600 border-violet-500/30' },
};

const CHANNEL_META = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-500' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { key: 'webchat', label: 'Webchat', icon: GlobeIcon, color: 'text-blue-500' },
];

function getPreview(node: ChatbotNode): string {
  const c = node.config;
  switch (node.node_type) {
    case 'message': return c.text ? `"${(c.text as string).slice(0, 40)}${(c.text as string).length > 40 ? '…' : ''}"` : '';
    case 'menu': return c.text ? (c.text as string).slice(0, 40) : '';
    case 'collect_data': return (c.fields as string[])?.length ? `Coletar: ${(c.fields as string[]).join(', ')}` : '';
    case 'transfer': return c.message ? (c.message as string).slice(0, 40) : '';
    case 'delay': return c.seconds ? `${c.seconds}s` : c.minutes ? `${c.minutes}min` : '';
    case 'webhook': return c.url ? (c.url as string).slice(0, 40) : '';
    case 'close_chat': return (c.reason as string) || 'Encerrar';
    case 'smart_router': {
      const mode = c.mode as string | undefined;
      const routeCount = (c.routes as unknown[])?.length ?? 0;
      return mode ? `${mode} | ${routeCount} rota(s)` : '';
    }
    default: return '';
  }
}

// ── Component ────────────────────────────────────────────

interface FlowEditorProps {
  flow: ChatbotFlow;
  nodes: ChatbotNode[];
  isLoading: boolean;
  onBack: () => void;
  onAddNode: (data: { flow_id: string; position: number; node_type: ChatbotNode['node_type']; config: Record<string, unknown> }) => void;
  onUpdateNode: (data: { id: string; node_type?: ChatbotNode['node_type']; config?: Record<string, unknown> }) => void;
  onDeleteNode: (id: string) => void;
  onReorderNodes: (orderedIds: string[]) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
  onUpdateFlow?: (data: Partial<ChatbotFlow> & { id: string }) => void;
}

export default function FlowEditor({
  flow, nodes, isLoading, onBack, onAddNode, onUpdateNode, onDeleteNode,
  onReorderNodes, onUpdateNodePosition, onUpdateFlow,
}: FlowEditorProps) {
  // ── State ──
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);

  // Left panel: settings state
  const [triggerType, setTriggerType] = useState('none');
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [offlineMessage, setOfflineMessage] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [businessHours, setBusinessHours] = useState<Record<string, { enabled: boolean; start: string; end: string }>>({});
  const [channels, setChannels] = useState<Record<string, { enabled: boolean; mode: 'manual' | 'automatic' }>>({});
  const [integrationIds, setIntegrationIds] = useState<string[]>([]);

  // Collapsible sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    trigger: true,
    config: false,
    hours: false,
    channels: false,
  });

  // Integrations (filtered by project)
  const { projectId } = useProjectContext();
  const { data: allIntegrations } = useIntegrations(projectId || undefined);
  const whatsappIntegrations = (allIntegrations ?? []).filter(i => i.channel === 'whatsapp');

  // ── Sync flow data to state ──
  useEffect(() => {
    const bh = (flow.business_hours as Record<string, any>) || {};
    setTriggerType(bh._trigger?.type || 'none');
    setTriggerKeyword(bh._trigger?.keyword || '');
    setOfflineMessage(flow.offline_message || '');
    setAiInstructions(flow.ai_instructions || '');
    setTimeoutMinutes(flow.timeout_minutes || 30);

    const parsed: Record<string, { enabled: boolean; start: string; end: string }> = {};
    DAYS.forEach(d => {
      parsed[d.key] = bh[d.key] || { enabled: d.key !== 'sat' && d.key !== 'sun', start: '08:00', end: '18:00' };
    });
    setBusinessHours(parsed);

    setChannels(((flow as unknown as Record<string, unknown>).channels ?? {}) as Record<string, { enabled: boolean; mode: 'manual' | 'automatic' }>);
    setIntegrationIds(getIntegrationIds(flow));
  }, [flow.id]);

  // ── Auto-save with debounce ──
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialSync = useRef(true);

  const doSave = useCallback(() => {
    const bh = {
      ...businessHours,
      _trigger: { type: triggerType, keyword: triggerKeyword, integration_ids: integrationIds },
    };
    setSaveStatus('saving');
    onUpdateFlow?.({
      id: flow.id,
      offline_message: offlineMessage,
      ai_instructions: aiInstructions,
      timeout_minutes: timeoutMinutes,
      business_hours: bh,
      channels: channels as unknown as Record<string, unknown>,
    });
    setTimeout(() => setSaveStatus('saved'), 500);
    setTimeout(() => setSaveStatus('idle'), 2500);
  }, [flow.id, triggerType, triggerKeyword, offlineMessage, aiInstructions, timeoutMinutes, businessHours, channels, integrationIds, onUpdateFlow]);

  // Debounced auto-save: triggers 1.5s after any settings change
  useEffect(() => {
    // Skip auto-save during initial sync from flow data
    if (isInitialSync.current) {
      isInitialSync.current = false;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doSave(), 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [triggerType, triggerKeyword, offlineMessage, aiInstructions, timeoutMinutes, businessHours, channels, integrationIds]);

  // Reset initial sync flag when flow changes
  useEffect(() => {
    isInitialSync.current = true;
  }, [flow.id]);

  const handleSaveSettings = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    doSave();
  }, [doSave]);

  // ── Integration helpers ──
  const saveIntegrationIds = (ids: string[]) => {
    const bh = (flow.business_hours as Record<string, unknown>) ?? {};
    const existing = (bh._trigger as Record<string, unknown>) ?? {};
    onUpdateFlow?.({
      id: flow.id,
      business_hours: { ...bh, _trigger: { ...existing, integration_ids: ids } },
    });
  };

  const handleToggleIntegration = (id: string) => {
    const next = integrationIds.includes(id)
      ? integrationIds.filter(x => x !== id)
      : [...integrationIds, id];
    setIntegrationIds(next);
    saveIntegrationIds(next);
  };

  const handleSelectAllIntegrations = () => {
    setIntegrationIds([]);
    saveIntegrationIds([]);
  };

  // ── Node operations ──
  const handleAddNode = (type: ChatbotNode['node_type']) => {
    onAddNode({
      flow_id: flow.id,
      position: nodes.length,
      node_type: type,
      config: {},
    });
  };

  const handleToggleNodeEnabled = (node: ChatbotNode) => {
    const enabled = node.config._enabled !== false;
    onUpdateNode({ id: node.id, config: { ...node.config, _enabled: !enabled } });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(nodes);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorderNodes(reordered.map(n => n.id));
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Integration selector label ──
  const integrationLabel = integrationIds.length === 0
    ? 'Todos os números'
    : integrationIds.length === 1
      ? (whatsappIntegrations.find(i => i.id === integrationIds[0])?.device_name ?? '1 número')
      : `${integrationIds.length} números`;

  // ── Channel helpers ──
  const getChannel = (key: string) => channels[key] || { enabled: false, mode: 'automatic' as const };
  const updateChannel = (key: string, updates: Partial<{ enabled: boolean; mode: 'manual' | 'automatic' }>) => {
    const newChannels = { ...channels, [key]: { ...getChannel(key), ...updates } };
    setChannels(newChannels);
    onUpdateFlow?.({ id: flow.id, channels: newChannels as unknown as Record<string, unknown> });
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-9rem)] gap-0">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-3 shrink-0 border-b border-border mb-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">{flow.name}</h2>
          <p className="text-xs text-muted-foreground">{nodes.length} ação(ões)</p>
        </div>
        <div className="flex items-center gap-1.5">
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Salvando...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check size={12} /> Salvo
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSaveSettings} className="gap-1.5">
            <Save size={14} /> <span className="hidden sm:inline">Salvar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSimulator(true)}
            disabled={nodes.length === 0}
          >
            <Play size={14} className="sm:mr-1.5" /> <span className="hidden sm:inline">Simular</span>
          </Button>
        </div>
      </div>

      {/* ── Aviso: fluxo inativo ──────────────────────── */}
      {!flow.is_active && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs shrink-0">
          <AlertTriangle size={13} className="shrink-0" />
          <span><strong>Fluxo inativo.</strong> Ative-o na aba "Meus Fluxos" para que o chatbot funcione.</span>
        </div>
      )}

      {/* ── Main 2-panel layout ───────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-4">

        {/* ══ LEFT PANEL — Settings ══ */}
        <div className="w-full lg:w-80 shrink-0 rounded-xl border border-border bg-card flex flex-col overflow-hidden max-h-[40vh] lg:max-h-none">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">

              {/* ── Gatilho ── */}
              <Collapsible open={openSections.trigger} onOpenChange={() => toggleSection('trigger')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className="text-left">
                    <span className="text-xs font-semibold text-foreground block">Gatilho (Trigger)</span>
                    <span className="text-[10px] text-muted-foreground">Define o evento que inicia este fluxo automaticamente</span>
                  </div>
                  <ChevronRight size={14} className={cn('text-muted-foreground transition-transform shrink-0', openSections.trigger && 'rotate-90')} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo de gatilho</Label>
                      <Select value={triggerType} onValueChange={setTriggerType}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRIGGER_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>
                              <div>
                                <span>{o.label}</span>
                                <p className="text-[10px] text-muted-foreground">{o.desc}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {triggerType === 'keyword' && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Frases-chave</Label>
                        {/* Keyword chips */}
                        {(() => {
                          const keywords = triggerKeyword.split(',').map(k => k.trim()).filter(Boolean);
                          return (
                            <>
                              {keywords.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {keywords.map((kw, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20"
                                    >
                                      {kw}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = keywords.filter((_, j) => j !== i).join(', ');
                                          setTriggerKeyword(next);
                                        }}
                                        className="ml-0.5 hover:text-destructive transition-colors"
                                      >
                                        <X size={10} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-1">
                                <Input
                                  placeholder="Digite e pressione Enter"
                                  className="h-8 text-xs flex-1"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      if (!val) return;
                                      const next = keywords.length > 0 ? `${triggerKeyword}, ${val}` : val;
                                      setTriggerKeyword(next);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground">Pressione Enter para adicionar. A frase pode estar em qualquer parte da mensagem.</p>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Números */}
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1"><Smartphone size={11} /> Números WhatsApp</Label>
                      <p className="text-[10px] text-muted-foreground">Em quais números este fluxo será executado</p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-between">
                            <span className={cn(integrationIds.length === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                              {integrationLabel}
                            </span>
                            <ChevronDown size={11} className="text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <button
                            onClick={handleSelectAllIntegrations}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors',
                              integrationIds.length === 0 && 'bg-primary/10 text-primary font-medium',
                            )}
                          >
                            <Check size={12} className={integrationIds.length === 0 ? 'opacity-100' : 'opacity-0'} />
                            Todos os números
                          </button>
                          {whatsappIntegrations.map(integ => {
                            const isSelected = integrationIds.includes(integ.id);
                            return (
                              <button
                                key={integ.id}
                                onClick={() => handleToggleIntegration(integ.id)}
                                className={cn(
                                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors text-left',
                                  isSelected && 'bg-primary/10 text-primary font-medium',
                                )}
                              >
                                <Checkbox checked={isSelected} className="h-3 w-3 pointer-events-none" />
                                <div className="flex-1 min-w-0">
                                  <p className="truncate">{integ.device_name}</p>
                                  {integ.phone_number && <p className="text-[10px] text-muted-foreground truncate">{integ.phone_number}</p>}
                                </div>
                                <Badge variant="secondary" className={cn('text-[9px] px-1 py-0 shrink-0', integ.status === 'connected' ? 'text-green-600 bg-green-50 dark:bg-green-950' : 'text-muted-foreground')}>
                                  {integ.status === 'connected' ? 'Online' : 'Offline'}
                                </Badge>
                              </button>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Configurações ── */}
              <Collapsible open={openSections.config} onOpenChange={() => toggleSection('config')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className="text-left">
                    <span className="text-xs font-semibold text-foreground block">Configurações</span>
                    <span className="text-[10px] text-muted-foreground">Timeout, mensagem offline e instruções da IA</span>
                  </div>
                  <ChevronRight size={14} className={cn('text-muted-foreground transition-transform shrink-0', openSections.config && 'rotate-90')} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Timeout (minutos)</Label>
                      <p className="text-[10px] text-muted-foreground">Tempo de inatividade para encerrar a conversa automaticamente</p>
                      <Input
                        type="number"
                        value={timeoutMinutes}
                        onChange={e => setTimeoutMinutes(Number(e.target.value))}
                        className="h-8 text-xs w-24"
                        min={1}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mensagem fora do horário</Label>
                      <p className="text-[10px] text-muted-foreground">Enviada quando o cliente entra em contato fora do horário comercial</p>
                      <Textarea
                        value={offlineMessage}
                        onChange={e => setOfflineMessage(e.target.value)}
                        rows={2}
                        placeholder="Estamos fora do horário de atendimento. Retornaremos em breve!"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Instruções da IA</Label>
                      <p className="text-[10px] text-muted-foreground">Prompt base que define o comportamento da IA nas etapas "Resposta IA"</p>
                      <Textarea
                        value={aiInstructions}
                        onChange={e => setAiInstructions(e.target.value)}
                        rows={3}
                        placeholder="Você é um assistente de vendas da empresa X. Seja educado e objetivo..."
                        className="text-xs"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Horário Comercial ── */}
              <Collapsible open={openSections.hours} onOpenChange={() => toggleSection('hours')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className="text-left">
                    <span className="text-xs font-semibold text-foreground block">Horário Comercial</span>
                    <span className="text-[10px] text-muted-foreground">Dias e horários em que o atendimento está disponível</span>
                  </div>
                  <ChevronRight size={14} className={cn('text-muted-foreground transition-transform shrink-0', openSections.hours && 'rotate-90')} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-3 space-y-2">
                    {DAYS.map(d => {
                      const day = businessHours[d.key] || { enabled: false, start: '08:00', end: '18:00' };
                      return (
                        <div key={d.key} className="flex items-center gap-2">
                          <Switch
                            checked={day.enabled}
                            onCheckedChange={checked => setBusinessHours({ ...businessHours, [d.key]: { ...day, enabled: checked } })}
                            className="scale-75"
                          />
                          <span className="text-xs w-8">{d.label}</span>
                          {day.enabled && (
                            <>
                              <Input type="time" value={day.start} className="h-7 text-xs w-24" onChange={e => setBusinessHours({ ...businessHours, [d.key]: { ...day, start: e.target.value } })} />
                              <span className="text-[10px] text-muted-foreground">–</span>
                              <Input type="time" value={day.end} className="h-7 text-xs w-24" onChange={e => setBusinessHours({ ...businessHours, [d.key]: { ...day, end: e.target.value } })} />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ── Canais ── */}
              <Collapsible open={openSections.channels} onOpenChange={() => toggleSection('channels')}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className="text-left">
                    <span className="text-xs font-semibold text-foreground block">Canais</span>
                    <span className="text-[10px] text-muted-foreground">Ativar/desativar o fluxo por canal de atendimento</span>
                  </div>
                  <ChevronRight size={14} className={cn('text-muted-foreground transition-transform shrink-0', openSections.channels && 'rotate-90')} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-2 pb-3 space-y-2">
                    {CHANNEL_META.map(ch => {
                      const cfg = getChannel(ch.key);
                      const Icon = ch.icon;
                      return (
                        <div key={ch.key} className="rounded-lg border border-border p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Icon size={13} className={ch.color} />
                              <span className="text-xs font-medium">{ch.label}</span>
                            </div>
                            <Switch
                              checked={cfg.enabled}
                              onCheckedChange={v => updateChannel(ch.key, { enabled: v })}
                              className="scale-75"
                            />
                          </div>
                          {cfg.enabled && (
                            <Select value={cfg.mode} onValueChange={(v: 'manual' | 'automatic') => updateChannel(ch.key, { mode: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="automatic">Automático</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>

            </div>
          </ScrollArea>
        </div>

        {/* ══ RIGHT PANEL — Actions list ══ */}
        <div className="flex-1 min-w-0 rounded-xl border border-border bg-card flex flex-col overflow-hidden">
          {/* Actions header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div>
              <p className="text-sm font-semibold text-foreground">Ações do Fluxo</p>
              <p className="text-[10px] text-muted-foreground">
                {nodes.length === 0
                  ? 'As ações são executadas em ordem, de cima para baixo'
                  : `${nodes.length} ação(ões) — arraste para reordenar, clique para configurar`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus size={14} /> Adicionar Ação
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
                {NODE_PALETTE.map(item => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.type} onClick={() => handleAddNode(item.type)} className="gap-2.5 cursor-pointer py-2">
                      <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0', item.bg)}>
                        <Icon size={13} className={item.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Actions list */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                <p className="text-sm text-muted-foreground mb-2">Nenhuma ação configurada.</p>
                <p className="text-xs text-muted-foreground mb-1">Clique em "Adicionar Ação" para começar a montar seu fluxo.</p>
                <p className="text-[10px] text-muted-foreground">Cada ação representa uma etapa do atendimento automático — mensagens, menus, coleta de dados, IA e mais.</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="actions-list">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="p-2 space-y-1"
                    >
                      {nodes.map((node, index) => {
                        const meta = NODE_META[node.node_type] || NODE_META.message;
                        const Icon = meta.icon;
                        const preview = getPreview(node);
                        const isExpanded = expandedNodeId === node.id;
                        const isEnabled = node.config._enabled !== false;

                        return (
                          <Draggable key={node.id} draggableId={node.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={cn(
                                  'rounded-lg border transition-all',
                                  isExpanded ? 'border-primary/40 bg-accent/30' : 'border-border hover:border-border/80 hover:bg-muted/30',
                                  dragSnapshot.isDragging && 'shadow-lg border-primary/30 bg-card',
                                  !isEnabled && 'opacity-50',
                                )}
                              >
                                {/* Card header */}
                                <div
                                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                                  onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                                >
                                  {/* Drag handle */}
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <GripVertical size={14} />
                                  </div>

                                  <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">{index + 1}</span>

                                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 font-medium shrink-0', meta.badgeClass)}>
                                    <Icon size={10} className="mr-1" />
                                    {meta.label}
                                  </Badge>

                                  {preview && (
                                    <p className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">{preview}</p>
                                  )}
                                  {!preview && <div className="flex-1" />}

                                  {/* Toggle enabled */}
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={() => handleToggleNodeEnabled(node)}
                                    className="scale-[0.65] shrink-0"
                                    onClick={e => e.stopPropagation()}
                                  />

                                  {/* Delete */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={e => { e.stopPropagation(); setDeleteId(node.id); }}
                                  >
                                    <Trash2 size={12} />
                                  </Button>

                                  <ChevronRight size={14} className={cn('text-muted-foreground shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                                </div>

                                {/* Expanded config */}
                                {isExpanded && (
                                  <div className="border-t border-border">
                                    <NodeConfigPanel node={node} onSave={onUpdateNode} projectId={flow.project_id} />
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ── Footer status ── */}
      <div className="flex items-center gap-3 pt-3 mt-3 border-t border-border shrink-0 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Power size={10} />
          {flow.is_active ? 'Ativo' : 'Inativo'}
        </span>
        <span>|</span>
        <span>{nodes.length} ação(ões)</span>
        <span>|</span>
        <span>Trigger: {TRIGGER_OPTIONS.find(t => t.value === triggerType)?.label || triggerType}</span>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir ação"
        description="Tem certeza que deseja excluir esta ação do fluxo?"
        onConfirm={() => {
          if (deleteId) {
            onDeleteNode(deleteId);
            setDeleteId(null);
            if (expandedNodeId === deleteId) setExpandedNodeId(null);
          }
        }}
      />
      <FlowSimulator flow={flow} nodes={nodes} open={showSimulator} onClose={() => setShowSimulator(false)} />
    </div>
  );
}
