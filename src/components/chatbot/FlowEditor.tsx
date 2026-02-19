import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NodeCard from './NodeCard';
import NodeEditModal from './NodeEditModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';

interface FlowEditorProps {
  flow: ChatbotFlow;
  nodes: ChatbotNode[];
  isLoading: boolean;
  onBack: () => void;
  onAddNode: (data: { flow_id: string; position: number; node_type: ChatbotNode['node_type']; config: Record<string, any> }) => void;
  onUpdateNode: (data: { id: string; node_type?: ChatbotNode['node_type']; config?: Record<string, any> }) => void;
  onDeleteNode: (id: string) => void;
}

export default function FlowEditor({ flow, nodes, isLoading, onBack, onAddNode, onUpdateNode, onDeleteNode }: FlowEditorProps) {
  const [editNode, setEditNode] = useState<ChatbotNode | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [insertPosition, setInsertPosition] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = (position: number) => {
    setInsertPosition(position);
    setShowNew(true);
  };

  const handleSaveNew = (data: { node_type: ChatbotNode['node_type']; config: Record<string, any> }) => {
    onAddNode({ flow_id: flow.id, position: insertPosition, ...data });
    setShowNew(false);
  };

  const handleSaveEdit = (data: { node_type: ChatbotNode['node_type']; config: Record<string, any> }) => {
    if (editNode) {
      onUpdateNode({ id: editNode.id, ...data });
      setEditNode(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{flow.name}</h2>
          <p className="text-xs text-muted-foreground">Editor de etapas</p>
        </div>
      </div>

      {/* Add at beginning */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" className="text-xs" onClick={() => handleAdd(0)}>
          <Plus size={14} className="mr-1" /> Adicionar primeira etapa
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground py-8">Carregando etapas...</p>
      ) : (
        <div className="space-y-2">
          {nodes.map((node, i) => (
            <div key={node.id}>
              <NodeCard
                node={node}
                index={i}
                onEdit={() => setEditNode(node)}
                onDelete={() => setDeleteId(node.id)}
              />
              <div className="flex justify-center py-1">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => handleAdd(node.position + 1)}>
                  <Plus size={12} className="mr-1" /> Etapa
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {nodes.length === 0 && !isLoading && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Nenhuma etapa ainda. Clique em "Adicionar primeira etapa" para começar.
        </p>
      )}

      <NodeEditModal open={showNew} onOpenChange={setShowNew} onSave={handleSaveNew} isNew />
      <NodeEditModal open={!!editNode} onOpenChange={open => !open && setEditNode(null)} node={editNode} onSave={handleSaveEdit} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir etapa"
        description="Tem certeza que deseja excluir esta etapa?"
        onConfirm={() => { if (deleteId) { onDeleteNode(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
