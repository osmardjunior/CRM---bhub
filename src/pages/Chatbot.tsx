import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatbotFlows, useChatbotNodes } from '@/hooks/useChatbotFlows';
import FlowList from '@/components/chatbot/FlowList';
import FlowEditor from '@/components/chatbot/FlowEditor';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectContext } from '@/contexts/ProjectContext';

export default function Chatbot() {
  const permissions = usePermissions();
  const { projectId } = useProjectContext();
  const { flows, isLoading, createFlow, updateFlow, deleteFlow, toggleActive } = useChatbotFlows();
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow | null>(null);
  const [activeTab, setActiveTab] = useState('flows');
  const { nodes, isLoading: nodesLoading, addNode, updateNode, updateNodePosition, deleteNode, reorderNodes } = useChatbotNodes(selectedFlow?.id ?? null);

  // Keep selectedFlow in sync when flows are refetched (e.g. after saving trigger)
  useEffect(() => {
    if (selectedFlow) {
      const updated = flows.find(f => f.id === selectedFlow.id);
      if (updated) setSelectedFlow(updated);
    }
  }, [flows]);

  const handleSelectFlow = (flow: ChatbotFlow) => {
    setSelectedFlow(flow);
    setActiveTab('editor');
  };

  const handleCreateFromTemplate = async (
    name: string,
    templateNodes: Array<{ node_type: ChatbotNode['node_type']; config: Record<string, unknown> }>
  ) => {
    const created = await createFlow.mutateAsync(name);
    if (!created?.id) return;
    for (let i = 0; i < templateNodes.length; i++) {
      await supabase.from('chatbot_nodes').insert([{
        flow_id: created.id,
        position: i,
        node_type: templateNodes[i].node_type,
        config: templateNodes[i].config,
      }]);
    }
    handleSelectFlow(created);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Diálogos / Chatbot</h1>
        <p className="text-sm text-muted-foreground mt-1">Monte fluxos de atendimento automatizado com IA.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="flows">Meus Fluxos</TabsTrigger>
          <TabsTrigger value="editor" disabled={!selectedFlow}>Editor de Fluxo</TabsTrigger>
        </TabsList>

        {/* Keep FlowList always mounted so navigation state persists */}
        <div className={activeTab === 'flows' ? '' : 'hidden'}>
          <div className="mt-2">
            <FlowList
              flows={flows}
              onSelect={handleSelectFlow}
              onCreate={permissions.can('chatbot_edit_dialogs') ? (payload => createFlow.mutate(payload)) : undefined}
              onCreateFromTemplate={permissions.can('chatbot_edit_dialogs') ? handleCreateFromTemplate : undefined}
              onDelete={permissions.can('chatbot_delete_dialogs') ? (id => deleteFlow.mutate(id)) : undefined}
              onToggleActive={permissions.can('chatbot_edit_dialogs') ? ((id, active) => toggleActive.mutate({ id, is_active: active })) : undefined}
              activeProjectId={projectId}
            />
          </div>
        </div>

        <TabsContent value="editor">
          {selectedFlow && (
            <FlowEditor
              flow={selectedFlow}
              nodes={nodes}
              isLoading={nodesLoading}
              onBack={() => { setSelectedFlow(null); setActiveTab('flows'); }}
              onAddNode={data => addNode.mutate(data)}
              onUpdateNode={data => updateNode.mutate(data)}
              onDeleteNode={id => deleteNode.mutate(id)}
              onReorderNodes={orderedIds => reorderNodes.mutate(orderedIds)}
              onUpdateNodePosition={(id, x, y) => updateNodePosition(id, x, y)}
              onUpdateFlow={data => updateFlow.mutate(data)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
