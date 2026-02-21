import { MessageSquare, List, FileInput, Brain, UserCheck, Clock, Tag, GitBranch, Users, Trash2, Timer, XCircle, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ChatbotNode } from '@/hooks/useChatbotFlows';

const NODE_META: Record<string, { label: string; icon: typeof MessageSquare; badgeClass: string }> = {
  message: { label: 'Mensagem', icon: MessageSquare, badgeClass: 'bg-info/15 text-info border-info/30' },
  menu: { label: 'Menu de Opções', icon: List, badgeClass: 'bg-primary/15 text-primary border-primary/30' },
  collect_data: { label: 'Coleta de Dados', icon: FileInput, badgeClass: 'bg-warning/15 text-warning border-warning/30' },
  ai_response: { label: 'Resposta IA', icon: Brain, badgeClass: 'bg-accent text-accent-foreground border-accent-foreground/20' },
  transfer: { label: 'Encaminhar', icon: UserCheck, badgeClass: 'bg-destructive/15 text-destructive border-destructive/30' },
  condition: { label: 'Condição de Horário', icon: Clock, badgeClass: 'bg-muted text-muted-foreground border-border' },
  apply_tag: { label: 'Aplicar Tag', icon: Tag, badgeClass: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  move_to_funnel: { label: 'Mover para Funil', icon: GitBranch, badgeClass: 'bg-success/15 text-success border-success/30' },
  delegate: { label: 'Delegar Chat', icon: Users, badgeClass: 'bg-warning/15 text-warning border-warning/30' },
  delay: { label: 'Aguardar', icon: Timer, badgeClass: 'bg-orange-500/15 text-orange-600 border-orange-500/30' },
  close_chat: { label: 'Encerrar Chat', icon: XCircle, badgeClass: 'bg-destructive/15 text-destructive border-destructive/30' },
  webhook: { label: 'Webhook', icon: Webhook, badgeClass: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30' },
};

function getPreview(node: ChatbotNode): string {
  const c = node.config;
  switch (node.node_type) {
    case 'message': return c.text ? `"${c.text.slice(0, 40)}${c.text.length > 40 ? '…' : ''}"` : '';
    case 'menu': return c.text ? c.text.slice(0, 40) : '';
    case 'collect_data': return c.fields?.length ? `Coletar: ${c.fields.join(', ')}` : '';
    case 'transfer': return c.message ? c.message.slice(0, 40) : '';
    case 'delay': return c.seconds ? `${c.seconds}s de espera` : c.minutes ? `${c.minutes}min de espera` : '';
    case 'webhook': return c.url ? c.url.slice(0, 40) : '';
    case 'close_chat': return c.reason || 'Encerrar atendimento';
    default: return '';
  }
}

interface NodeCardProps {
  node: ChatbotNode;
  index: number;
  selected?: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function NodeCard({ node, index, selected, onSelect, onDelete }: NodeCardProps) {
  const meta = NODE_META[node.node_type] || NODE_META.message;
  const Icon = meta.icon;
  const preview = getPreview(node);

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border group',
        selected
          ? 'bg-accent border-primary/40'
          : 'border-transparent hover:bg-muted/60'
      )}
      onClick={onSelect}
    >
      <span className="text-xs font-bold text-muted-foreground w-5 text-center mt-0.5">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 font-medium', meta.badgeClass)}>
          <Icon size={10} className="mr-1" />
          {meta.label}
        </Badge>
        {preview && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{preview}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
        onClick={e => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 size={12} />
      </Button>
    </div>
  );
}
