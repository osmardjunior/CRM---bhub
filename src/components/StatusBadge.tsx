import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  // DB enum statuses
  new: { label: 'Aberto', className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  open: { label: 'Em Atendimento', className: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' },
  pending: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
  resolved: { label: 'Resolvido', className: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700' },
  closed: { label: 'Fechado', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
  // Legacy / mock statuses
  aberta: { label: 'Aberta', className: 'bg-info/15 text-info border-info/20' },
  pendente: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/20' },
  resolvida: { label: 'Resolvida', className: 'bg-violet-500/15 text-violet-600 border-violet-500/20 dark:text-violet-400' },
  online: { label: 'Online', className: 'bg-success/15 text-success border-success/20' },
  ausente: { label: 'Ausente', className: 'bg-warning/15 text-warning border-warning/20' },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground border-border' },
  alta: { label: 'Alta', className: 'bg-destructive/15 text-destructive border-destructive/20' },
  media: { label: 'Média', className: 'bg-warning/15 text-warning border-warning/20' },
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground border-border' },
  em_progresso: { label: 'Em Progresso', className: 'bg-info/15 text-info border-info/20' },
  concluida: { label: 'Concluída', className: 'bg-success/15 text-success border-success/20' },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
