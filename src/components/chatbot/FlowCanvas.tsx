import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ChatbotNode } from '@/hooks/useChatbotFlows';
import { ChatbotFlowNode } from './canvas/ChatbotFlowNode';

const nodeTypes = { chatbotNode: ChatbotFlowNode };

const TERMINAL = new Set(['transfer', 'close_chat']);
const NODE_H = 90;
const V_GAP = 60;

function buildRfNodes(nodes: ChatbotNode[], selectedId: string | null): Node[] {
  return nodes.map((node, i) => {
    const x = (node.config._canvas_x as number | undefined) ?? 300;
    const y = (node.config._canvas_y as number | undefined) ?? 80 + i * (NODE_H + V_GAP);
    return {
      id: node.id,
      type: 'chatbotNode',
      position: { x, y },
      data: { ...node },
      selected: node.id === selectedId,
    };
  });
}

function buildEdges(nodes: ChatbotNode[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (TERMINAL.has(node.node_type)) continue;
    if (node.node_type === 'menu') {
      const options = (node.config.options ?? []) as Array<{ label?: string; next_position?: number | null }>;
      options.forEach((opt, j) => {
        const targetNode =
          opt.next_position != null
            ? nodes.find(n => n.position === opt.next_position)
            : nodes[i + 1];
        if (!targetNode) return;
        edges.push({
          id: `${node.id}-opt${j}`,
          source: node.id,
          target: targetNode.id,
          label: opt.label ?? `Opção ${j + 1}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: 'hsl(var(--primary))' },
          labelStyle: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
          labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.8 },
        });
      });
    } else if (i + 1 < nodes.length) {
      edges.push({
        id: `${node.id}-seq`,
        source: node.id,
        target: nodes[i + 1].id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'hsl(var(--primary) / 0.5)', strokeWidth: 2 },
      });
    }
  }
  return edges;
}

interface FlowCanvasProps {
  nodes: ChatbotNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
}

export default function FlowCanvas({
  nodes,
  selectedNodeId,
  onSelectNode,
  onUpdateNodePosition,
}: FlowCanvasProps) {
  const rfNodes = useMemo(() => buildRfNodes(nodes, selectedNodeId), [nodes, selectedNodeId]);
  const rfEdges = useMemo(() => buildEdges(nodes), [nodes]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(rfNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => { setFlowNodes(rfNodes); }, [rfNodes]);
  useEffect(() => { setFlowEdges(rfEdges); }, [rfEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const c of changes) {
        if (c.type === 'position' && !c.dragging && c.position) {
          onUpdateNodePosition(c.id, c.position.x, c.position.y);
        }
      }
    },
    [onNodesChange, onUpdateNodePosition],
  );

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 rounded-xl border-2 border-dashed border-border">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Canvas vazio</p>
          <p className="text-xs text-muted-foreground/70">Adicione uma etapa usando o painel à esquerda</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-border">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="hsl(var(--border))"
        />
        <Controls
          showInteractive={false}
          className="[&>button]:bg-card [&>button]:border-border [&>button]:text-foreground [&>button:hover]:bg-accent"
        />
        <MiniMap
          nodeColor={() => 'hsl(var(--primary) / 0.4)'}
          maskColor="hsl(var(--background) / 0.7)"
          className="!bg-card !border-border rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
