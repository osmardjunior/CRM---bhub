import { useState, useEffect } from 'react';
import {
  ArrowLeft, Play, Plus, Settings2,
  Route, X, AlertTriangle, Smartphone, ChevronDown, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import NodeConfigPanel from './NodeConfigPanel';
import ChannelPanel from './ChannelPanel';
import FlowSimulator from './FlowSimulator';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import FlowCanvas from './FlowCanvas';
import { useIntegrations } from '@/hooks/useIntegrations';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';

function getIntegrationIds(flow: ChatbotFlow): string[] {
  const bh = (flow.business_hours as Record<string, unknown> | null) ?? {};
  const trigger = bh._trigger as { integration_ids?: string[] } | undefined;
  return trigger?.integration_ids ?? [];
}

// Node palette items
const NODE_PALETTE: Array<{ type: string; label: string; icon: typeof Route; color: string; bg: string }> = [
  { type: 'smart_router', label: 'Roteador Inteligente', icon: Route, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950' },
];

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

type RightPanel = 'config' | 'channels' | null;

export default function FlowEditor({
  flow, nodes, isLoading, onBack, onAddNode, onUpdateNode, onDeleteNode,
  onReorderNodes, onUpdateNodePosition, onUpdateFlow,
}: FlowEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [channels, setChannels] = useState<Record<string, { enabled: boolean; mode: 'manual' | 'automatic' }>>({});

  // Integrations
  const [integrationIds, setIntegrationIds] = useState<string[]>([]);
  const { data: allIntegrations } = useIntegrations();
  const whatsappIntegrations = (allIntegrations ?? []).filter(i => i.channel === 'whatsapp');

  useEffect(() => {
    setChannels(((flow as unknown as Record<string, unknown>).channels ?? {}) as Record<string, { enabled: boolean; mode: 'manual' | 'automatic' }>);
    const ids = getIntegrationIds(flow);
    setIntegrationIds(ids);

    // Auto-set trigger to any_message so flow fires on every incoming message
    const bh = (flow.business_hours as Record<string, unknown>) ?? {};
    const trigger = (bh._trigger as { type?: string } | undefined);
    if (trigger?.type !== 'any_message') {
      onUpdateFlow?.({
        id: flow.id,
        business_hours: { ...bh, _trigger: { type: 'any_message', keyword: '', integration_ids: ids } },
      });
    }
  }, [flow.id]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;

  const saveIntegrationIds = (ids: string[]) => {
    const bh = (flow.business_hours as Record<string, unknown>) ?? {};
    const existing = (bh._trigger as Record<string, unknown>) ?? {};
    onUpdateFlow?.({
      id: flow.id,
      business_hours: { ...bh, _trigger: { ...existing, type: 'any_message', integration_ids: ids } },
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

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    setRightPanel(id ? 'config' : null);
  };

  const handleAddNode = (type: string) => {
    onAddNode({
      flow_id: flow.id,
      position: nodes.length,
      node_type: type as ChatbotNode['node_type'],
      config: {},
    });
  };

  const handleChannelsChange = (newChannels: Record<string, { enabled: boolean; mode: 'manual' | 'automatic' }>) => {
    setChannels(newChannels);
    onUpdateFlow?.({ id: flow.id, channels: newChannels as unknown as Record<string, unknown> });
  };

  const rightOpen = rightPanel !== null;

  // Integration selector label
  const integrationLabel = integrationIds.length === 0
    ? 'Todos os números'
    : integrationIds.length === 1
      ? (whatsappIntegrations.find(i => i.id === integrationIds[0])?.device_name ?? '1 número')
      : `${integrationIds.length} números`;

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] gap-0">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">{flow.name}</h2>
          <p className="text-xs text-muted-foreground">{nodes.length} etapa(s)</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant={rightPanel === 'channels' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRightPanel(p => p === 'channels' ? null : 'channels')}
          >
            <Settings2 size={14} className="mr-1.5" /> Canais
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSimulator(true)}
            disabled={nodes.length === 0}
          >
            <Play size={14} className="mr-1.5" /> Simular
          </Button>
        </div>
      </div>

      {/* ── Números row ───────────────────────────────────── */}
      <div className="flex items-center gap-2 pb-2 shrink-0 flex-wrap">
        {/* Números (integrações) */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Smartphone size={12} />
          <span className="font-medium">Números:</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2.5">
              <span className={cn(integrationIds.length === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                {integrationLabel}
              </span>
              <ChevronDown size={11} className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 mb-1">
              Executar este fluxo em:
            </p>
            {/* Todos */}
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
            {/* Lista de integrações */}
            {whatsappIntegrations.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma integração WhatsApp conectada.</p>
            )}
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
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleIntegration(integ.id)}
                    className="h-3 w-3 pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{integ.device_name}</p>
                    {integ.phone_number && (
                      <p className="text-[10px] text-muted-foreground truncate">{integ.phone_number}</p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[9px] px-1 py-0 shrink-0',
                      integ.status === 'connected' ? 'text-green-600 bg-green-50 dark:bg-green-950' : 'text-muted-foreground',
                    )}
                  >
                    {integ.status === 'connected' ? 'Online' : 'Offline'}
                  </Badge>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Badge indicativo */}
        {integrationIds.length > 0 && (
          <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
            <Smartphone size={10} />
            {integrationLabel}
          </Badge>
        )}
      </div>

      {/* ── Aviso: fluxo inativo ──────────────────────────── */}
      {!flow.is_active && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs shrink-0">
          <AlertTriangle size={13} className="shrink-0" />
          <span><strong>Fluxo inativo.</strong> Ative-o na aba "Meus Fluxos" para que o chatbot funcione.</span>
        </div>
      )}

      {/* ── Main layout ───────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-3">

        {/* LEFT — Node palette */}
        <div className="w-44 shrink-0 rounded-xl border border-border bg-card flex flex-col">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Plus size={10} /> Adicionar Etapa
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {NODE_PALETTE.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleAddNode(item.type)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left',
                      'hover:bg-accent transition-colors cursor-pointer',
                    )}
                  >
                    <div className={cn('h-5 w-5 rounded-md flex items-center justify-center shrink-0', item.bg)}>
                      <Icon size={11} className={item.color} />
                    </div>
                    <span className="text-[11px] font-medium text-foreground truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* CENTER — Canvas */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center rounded-xl border border-border bg-card">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <FlowCanvas
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onUpdateNodePosition={onUpdateNodePosition}
            />
          )}
        </div>

        {/* RIGHT — Config / Channels panel */}
        {rightOpen && (
          <div className="w-72 shrink-0 rounded-xl border border-border bg-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <p className="text-xs font-semibold text-foreground">
                {rightPanel === 'channels' ? 'Canais' : 'Configurar Etapa'}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => { setRightPanel(null); setSelectedNodeId(null); }}
              >
                <X size={13} />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {rightPanel === 'channels' ? (
                <div className="p-3">
                  <ChannelPanel channels={channels} onChange={handleChannelsChange} />
                </div>
              ) : selectedNode ? (
                <div className="flex flex-col h-full">
                  <NodeConfigPanel node={selectedNode} onSave={onUpdateNode} />
                  <div className="px-3 pb-3 pt-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => setDeleteId(selectedNode.id)}
                    >
                      Excluir esta etapa
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-center px-4">
                  <p className="text-xs text-muted-foreground">Clique em uma etapa no canvas para configurar</p>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir etapa"
        description="Tem certeza que deseja excluir esta etapa do fluxo?"
        onConfirm={() => {
          if (deleteId) {
            onDeleteNode(deleteId);
            setDeleteId(null);
            if (selectedNodeId === deleteId) { setSelectedNodeId(null); setRightPanel(null); }
          }
        }}
      />
      <FlowSimulator flow={flow} nodes={nodes} open={showSimulator} onClose={() => setShowSimulator(false)} />
    </div>
  );
}
