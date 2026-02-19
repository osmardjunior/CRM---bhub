import { MessageSquare, List, FileInput, Brain, UserCheck, Clock, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ChatbotNode } from '@/hooks/useChatbotFlows';

const NODE_META: Record<ChatbotNode['node_type'], { label: string; icon: typeof MessageSquare; color: string }> = {
  message: { label: 'Mensagem', icon: MessageSquare, color: 'text-info' },
  menu: { label: 'Menu de Opções', icon: List, color: 'text-primary' },
  collect_data: { label: 'Coleta de Dados', icon: FileInput, color: 'text-warning' },
  ai_response: { label: 'Resposta IA', icon: Brain, color: 'text-accent-foreground' },
  transfer: { label: 'Encaminhar', icon: UserCheck, color: 'text-success' },
  condition: { label: 'Condição de Horário', icon: Clock, color: 'text-muted-foreground' },
};

function getSummary(node: ChatbotNode): string {
  const c = node.config;
  switch (node.node_type) {
    case 'message': return c.text ? `"${(c.text as string).slice(0, 60)}..."` : 'Sem texto definido';
    case 'menu': return c.options ? `${(c.options as any[]).length} opção(ões)` : 'Sem opções';
    case 'collect_data': return c.fields ? `Campos: ${(c.fields as string[]).join(', ')}` : 'Sem campos';
    case 'ai_response': return c.context ? `"${(c.context as string).slice(0, 50)}..."` : 'Usando instruções gerais';
    case 'transfer': return c.message || 'Transferir para atendente';
    case 'condition': return 'Verificar horário de atendimento';
    default: return '';
  }
}

interface NodeCardProps {
  node: ChatbotNode;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export default function NodeCard({ node, index, onEdit, onDelete }: NodeCardProps) {
  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;

  return (
    <Card className="border-l-4 border-l-primary/30 hover:border-l-primary transition-colors">
      <CardContent className="flex items-center gap-3 p-3">
        <GripVertical size={16} className="text-muted-foreground shrink-0 cursor-grab" />
        <div className={`h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0`}>
          <Icon size={18} className={meta.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
            <span className="text-sm font-medium text-foreground">{meta.label}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{getSummary(node)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit2 size={14} /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 size={14} /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
