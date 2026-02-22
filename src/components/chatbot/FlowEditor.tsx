import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import NodeCard from './NodeCard';
import NodeConfigPanel from './NodeConfigPanel';
import ChannelPanel from './ChannelPanel';
import FlowSimulator from './FlowSimulator';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';

const TRIGGER_LABELS: Record<string, string> = {
  none: 'Manual',
  first_message: 'Primeira mensagem',
  any_message: 'Qualquer mensagem',
  keyword: 'Palavra-chave',
  status_resolved: 'Status: Resolvido',
  status_opened: 'Status: Em Atend.',
  new_contact: 'Novo contato',
};

function getTriggerLabel(flow: ChatbotFlow): string {
  const bh = (flow.business_hours as Record<string, unknown> | null) ?? {};
  const type = (bh._trigger as { type?: string } | undefined)?.type ?? 'none';
  return TRIGGER_LABELS[type] ?? 'Manual';
}

const NODE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'message', label: 'Mensagem' },
  { value: 'menu', label: 'Menu de Opções' },
  { value: 'collect_data', label: 'Coleta de Dados' },
  { value: 'ai_response', label: 'Resposta IA' },
  { value: 'transfer', label: 'Encaminhar' },
  { value: 'condition', label: 'Condição de Horário' },
  { value: 'apply_tag', label: 'Aplicar Tag' },
  { value: 'move_to_funnel', label: 'Mover para Funil' },
  { value: 'delegate', label: 'Delegar Chat' },
  { value: 'delay', label: 'Aguardar (Delay)' },
  { value: 'close_chat', label: 'Encerrar Chat' },
  { value: 'webhook', label: 'Webhook' },
];

interface FlowEditorProps {
  flow: ChatbotFlow;
  nodes: ChatbotNode[];
  isLoading: boolean;
  onBack: () => void;
  onAddNode: (data: { flow_id: string; position: number; node_type: ChatbotNode['node_type']; config: Record<string, unknown> }) => void;
  onUpdateNode: (data: { id: string; node_type?: ChatbotNode['node_type']; config?: Record<string, unknown> }) => void;
  onDeleteNode: (id: string) => void;
  onUpdateFlow?: (data: { id: string; channels?: Record<string, unknown> }) => void;
}

export default function FlowEditor({ flow, nodes, isLoading, onBack, onAddNode, onUpdateNode, onDeleteNode, onUpdateFlow }: FlowEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [addType, setAddType] = useState<string>('');
  const [channels, setChannels] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setChannels((flow as { channels?: Record<string, unknown> }).channels ?? {});
  }, [flow]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const handleAddNode = () => {
    if (!addType) return;
    const position = nodes.length;
    onAddNode({ flow_id: flow.id, position, node_type: addType as ChatbotNode['node_type'], config: {} });
    setAddType('');
  };

  const handleChannelsChange = (newChannels: Record<string, unknown>) => {
    setChannels(newChannels);
    onUpdateFlow?.({ id: flow.id, channels: newChannels });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">{flow.name}</h2>
            {getTriggerLabel(flow) !== 'Manual' && (
              <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                <Zap size={10} className="text-primary" />
                {getTriggerLabel(flow)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Editor de fluxo</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSimulator(true)} disabled={nodes.length === 0}>
          <Play size={14} className="mr-2" /> Simular
        </Button>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-[280px_1fr_240px] gap-3 min-h-[520px]">
        {/* LEFT - Node list */}
        <div className="rounded-lg border border-border bg-card flex flex-col">
          <div className="px-3 py-2.5 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações do Fluxo</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5 group">
              {isLoading ? (
                <p className="text-center text-xs text-muted-foreground py-6">Carregando...</p>
              ) : nodes.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">Nenhuma ação ainda</p>
              ) : (
                nodes.map((node, i) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    index={i}
                    selected={selectedNodeId === node.id}
                    onSelect={() => setSelectedNodeId(node.id)}
                    onDelete={() => setDeleteId(node.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
          {/* Add action */}
          <div className="px-2 py-2 border-t border-border flex gap-1.5">
            <Select value={addType} onValueChange={setAddType}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Tipo..." />
              </SelectTrigger>
              <SelectContent>
                {NODE_TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 px-2" onClick={handleAddNode} disabled={!addType}>
              <Plus size={14} />
            </Button>
          </div>
        </div>

        {/* CENTER - Config panel */}
        <div className="rounded-lg border border-border bg-card">
          {selectedNode ? (
            <NodeConfigPanel node={selectedNode} onSave={onUpdateNode} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Selecione uma ação à esquerda para configurar</p>
            </div>
          )}
        </div>

        {/* RIGHT - Channel panel */}
        <div className="rounded-lg border border-border bg-card">
          <ChannelPanel channels={channels} onChange={handleChannelsChange} />
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir etapa"
        description="Tem certeza que deseja excluir esta etapa?"
        onConfirm={() => { if (deleteId) { onDeleteNode(deleteId); setDeleteId(null); if (selectedNodeId === deleteId) setSelectedNodeId(null); } }}
      />
      <FlowSimulator flow={flow} nodes={nodes} open={showSimulator} onClose={() => setShowSimulator(false)} />
    </div>
  );
}
