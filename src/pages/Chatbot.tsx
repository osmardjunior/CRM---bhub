import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatbotFlows, useChatbotNodes } from '@/hooks/useChatbotFlows';
import FlowList from '@/components/chatbot/FlowList';
import FlowEditor from '@/components/chatbot/FlowEditor';
import FlowSettings from '@/components/chatbot/FlowSettings';
import type { ChatbotFlow } from '@/hooks/useChatbotFlows';

export default function Chatbot() {
  const { flows, isLoading, createFlow, updateFlow, deleteFlow, toggleActive } = useChatbotFlows();
  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow | null>(null);
  const [activeTab, setActiveTab] = useState('flows');
  const { nodes, isLoading: nodesLoading, addNode, updateNode, deleteNode } = useChatbotNodes(selectedFlow?.id ?? null);

  const handleSelectFlow = (flow: ChatbotFlow) => {
    setSelectedFlow(flow);
    setActiveTab('editor');
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
          <TabsTrigger value="settings">Configurações Gerais</TabsTrigger>
        </TabsList>

        <TabsContent value="flows">
          <FlowList
            flows={flows}
            onSelect={handleSelectFlow}
            onCreate={name => createFlow.mutate(name)}
            onDelete={id => deleteFlow.mutate(id)}
            onToggleActive={(id, active) => toggleActive.mutate({ id, is_active: active })}
          />
        </TabsContent>

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
              onUpdateFlow={data => updateFlow.mutate(data)}
            />
          )}
        </TabsContent>

        <TabsContent value="settings">
          <FlowSettings
            flow={selectedFlow || (flows.length > 0 ? flows[0] : null)}
            onSave={updates => updateFlow.mutate(updates)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
