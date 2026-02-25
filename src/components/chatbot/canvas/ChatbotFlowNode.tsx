import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  MessageSquare, List, FileInput, Brain, UserCheck, Clock,
  Tag, GitBranch, Users, Timer, XCircle, Webhook, Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_META: Record<string, {
  label: string;
  icon: typeof MessageSquare;
  color: string;
  bg: string;
  border: string;
}> = {
  message:       { label: 'Mensagem',          icon: MessageSquare, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950',   border: 'border-blue-200 dark:border-blue-800' },
  menu:          { label: 'Menu de Opções',     icon: List,          color: 'text-primary',    bg: 'bg-primary/10',                 border: 'border-primary/20' },
  collect_data:  { label: 'Coleta de Dados',    icon: FileInput,     color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800' },
  ai_response:   { label: 'Resposta IA',        icon: Brain,         color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950', border: 'border-violet-200 dark:border-violet-800' },
  transfer:      { label: 'Encaminhar',         icon: UserCheck,     color: 'text-rose-600',   bg: 'bg-rose-50 dark:bg-rose-950',   border: 'border-rose-200 dark:border-rose-800' },
  condition:     { label: 'Verificar Horário',  icon: Clock,         color: 'text-gray-600',   bg: 'bg-gray-50 dark:bg-gray-900',   border: 'border-gray-200 dark:border-gray-700' },
  apply_tag:     { label: 'Aplicar Tag',        icon: Tag,           color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200 dark:border-purple-800' },
  move_to_funnel:{ label: 'Mover p/ Funil',     icon: GitBranch,     color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800' },
  delegate:      { label: 'Delegar Chat',       icon: Users,         color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800' },
  delay:         { label: 'Aguardar',           icon: Timer,         color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200 dark:border-orange-800' },
  close_chat:    { label: 'Encerrar Chat',      icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950',     border: 'border-red-200 dark:border-red-800' },
  webhook:       { label: 'Webhook',            icon: Webhook,       color: 'text-cyan-600',   bg: 'bg-cyan-50 dark:bg-cyan-950',   border: 'border-cyan-200 dark:border-cyan-800' },
  smart_router:  { label: 'Roteador Inteligente', icon: Route,       color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-200 dark:border-indigo-800' },
};

function getPreview(nodeType: string, config: Record<string, unknown>): string {
  switch (nodeType) {
    case 'message':     return config.text ? `"${String(config.text).slice(0, 50)}${String(config.text).length > 50 ? '…' : ''}"` : '';
    case 'menu':        return config.text ? String(config.text).slice(0, 50) : '';
    case 'collect_data':return (config.fields as string[] | undefined)?.length ? `Coletar: ${(config.fields as string[]).join(', ')}` : '';
    case 'transfer':    return config.message ? String(config.message).slice(0, 50) : '';
    case 'delay':       return config.seconds ? `${config.seconds}s de espera` : config.minutes ? `${config.minutes}min` : '';
    case 'webhook':     return config.url ? String(config.url).slice(0, 50) : '';
    case 'close_chat':  return String(config.reason || 'Encerrar atendimento');
    case 'smart_router':{
      const count = (config.routes as unknown[] | undefined)?.length ?? 0;
      return `${count} rota(s)`;
    }
    default: return '';
  }
}

const TERMINAL_TYPES = new Set(['transfer', 'close_chat']);

export const ChatbotFlowNode = memo(({ data, selected }: NodeProps) => {
  const nodeType = (data as Record<string, unknown>).node_type as string;
  const config = ((data as Record<string, unknown>).config ?? {}) as Record<string, unknown>;
  const meta = NODE_META[nodeType] ?? NODE_META.message;
  const Icon = meta.icon;
  const preview = getPreview(nodeType, config);
  const isTerminal = TERMINAL_TYPES.has(nodeType);

  return (
    <div
      className={cn(
        'w-52 rounded-xl shadow-md border-2 bg-card transition-all duration-150',
        selected
          ? 'border-primary shadow-primary/30 shadow-lg scale-[1.02]'
          : 'border-border hover:border-primary/60 hover:shadow-md',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Header stripe */}
      <div className={cn('rounded-t-[10px] px-3 py-2 flex items-center gap-2', meta.bg)}>
        <div className={cn('h-6 w-6 rounded-md flex items-center justify-center shrink-0', meta.bg, meta.border, 'border')}>
          <Icon size={12} className={meta.color} />
        </div>
        <span className={cn('text-[11px] font-semibold truncate', meta.color)}>{meta.label}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 min-h-[32px]">
        {preview ? (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{preview}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60 italic">Clique para configurar</p>
        )}
      </div>

      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background"
        />
      )}
    </div>
  );
});

ChatbotFlowNode.displayName = 'ChatbotFlowNode';
export default ChatbotFlowNode;
